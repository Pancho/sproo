import App from './app.js';
import Loader from './utils/loader.js';
import {kebabToCamel} from './utils/text.js';


const TEXT_NODE_TAGS = /(\{\{.+?\}\})/u,
	SIMPLE_PROPERTY_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$.?]*$/u;

/**
 * Component - Clean implementation with proper cleanup and sproo-prefixed internal properties
 * @extends {HTMLElement}
 */
export default class Component extends HTMLElement {
	[Symbol.toStringTag] = 'Component';

	// Private fields (ES6 private, only accessible within this class)
	/** @type {Array<{expression: string, element: HTMLElement, update: Function}>} */
	#bindings = [];
	/** @type {Array<{condition: string, placeholder: Comment, template: Node, inserted: Node|null}>} */
	#ifDirectives = [];
	/** @type {Array<{itemsExpr: string, itemName: string, placeholder: Comment, template: Node}>} */
	#forEachDirectives = [];
	/** @type {Array<Component>} */
	#childComponents = [];
	/** @type {Object<string, Function>} */
	#eventListeners = {};
	/** @type {boolean} */
	#isUpdating = false;
	/** @type {Promise<void>|null} */
	#updatePromise = null;
	/** @type {boolean} */
	#isDestroyed = false;

	// Public fields
	/** @type {Promise<void>} */
	templateLoaded;
	/** @type {App} */
	app;
	/** @type {LoggerService} */
	logger;

	/**
	 * Constructor for the Component class.
	 * Initializes shadow DOM, loads templates and stylesheets, sets up reactive properties.
	 */
	constructor() {
		super();
		this.attachShadow({mode: 'open'});

		const templateReady = new Promise((resolve) => {
				if (this.constructor.template) {
					Loader.getTemplateHTML(this.constructor.template, resolve);
				} else {
					resolve();
				}
			}),
			styleSheetPromises = [],
			importPromises = [];

		if (this.constructor.stylesheets) {
			for (const stylesheet of this.constructor.stylesheets) {
				styleSheetPromises.push(
					new Promise((resolve) => {
						Loader.getCSS(
							typeof stylesheet === 'string' ? `${ App.staticRoot }${ stylesheet }` : stylesheet,
							resolve,
						);
					}),
				);
			}
		}

		if (this.constructor.registerComponents) {
			for (const component of this.constructor.registerComponents) {
				importPromises.push(import(component));
			}
		}

		this.app = App.instance;

		if (App.loggerFactory) {
			this.logger = App.loggerFactory.getLogger(this.constructor);
		} else {
			this.logger = new Proxy({}, {
				get: () => () => {
				},
			});
		}

		this.templateLoaded = new Promise((resolve) => {
			const baseProperties = Object.keys(this);

			Promise.all([
				templateReady,
				...styleSheetPromises,
			]).then(([templateDocument, ...stylesheets]) => {
				if (templateDocument instanceof Node) {
					const ownNames = Object.getOwnPropertyNames(this).filter((name) => !baseProperties.includes(name));

					this.shadowRoot.adoptedStyleSheets = [...stylesheets];
					this.shadowRoot.append(templateDocument);

					for (const name of ownNames) {
						this.#makeReactive(name);
					}

					this.#parseTemplate(this.shadowRoot);
					this.#parseEventHandlers(this.shadowRoot);
					this.#parseReferences(this.shadowRoot);
					this.#setupRouting();

					Promise.all(importPromises).then(([...componentModules]) => {
						if (this.#isDestroyed) {
							resolve();

							return;
						}

						const undeclaredModules = componentModules.filter(
							(m) => !customElements.get(m.default.tagName),
						);

						for (const module of undeclaredModules) {
							customElements.define(module.default.tagName, module.default);
						}

						this.onTemplateLoaded();
						this.#updateAllBindings();
						resolve();
					});
				} else {
					resolve();
				}
			});
		});
	}

	/**
	 * Makes a property reactive by creating getter/setter that triggers updates.
	 * @param {string} propName - The name of the property to make reactive
	 * @private
	 */
	#makeReactive(propName) {
		const internalKey = `_${ propName }`;

		this[internalKey] = this[propName];

		Object.defineProperty(this, propName, {
			get() {
				return this[internalKey];
			},
			set(value) {
				const oldValue = this[internalKey];

				if (oldValue === value) {
					return;
				}

				this[internalKey] = value;

				if (!this.isConnected) {
					return;
				}

				if (this.templateLoaded && !this.#isUpdating) {
					this.#updatePromise = this.templateLoaded.then(() => {
						if (this.isConnected && !this.#isDestroyed) {
							this.#updateAllBindings();
						}
					});
				}
			},
		});
	}

	/**
	 * Updates component properties and triggers a re-render.
	 * @param {Object<string, any>} changes - Object containing property names and their new values
	 * @public
	 */
	update(changes) {
		if (changes && typeof changes === 'object') {
			for (const [key, value] of Object.entries(changes)) {
				if (Object.prototype.hasOwnProperty.call(this, `_${ key }`)) {
					this[`_${ key }`] = value;
				}
			}
		}

		this.#updatePromise = Promise.resolve().then(() => {
			if (!this.#isDestroyed) {
				this.#updateAllBindings();
			}
		});
	}

	/**
	 * Returns a promise that resolves when all pending updates are complete.
	 * This allows external code (like tests) to await DOM updates.
	 * @returns {Promise<void>}
	 * @public
	 */
	async whenUpdated() {
		await this.templateLoaded;

		if (this.#updatePromise) {
			await this.#updatePromise;
		}
	}

	/**
	 * Updates all data bindings, processes directives (if/for-each), and updates child components.
	 * Protected against re-entrant calls with #isUpdating flag.
	 * @private
	 */
	#updateAllBindings() {
		if (this.#isUpdating || this.#isDestroyed) {
			return;
		}

		this.#isUpdating = true;

		try {
			this.onBeforeUpdate();

			this.#bindings = this.#bindings.filter((binding) => {
				if (binding.element && !binding.element.isConnected) {
					binding.update = null;
					binding.element = null;

					return false;
				}

				return true;
			});

			for (const binding of this.#bindings) {
				try {
					const context = binding.element?.sprooLoopContext || {},
						value = this.#evaluateExpression(binding.expression, context);

					binding.update(value);
				} catch (e) {
					// Silently skip bindings that can't be evaluated yet
				}
			}

			for (const ifDir of this.#ifDirectives) {
				try {
					const shouldShow = this.#evaluateExpression(ifDir.condition);

					if (shouldShow && !ifDir.inserted) {
						const clone = document.importNode(ifDir.template, true),
							forElements = clone.querySelectorAll ? clone.querySelectorAll('[for-each]') : [],
							bindingsBeforeCount = this.#bindings.length;
						let newBindings = [];

						for (const el of forElements) {
							const forExpr = el.getAttribute('for-each'),
								[itemName, itemsExpr] = forExpr.split(' in ').map((s) => s.trim()),
								placeholder = document.createComment('for-each'),
								template = document.importNode(el, true);

							template.removeAttribute('for-each');

							el.parentElement.insertBefore(placeholder, el);
							el.remove();

							this.#forEachDirectives.push({
								itemsExpr,
								itemName,
								placeholder,
								template,
							});
						}

						this.#parseBindingsInTemplate(clone);
						newBindings = this.#bindings.slice(bindingsBeforeCount);
						ifDir.placeholder.parentElement.insertBefore(clone, ifDir.placeholder);
						ifDir.inserted = clone;
						this.#parseEventHandlers(clone);

						for (const binding of newBindings) {
							if (binding.element && clone.contains(binding.element)) {
								try {
									const context = binding.element?.sprooLoopContext || {},
										value = this.#evaluateExpression(binding.expression, context);

									binding.update(value);
								} catch (e) {
									// Skip if can't evaluate
								}
							}
						}

						if (clone instanceof Component) {
							this.#childComponents.push(clone);
							clone.templateLoaded.then(() => {
								if (clone.isConnected) {
									this.#setChildProperties(clone);
								}
							});
						}
					} else if (!shouldShow && ifDir.inserted) {
						Component.#unloadElement(ifDir.inserted);
						ifDir.inserted = null;
					}
				} catch (e) {
					// Skip if directive evaluation fails
				}
			}

			for (const forDir of this.#forEachDirectives) {
				try {
					const items = this.#evaluateExpression(forDir.itemsExpr),
						existingElements = [];

					if (!Array.isArray(items)) {
						continue;
					}

					let sibling = forDir.placeholder.previousElementSibling;

					while (sibling && sibling.sprooForEachItem) {
						existingElements.unshift(sibling);
						sibling = sibling.previousElementSibling;
					}

					for (const el of existingElements) {
						if (el.sprooLoopContext) {
							el.sprooLoopContext = null;
						}

						el.sprooForEachItem = null;
						Component.#unloadElement(el);
					}

					for (const [index, item] of items.entries()) {
						const clone = document.importNode(forDir.template, true);

						clone.sprooForEachItem = true;
						clone.sprooLoopContext = {
							[forDir.itemName]: item,
							index,
						};

						forDir.placeholder.parentElement.insertBefore(clone, forDir.placeholder);
						this.#parseTemplateInContext(clone, clone.sprooLoopContext);
					}
				} catch (e) {
					// Skip if for-each evaluation fails
				}
			}

			const currentChildren = Array.from(this.shadowRoot.querySelectorAll('*'))
				.filter((el) => el instanceof Component && el !== this);

			this.#childComponents = this.#childComponents.filter((child) =>
				currentChildren.includes(child) && child.isConnected,
			);

			for (const child of currentChildren) {
				if (child.isConnected && child.templateLoaded) {
					this.#setChildProperties(child);
				}
			}

			this.onAfterUpdate();
		} finally {
			this.#isUpdating = false;
		}
	}

	/**
	 * Sets properties on child components based on attribute bindings.
	 * @param {Component} childComponent - The child component to update
	 * @private
	 */
	#setChildProperties(childComponent) {
		const attrs = childComponent.getAttributeNames ? childComponent.getAttributeNames() : [];

		for (const attr of attrs) {
			if (attr.startsWith('[') && attr.endsWith(']')) {
				const propName = kebabToCamel(attr.slice(1, -1)),
					expression = childComponent.getAttribute(attr);

				try {
					const value = this.#evaluateExpression(expression);

					if (Object.prototype.hasOwnProperty.call(childComponent, `_${ propName }`)) {
						childComponent[`_${ propName }`] = value;

						if (childComponent.isConnected) {
							childComponent.#updateAllBindings();
						}
					} else {
						childComponent[propName] = value;
					}
				} catch (e) {
					// Skip if can't evaluate
				}
			}
		}
	}

	/**
	 * Parses template for if directives, for-each loops, and bindings.
	 * Replaces directive elements with placeholders and stores templates.
	 * @param {DocumentFragment|HTMLElement} root - The root element to parse
	 * @private
	 */
	#parseTemplate(root) {
		const ifElements = root.querySelectorAll('[if]');
		let forElements = null,
			childComponents = [];

		for (const el of ifElements) {
			if (el.closest('[for-each]')) {
				continue;
			}

			const condition = el.getAttribute('if'),
				placeholder = document.createComment('if'),
				template = document.importNode(el, true);

			template.removeAttribute('if');

			el.parentElement.insertBefore(placeholder, el);
			el.remove();

			this.#ifDirectives.push({
				condition,
				placeholder,
				template,
				inserted: null,
			});
		}

		forElements = root.querySelectorAll('[for-each]');

		for (const el of forElements) {
			if (el.closest('[if]')) {
				continue;
			}

			const forExpr = el.getAttribute('for-each'),
				[itemName, itemsExpr] = forExpr.split(' in ').map((s) => s.trim()),
				placeholder = document.createComment('for-each'),
				template = document.importNode(el, true);

			template.removeAttribute('for-each');

			el.parentElement.insertBefore(placeholder, el);
			el.remove();

			this.#forEachDirectives.push({
				itemsExpr,
				itemName,
				placeholder,
				template,
			});
		}

		childComponents = Array.from(root.querySelectorAll('*')).filter((el) => el instanceof Component);

		for (const child of childComponents) {
			this.#childComponents.push(child);
		}

		this.#parseBindingsInTemplate(root);
	}

	/**
	 * Parses all data bindings in a template (attribute bindings and text interpolations).
	 * Creates binding objects that can update DOM when data changes.
	 * @param {DocumentFragment|HTMLElement} root - The root element to parse for bindings
	 * @private
	 */
	#parseBindingsInTemplate(root) {
		const elements = Array.from(root.querySelectorAll('*')).filter((el) => !(el instanceof Component)),
			textNodes = [];
		let textIterator = null,
			node = null;

		if (root.getAttributeNames && !(root instanceof Component)) {
			elements.unshift(root);
		}

		for (const el of elements) {
			const attrs = el.getAttributeNames ? el.getAttributeNames() : [];

			for (const attr of attrs) {
				if (!attr.startsWith('[') || !attr.endsWith(']')) {
					continue;
				}

				const expression = el.getAttribute(attr),
					bindingAttr = attr.slice(1, -1);

				if (bindingAttr.startsWith('attr.')) {
					const actualAttr = bindingAttr.substring(5);

					this.#bindings.push({
						expression,
						element: el,
						update: (value) => {
							if (value === null || typeof value === 'undefined') {
								el.removeAttribute(actualAttr);
							} else {
								el.setAttribute(actualAttr, value);
							}
						},
					});
				} else if (bindingAttr.startsWith('style.')) {
					const styleProp = bindingAttr.substring(6);

					this.#bindings.push({
						expression,
						element: el,
						update: (value) => {
							el.style[styleProp] = value ?? '';
						},
					});
				} else if (bindingAttr === 'html') {
					this.#bindings.push({
						expression,
						element: el,
						update: (value) => {
							el.innerHTML = value ?? '';
						},
					});
				} else {
					const propName = kebabToCamel(bindingAttr);

					this.#bindings.push({
						expression,
						element: el,
						update: (value) => {
							el[propName] = value;
						},
					});
				}
			}
		}

		textIterator = document.createNodeIterator(
			root,
			NodeFilter.SHOW_TEXT,
			{
				acceptNode: (innerNode) => {
					let parent = innerNode.parentElement;

					while (parent && parent !== root) {
						if (parent instanceof Component) {
							return NodeFilter.FILTER_REJECT;
						}

						parent = parent.parentElement;
					}

					return NodeFilter.FILTER_ACCEPT;
				},
			},
		);

		node = textIterator.nextNode();

		while (node) {
			if (node.textContent.includes('{{')) {
				textNodes.push(node);
			}

			node = textIterator.nextNode();
		}

		for (const textNode of textNodes) {
			const parts = textNode.textContent.split(TEXT_NODE_TAGS).filter(Boolean),
				replacements = [];

			for (const part of parts) {
				if (part.startsWith('{{') && part.endsWith('}}')) {
					const expression = part.slice(2, -2).trim(),
						newTextNode = document.createTextNode('');

					this.#bindings.push({
						expression,
						element: newTextNode,
						update: (value) => {
							newTextNode.textContent = value ?? '';
						},
					});

					replacements.push(newTextNode);
				} else {
					replacements.push(document.createTextNode(part));
				}
			}

			textNode.replaceWith(...replacements);
		}
	}

	/**
	 * Parses and evaluates a template in a specific context (used for for-each loops).
	 * Immediately evaluates bindings rather than storing them for later updates.
	 * @param {DocumentFragment|HTMLElement} root - The root element to parse
	 * @param {Object<string, any>} context - The context object containing loop variables
	 * @private
	 */
	#parseTemplateInContext(root, context) {
		const iter = document.createNodeIterator(root, NodeFilter.SHOW_TEXT),
			textNodes = [];
		let node = iter.nextNode(),
			elements = [];

		while (node) {
			if (node.textContent.includes('{{')) {
				textNodes.push(node);
			}

			node = iter.nextNode();
		}

		for (const textNode of textNodes) {
			const parts = textNode.textContent.split(TEXT_NODE_TAGS).filter(Boolean),
				replacements = [];

			for (const part of parts) {
				if (part.startsWith('{{') && part.endsWith('}}')) {
					const expression = part.slice(2, -2).trim();

					try {
						const value = this.#evaluateExpression(expression, context);

						replacements.push(document.createTextNode(value ?? ''));
					} catch (e) {
						replacements.push(document.createTextNode(''));
					}
				} else {
					replacements.push(document.createTextNode(part));
				}
			}

			textNode.replaceWith(...replacements);
		}

		elements = Array.from(root.querySelectorAll('*'));

		if (root.getAttributeNames) {
			elements.unshift(root);
		}

		for (const el of elements) {
			const attrs = el.getAttributeNames ? el.getAttributeNames() : [];

			for (const attr of attrs) {
				if (!attr.startsWith('[') || !attr.endsWith(']')) {
					continue;
				}

				const expression = el.getAttribute(attr);

				try {
					const value = this.#evaluateExpression(expression, context),
						bindingAttr = attr.slice(1, -1);

					if (bindingAttr.startsWith('attr.')) {
						const actualAttr = bindingAttr.substring(5);

						if (value !== null && typeof value !== 'undefined') {
							el.setAttribute(actualAttr, value);
						}
					} else if (bindingAttr.startsWith('style.')) {
						const styleProp = bindingAttr.substring(6);

						el.style[styleProp] = value ?? '';
					} else if (bindingAttr === 'html') {
						el.innerHTML = value ?? '';
					} else {
						const propName = kebabToCamel(bindingAttr);

						el[propName] = value;
					}
				} catch (e) {
					// Skip if can't evaluate
				}
			}
		}

		this.#parseEventHandlers(root, context);
	}

	/**
	 * Evaluates a JavaScript expression in the component's context.
	 * For simple property access, uses #getProperty for better performance.
	 * For complex expressions, creates a Function and evaluates it.
	 * @param {string} expression - The JavaScript expression to evaluate
	 * @param {Object<string, any>} [additionalContext={}] - Additional context variables (e.g., loop variables)
	 * @returns {any} The result of evaluating the expression
	 * @throws {Error} If the expression cannot be evaluated
	 * @private
	 */
	#evaluateExpression(expression, additionalContext = {}) {
		if (SIMPLE_PROPERTY_REGEX.test(expression) && !expression.includes('(')) {
			return this.#getProperty(expression, additionalContext);
		}

		const context = {...this.#getContext(), ...additionalContext},
			methods = this.#getMethods(),
			fullContext = {...context, ...methods},

			args = Object.keys(fullContext),
			values = Object.values(fullContext),
			// We need eval here, one way or another.
			// eslint-disable-next-line no-new-func
			func = new Function(...args, `return ${ expression }`);

		return func.apply(this, values);
	}

	/**
	 * Gets a property value by path (e.g., "user.name.first").
	 * Checks additionalContext first, then component properties.
	 * @param {string} path - The property path (dot-separated)
	 * @param {Object<string, any>} [additionalContext={}] - Additional context to check first
	 * @returns {any} The property value or undefined if not found
	 * @private
	 */
	#getProperty(path, additionalContext = {}) {
		const parts = path.split('.').map((p) => p.replace(/\?/gu, ''));

		if (typeof additionalContext[parts[0]] !== 'undefined') {
			let value = additionalContext[parts[0]];

			for (let i = 1; i < parts.length && value; i += 1) {
				value = value[parts[i]];
			}

			return value;
		}

		let value = this[`_${ parts[0] }`] ?? this[parts[0]];

		for (let i = 1; i < parts.length && value; i += 1) {
			value = value[parts[i]];
		}

		return value;
	}

	/**
	 * Gets all reactive properties from the component.
	 * Returns properties stored with underscore prefix (e.g., _propertyName).
	 * @returns {Object<string, any>} Object containing all reactive properties
	 * @private
	 */
	#getContext() {
		const context = {};

		for (const key in this) {
			if (key.startsWith('_') && !key.startsWith('__')) {
				context[key.substring(1)] = this[key];
			}
		}

		return context;
	}

	/**
	 * Gets all methods from the component and its prototype chain.
	 * Returns bound methods that can be called from expressions.
	 * @returns {Object<string, Function>} Object containing all component methods
	 * @private
	 */
	#getMethods() {
		const methods = {};
		let proto = Object.getPrototypeOf(this);

		while (proto && !proto.constructor.name.startsWith('HTML')) {
			const names = Object.getOwnPropertyNames(proto);

			for (const name of names) {
				if (typeof this[name] === 'function' &&
					name !== 'constructor' &&
					!name.startsWith('_') &&
					!name.startsWith('#') &&
					!methods[name]) {
					methods[name] = this[name].bind(this);
				}
			}

			proto = Object.getPrototypeOf(proto);
		}

		return methods;
	}

	/**
	 * Parses event handlers from elements with (eventName) attributes.
	 * Sets up event listeners that call component methods.
	 * @param {DocumentFragment|HTMLElement} root - The root element to parse for event handlers
	 * @param {Object<string, any>} [context=null] - Optional context for event handlers (e.g., loop context)
	 * @private
	 */
	#parseEventHandlers(root, context = null) {
		const elements = Array.from(root.querySelectorAll('*'));

		if (root.getAttributeNames) {
			elements.unshift(root);
		}

		for (const el of elements) {
			const attrs = el.getAttributeNames ? el.getAttributeNames() : [];

			for (const attr of attrs) {
				if (!attr.startsWith('(') || !attr.endsWith(')')) {
					continue;
				}

				const eventName = attr.slice(1, -1).trim(),
					handlerName = el.getAttribute(attr);

				if (typeof this[handlerName] === 'function') {
					if (el.sprooEventListeners && el.sprooEventListeners[eventName]) {
						el.removeEventListener(eventName, el.sprooEventListeners[eventName]);
					}

					const handler = (ev) => {
						let result = null;

						if (context) {
							result = this[handlerName](ev, context);
						} else if (el.sprooLoopContext) {
							result = this[handlerName](ev, el.sprooLoopContext);
						} else {
							result = this[handlerName](ev);
						}

						if (result === false) {
							ev.preventDefault();
							ev.stopPropagation();
						}
					};

					el.addEventListener(eventName, handler);

					if (!el.sprooEventListeners) {
						el.sprooEventListeners = {};
					}

					el.sprooEventListeners[eventName] = handler;
				}
			}
		}
	}

	/**
	 * Parses elements with [ref] attribute and stores references on the component.
	 * Allows accessing elements via this.refName.
	 * @param {DocumentFragment|HTMLElement} root - The root element to parse for references
	 * @private
	 */
	#parseReferences(root) {
		for (const el of root.querySelectorAll('[ref]')) {
			this[el.getAttribute('ref')] = el;
		}
	}

	/**
	 * Sets up routing for elements with [route] attribute.
	 * Handles click events and navigates using the app router.
	 * @private
	 */
	#setupRouting() {
		this.shadowRoot.addEventListener('click', (event) => {
			let target = event.target;

			while (target && target !== this.shadowRoot) {
				if (target.matches && target.matches('[route]')) {
					if ((event.ctrlKey || event.metaKey) && target.tagName.toLowerCase() === 'a') {
						return;
					}

					event.preventDefault();
					const location = target.getAttribute('route').replace(/\/+$/u, '').replace(/^\/+/u, '/');

					if (this.app.router && !this.app.router.destroyed) {
						this.app.router.navigate(location, {
							prevUrl: window.location.href,
							...target.dataset,
						});
					}

					return;
				}

				target = target.parentElement;
			}
		});
	}

	/**
	 * Adds an event listener to the component.
	 * Stores listener reference for proper cleanup on unload.
	 * @param {string} event - The event name to listen for
	 * @param {Function} listener - The event listener function
	 * @public
	 */
	listen(event, listener) {
		this.#eventListeners[event] = listener;
		this.addEventListener(event, this.#eventListeners[event]);
	}

	/**
	 * Dispatches a custom event that bubbles and composes through shadow DOM.
	 * @param {string} eventName - The name of the event to dispatch
	 * @param {any} [detail=null] - Optional data to include with the event
	 * @public
	 */
	dispatch(eventName, detail = null) {
		this.dispatchEvent(new CustomEvent(eventName, {
			bubbles: true,
			composed: true,
			detail,
		}));
	}

	/**
	 * Queries the shadow DOM for a single element.
	 * @param {string} selector - CSS selector string
	 * @returns {Element|null} The first matching element or null
	 * @public
	 */
	getElement(selector) {
		return this.shadowRoot.querySelector(selector);
	}

	/**
	 * Queries the shadow DOM for all matching elements.
	 * @param {string} selector - CSS selector string
	 * @returns {NodeList} A NodeList of all matching elements
	 * @public
	 */
	getElements(selector) {
		return this.shadowRoot.querySelectorAll(selector);
	}

	/**
	 * Called when the component is removed from the DOM.
	 * Triggers cleanup of all resources.
	 * @public
	 */
	disconnectedCallback() {
		Component.#unloadElement(this);
	}

	/**
	 * Lifecycle hook called when the component is unloading.
	 * Override this method to perform custom cleanup.
	 * @public
	 */
	unload() {
	}

	/**
	 * Lifecycle hook called after the template is loaded and parsed.
	 * Override this method to perform initialization after template is ready.
	 * @public
	 */
	onTemplateLoaded() {
	}

	/**
	 * Lifecycle hook called before each update cycle.
	 * Override this method to perform actions before updates.
	 * @public
	 */
	// eslint-disable-next-line class-methods-use-this
	onBeforeUpdate() {
	}

	/**
	 * Lifecycle hook called after each update cycle.
	 * Override this method to perform actions after updates.
	 * @public
	 */
	// eslint-disable-next-line class-methods-use-this
	onAfterUpdate() {
	}

	/**
	 * Recursively unloads an element and all its children.
	 * Cleans up event listeners, bindings, directives, and sproo-managed properties.
	 * @param {HTMLElement|Component} element - The element to unload
	 * @private
	 * @static
	 */
	static #unloadElement(element) {
		if (!element) {
			return;
		}

		let children = [];

		if (element.shadowRoot) {
			children = Array.from(element.shadowRoot.querySelectorAll('*'));
		} else if (element.querySelectorAll) {
			children = Array.from(element.querySelectorAll('*'));
		}

		for (const child of children) {
			Component.#unloadElement(child);
		}

		if (element.sprooEventListeners) {
			for (const [event, handler] of Object.entries(element.sprooEventListeners)) {
				element.removeEventListener(event, handler);
			}

			element.sprooEventListeners = null;
		}

		if (element.sprooLoopContext) {
			element.sprooLoopContext = null;
		}

		if (typeof element.sprooForEachItem !== 'undefined') {
			element.sprooForEachItem = null;
		}

		if (element instanceof Component) {
			element.#isDestroyed = true;

			if (element.#ifDirectives) {
				for (const dir of element.#ifDirectives) {
					if (dir.inserted) {
						Component.#unloadElement(dir.inserted);
					}

					dir.template = null;
					dir.placeholder = null;
					dir.inserted = null;
				}

				element.#ifDirectives = [];
			}

			if (element.#forEachDirectives) {
				for (const dir of element.#forEachDirectives) {
					dir.template = null;
					dir.placeholder = null;
				}

				element.#forEachDirectives = [];
			}

			if (element.#bindings) {
				for (const binding of element.#bindings) {
					binding.update = null;
					binding.element = null;
				}

				element.#bindings = [];
			}

			if (element.#childComponents) {
				for (const child of element.#childComponents) {
					if (child.isConnected) {
						Component.#unloadElement(child);
					}
				}

				element.#childComponents = [];
			}

			element.#eventListeners = {};
			element.#updatePromise = null;

			if (element.logger?.release) {
				element.logger.release();
			}

			element.logger = null;

			if (element.shadowRoot) {
				element.shadowRoot.adoptedStyleSheets = [];
				element.shadowRoot.innerHTML = '';
			}

			element.unload?.();
		}

		if (typeof element.remove === 'function') {
			element.remove();
		}
	}
}
