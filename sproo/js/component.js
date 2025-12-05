import App from './app.js';
import Loader from './utils/loader.js';
import {camelToKebab, kebabToCamel} from './utils/text.js';


const TEXT_NODE_TAGS = /(\{\{.+?\}\})/u,
	SIMPLE_PROPERTY_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$.?]*$/u,
	EVALUATION_ERROR = Symbol('EVALUATION_ERROR'),
	/**
	 * Property bindings for elements where setting attributes isn't sufficient.
	 * These elements need both property AND attribute updates for proper synchronization.
	 */
	PROPERTY_BINDINGS = {
		'value': (element, value) => {
			// For input, textarea, select - set the live property value
			if ([
				'INPUT',
				'TEXTAREA',
				'SELECT',
			].includes(element.tagName)) {
				element.value = value ?? '';
			}
		},
		'checked': (element, value) => {
			// For checkbox and radio inputs - set the checked state
			if (element.tagName === 'INPUT' &&
				(element.type === 'checkbox' || element.type === 'radio')) {
				element.checked = Boolean(value);
			}
		},
		'selected': (element, value) => {
			// For option elements - set the selected state
			if (element.tagName === 'OPTION') {
				element.selected = Boolean(value);
			}
		},
		'disabled': (element, value) => {
			// For any element that can be disabled
			element.disabled = Boolean(value);
		},
		'readonly': (element, value) => {
			// For inputs that can be readonly
			if ([
				'INPUT',
				'TEXTAREA',
			].includes(element.tagName)) {
				element.readOnly = Boolean(value);
			}
		},
	};

/**
 * Component - Clean implementation with proper cleanup and sproo-prefixed internal properties
 * @extends {HTMLElement}
 */
export default class Component extends HTMLElement {
	[Symbol.toStringTag] = 'Component';

	// Performance tracking
	static performanceTracking = true;
	static performanceLog = [];
	static performanceThreshold = 5;

	// Private fields (ES6 private, only accessible within this class)
	/** @type {Array<{expression: string, element: HTMLElement, update: Function}>} */
	#bindings = [];
	/** @type {Array<{condition: string, placeholder: Comment, template: Node, inserted: Node|null, context: Object|null}>} */
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

	// NEW: Dependency tracking for optimized updates
	/** @type {Map<Object, Set<string>>} */
	#dependencyMap = new Map; // binding -> Set<propertyNames>
	/** @type {Map<string, Set<Object>>} */
	#bindingsByProperty = new Map; // propertyName -> Set<bindings>
	/** @type {Set<string>} */
	#propertiesToUpdate = new Set; // Track which properties changed
	/** @type {Map<Object, Set<string>>} */
	#ifDirectiveDeps = new Map; // ifDirective -> Set<propertyNames>
	/** @type {Map<Object, Set<string>>} */
	#forEachDirectiveDeps = new Map; // forEachDirective -> Set<propertyNames>
	/** @type {boolean} */
	#forEachReconciled = false; // Track if any for-each was reconciled in this update cycle

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


		const moduleUrl = this.constructor.moduleUrl,
			templateReady = new Promise((resolve) => {
				Loader.getTemplateHTML(this.constructor.template, moduleUrl, resolve);
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

		this.app = App.instance;

		if (this.constructor.registerComponents) {
			for (const component of this.constructor.registerComponents) {
				importPromises.push(import(`${ this.app.constructor.staticRoot }${ component }`));
			}
		}

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
							(m) => !customElements.get(this.#resolveTagName(m.default)),
						);

						for (const module of undeclaredModules) {
							customElements.define(this.#resolveTagName(module.default), module.default);
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
	 * Resolves tag name from app config (appName) and component class name
	 * @private
	 * @param clazz
	 */
	#resolveTagName(clazz) {
		return `${ this.app.constructor.appName }-${ camelToKebab(clazz.name.replace('Component', '')) }`;
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
					// Track which property changed for selective updates
					this.#propertiesToUpdate.add(propName);

					this.#updatePromise = this.templateLoaded.then(() => {
						if (this.isConnected && !this.#isDestroyed) {
							this.#updateChangedBindings();
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
					this.#propertiesToUpdate.add(key);
				}
			}
		}

		this.#updatePromise = Promise.resolve().then(() => {
			if (!this.#isDestroyed) {
				this.#updateChangedBindings();
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
	 * NEW: Parse an expression to extract property dependencies.
	 * @private
	 */
	#extractDependencies(expression) {
		const dependencies = new Set;
		const propertyPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*(?:(?:\.|\.\ ?\[|\?\.)[a-zA-Z0-9_$\[\]'"]+)*)/g;
		let match;

		const keywords = new Set([
			'true',
			'false',
			'null',
			'undefined',
			'this',
			'return',
			'if',
			'else',
			'for',
			'while',
			'function',
			'const',
			'let',
			'var',
			'new',
			'typeof',
			'instanceof',
			'delete',
			'void',
			'in',
			'of',
			'break',
			'continue',
			'switch',
			'case',
			'default',
			'try',
			'catch',
			'finally',
			'throw',
			'class',
			'extends',
			'static',
			'async',
			'await',
		]);

		while ((match = propertyPattern.exec(expression)) !== null) {
			const propPath = match[1];
			const rootProp = propPath.split(/[.\[?]/)[0];

			if (!keywords.has(rootProp) && rootProp.length > 0) {
				dependencies.add(rootProp);
			}
		}

		return dependencies;
	}

	#registerBinding(binding) {
		const dependencies = this.#extractDependencies(binding.expression);

		this.#dependencyMap.set(binding, dependencies);

		for (const prop of dependencies) {
			if (!this.#bindingsByProperty.has(prop)) {
				this.#bindingsByProperty.set(prop, new Set);
			}

			this.#bindingsByProperty.get(prop).add(binding);
		}
	}

	#unregisterBinding(binding) {
		const dependencies = this.#dependencyMap.get(binding);

		if (dependencies) {
			for (const prop of dependencies) {
				this.#bindingsByProperty.get(prop)?.delete(binding);
			}

			this.#dependencyMap.delete(binding);
		}
	}

	#registerIfDirective(directive) {
		const dependencies = this.#extractDependencies(directive.condition);

		this.#ifDirectiveDeps.set(directive, dependencies);
	}

	#registerForEachDirective(directive) {
		const dependencies = this.#extractDependencies(directive.itemsExpr);

		this.#forEachDirectiveDeps.set(directive, dependencies);
	}

	/**
	 * Gets the loop context for a node by walking up the DOM tree.
	 * For nested for-each loops, placeholders may have their parent context stored directly.
	 * @param {Node} node - The node to get context for
	 * @returns {Object|null} The loop context or null
	 * @private
	 */
	#getLoopContext(node) {
		if (!node) {
			return null;
		}

		// CRITICAL: Check if the node itself has a loop context
		// This handles both elements AND placeholders (for nested loops)
		if (node.sprooLoopContext) {
			return node.sprooLoopContext;
		}

		// For text nodes or elements, walk up to find parent element with context
		let parent = node.parentElement || node.parentNode;

		while (parent) {
			if (parent.sprooLoopContext) {
				return parent.sprooLoopContext;
			}

			parent = parent.parentElement || parent.parentNode;
		}

		return null;
	}

	#areItemsEqual(oldItem, newItem) {
		if (oldItem === newItem) {
			return true;
		}

		if (typeof oldItem === 'object' && typeof newItem === 'object') {
			if (oldItem === null || newItem === null) {
				return oldItem === newItem;
			}

			try {
				return JSON.stringify(oldItem) === JSON.stringify(newItem);
			} catch (e) {
				return false;
			}
		}

		return false;
	}

	#updateElementBindings(element, context) {
		const perfTotal = this.#perfStart('Update Element Bindings');
		let bindingCount = 0;
		let errorCount = 0;
		let updatedCount = 0;

		// CRITICAL: Filter out disconnected bindings BEFORE updating
		// This prevents stale bindings from evaluating with old contexts
		this.#bindings = this.#bindings.filter((binding) => {
			if (!binding.element || !binding.element.isConnected) {
				this.#unregisterBinding(binding);
				binding.update = null;
				binding.element = null;

				return false;
			}

			return true;
		});

		for (const binding of this.#bindings) {
			if (binding.element &&
				(binding.element === element || element.contains(binding.element))) {
				const bindingContext = this.#getLoopContext(binding.element) || context;
				const value = this.#evaluateExpression(binding.expression, bindingContext);

				// Always call update - let it handle EVALUATION_ERROR
				if (binding.update) {
					binding.update(value);
					updatedCount++;
				}

				if (value === EVALUATION_ERROR) {
					errorCount++;
				}

				bindingCount++;
			}
		}

		this.#perfEnd(perfTotal, {
			totalBindings: bindingCount,
			updatedBindings: updatedCount,
			errors: errorCount,
		});
	}

	#reconcileForEachItems(forDir, newItems) {
		// Set flag to indicate a for-each was reconciled
		this.#forEachReconciled = true;

		// CRITICAL FIX: Clear dependency tracking for any nested for-each loops that depend on loop variables
		// This ensures they always update when parent reconciles
		for (const nestedForDir of this.#forEachDirectives) {
			const deps = this.#forEachDirectiveDeps.get(nestedForDir);

			if (deps && deps.size > 0) {
				// Check if ALL dependencies are loop variables (not top-level properties)
				const allDepsAreLoopVars = Array.from(deps).every((dep) =>
					!Object.prototype.hasOwnProperty.call(this, `_${ dep }`),
				);

				if (allDepsAreLoopVars) {
					// Clear the dependencies so this nested loop always updates
					this.#forEachDirectiveDeps.set(nestedForDir, new Set);
				}
			}
		}

		const perfTotal = this.#perfStart('ForEach Reconciliation Total');
		const perfDetail = {
			itemsExpr: forDir.itemsExpr,
			oldCount: 0,
			newCount: newItems ? newItems.length : 0,
			strategy: 'unknown',
		};

		const existingElements = [];
		const perfCount = this.#perfStart('ForEach - Count Existing');
		let sibling = forDir.placeholder.previousElementSibling;

		while (sibling && sibling.sprooForEachItem) {
			existingElements.unshift(sibling);
			sibling = sibling.previousElementSibling;
		}

		this.#perfEnd(perfCount, {count: existingElements.length});
		perfDetail.oldCount = existingElements.length;

		if (existingElements.length === newItems.length) {
			const perfUpdateInPlace = this.#perfStart('ForEach - Update In Place');
			let needsRecreation = false;
			const elementsToUpdate = []; // Track which elements need binding updates

			for (let i = 0; i < newItems.length; i++) {
				const element = existingElements[i];
				const item = newItems[i];

				if (!element.sprooLoopContext) {
					needsRecreation = true;

					break;
				}

				const oldItem = element.sprooLoopContext[forDir.itemName];
				const itemsEqual = this.#areItemsEqual(oldItem, item);

				if (!itemsEqual) {
					element.sprooLoopContext[forDir.itemName] = item;
					element.sprooLoopContext.index = i;

					// CRITICAL FIX: Update nested for-each placeholders' parent context
					this.#updateNestedPlaceholderContexts(element, element.sprooLoopContext);

					// Mark this element as needing binding updates
					elementsToUpdate.push(element);
				}
			}

			if (!needsRecreation) {
				this.#perfEnd(perfUpdateInPlace, {
					itemsUpdated: elementsToUpdate.length,
					recreated: false,
				});
				perfDetail.strategy = 'update-in-place';

				// First, update nested for-each loops for elements that changed
				for (const element of elementsToUpdate) {
					this.#forceUpdateNestedForEach(element);
				}

				// CRITICAL: Update bindings for ALL elements to ensure fresh data
				// This catches both direct changes and nested changes
				for (const element of existingElements) {
					this.#updateElementBindings(element, element.sprooLoopContext);
				}

				this.#perfEnd(perfTotal, perfDetail);

				return;
			}

			this.#perfEnd(perfUpdateInPlace, {
				itemsUpdated: 0,
				recreated: true,
			});
			perfDetail.strategy = 'recreate-all';
		}

		const perfRemove = this.#perfStart('ForEach - Remove All');

		// CRITICAL FIX: Before removing elements, clean up their nested for-each directives
		// This prevents disconnected placeholders from staying in #forEachDirectives
		for (const el of existingElements) {
			// Find and remove nested directives that belong to this element
			this.#forEachDirectives = this.#forEachDirectives.filter((dir) => {
				// Keep directive if its placeholder is NOT inside this element
				const shouldKeep = !el.contains || !el.contains(dir.placeholder);

				return shouldKeep;
			});

			if (el.sprooLoopContext) {
				el.sprooLoopContext = null;
			}

			el.sprooForEachItem = null;
			Component.#unloadElement(el);
		}

		this.#perfEnd(perfRemove, {removed: existingElements.length});

		const perfCreate = this.#perfStart('ForEach - Create All');

		for (const [index, item] of newItems.entries()) {
			const perfClone = this.#perfStart('ForEach - Clone Template');
			const clone = document.importNode(forDir.template, true);

			this.#perfEnd(perfClone);
			clone.sprooForEachItem = true;
			clone.sprooLoopContext = {
				[forDir.itemName]: item,
				index,
			};
			forDir.placeholder.parentElement.insertBefore(clone, forDir.placeholder);
			const perfParse = this.#perfStart('ForEach - Parse Template');

			this.#parseTemplateInContext(clone, clone.sprooLoopContext);
			this.#perfEnd(perfParse);
		}

		this.#perfEnd(perfCreate, {created: newItems.length});
		perfDetail.created = newItems.length;

		// Collect newly created elements for binding updates
		const newElements = [];
		let sibling2 = forDir.placeholder.previousElementSibling;

		while (sibling2 && sibling2.sprooForEachItem) {
			newElements.unshift(sibling2);
			sibling2 = sibling2.previousElementSibling;
		}

		// Force update nested for-each loops after reconciliation
		for (const element of newElements) {
			this.#forceUpdateNestedForEach(element);
		}

		// CRITICAL: Update all bindings in newly created elements after nested reconciliation
		for (const element of newElements) {
			this.#updateElementBindings(element, element.sprooLoopContext);
		}

		this.#perfEnd(perfTotal, perfDetail);
	}

	// Helper to force-update nested for-each loops
	#forceUpdateNestedForEach(parentElement) {
		for (const forDir of this.#forEachDirectives) {
			// Check if this for-each's placeholder is inside the parent element
			if (parentElement.contains && parentElement.contains(forDir.placeholder)) {
				try {
					const context = this.#getLoopContext(forDir.placeholder) || {};
					const items = this.#evaluateExpression(forDir.itemsExpr, context);

					if (Array.isArray(items)) {
						this.#reconcileForEachItems(forDir, items);
					}
				} catch (e) {
					// Skip
				}
			}
		}
	}

	// CRITICAL FIX: Helper to update nested for-each placeholders' parent context
	// This ensures nested loops can access updated parent loop variables
	#updateNestedPlaceholderContexts(parentElement, newContext) {
		for (const forDir of this.#forEachDirectives) {
			// Check if this for-each's placeholder is inside the parent element
			if (parentElement.contains && parentElement.contains(forDir.placeholder)) {
				// Update the placeholder's stored parent context
				// This is crucial for nested loops to evaluate with fresh parent data
				if (forDir.placeholder.sprooLoopContext) {
					// Merge the new parent context, preserving any nested loop variables
					forDir.placeholder.sprooLoopContext = {
						...forDir.placeholder.sprooLoopContext,
						...newContext,
					};
				} else {
					forDir.placeholder.sprooLoopContext = newContext;
				}
			}
		}
	}

	#updateChangedBindings() {
		if (this.#isUpdating || this.#isDestroyed) {
			return;
		}

		this.#isUpdating = true;

		try {
			this.onBeforeUpdate();

			const bindingsToUpdate = new Set;
			const changedProps = Array.from(this.#propertiesToUpdate);

			for (const changedProp of changedProps) {
				const affectedBindings = this.#bindingsByProperty.get(changedProp);

				if (affectedBindings) {
					for (const binding of affectedBindings) {
						bindingsToUpdate.add(binding);
					}
				}
			}

			this.#propertiesToUpdate.clear();

			this.#bindings = this.#bindings.filter((binding) => {
				if (binding.element && !binding.element.isConnected) {
					this.#unregisterBinding(binding);
					binding.update = null;
					binding.element = null;

					return false;
				}

				return true;
			});

			for (const binding of bindingsToUpdate) {
				if (!this.#bindings.includes(binding)) {
					continue;
				}

				try {
					const context = this.#getLoopContext(binding.element) || {};
					const value = this.#evaluateExpression(binding.expression, context);

					binding.update(value);
				} catch (e) {
					// Skip
				}
			}

			this.#updateDirectivesSelectively(changedProps);

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

	#updateDirectivesSelectively(changedProps) {
		const needsUpdate = (deps, itemsExpr) => {
			if (!deps || deps.size === 0) {
				return true;
			}

			// If this for-each depends only on properties that aren't top-level (i.e., loop variables),
			// and any for-each was reconciled, force update
			if (this.#forEachReconciled) {
				const hasOnlyLoopVarDeps = Array.from(deps).every((dep) =>
					// Check if this dependency is a loop variable (not a top-level property)
					 !Object.prototype.hasOwnProperty.call(this, `_${ dep }`)
				);

				if (hasOnlyLoopVarDeps) {
					return true;
				}
			}

			return changedProps.some((prop) => deps.has(prop));
		};

		for (const ifDir of this.#ifDirectives) {
			const deps = this.#ifDirectiveDeps.get(ifDir);

			if (!needsUpdate(deps, 'if')) {
				continue;
			}

			try {
				const shouldShow = this.#evaluateExpression(ifDir.condition, ifDir.context || {});
				const show = shouldShow !== EVALUATION_ERROR && Boolean(shouldShow);

				if (show && !ifDir.inserted) {
					const clone = document.importNode(ifDir.template, true);
					const forElements = clone.querySelectorAll ? clone.querySelectorAll('[for-each]') : [];
					const bindingsBeforeCount = this.#bindings.length;
					let newBindings = [];

					for (const el of forElements) {
						const forExpr = el.getAttribute('for-each');
						const [itemName, itemsExpr] = forExpr.split(' in ').map((s) => s.trim());
						const placeholder = document.createComment('for-each');
						const template = document.importNode(el, true);

						template.removeAttribute('for-each');
						el.parentElement.insertBefore(placeholder, el);
						el.remove();

						const forDir = {
							itemsExpr,
							itemName,
							placeholder,
							template,
						};

						this.#forEachDirectives.push(forDir);
						this.#registerForEachDirective(forDir);

						try {
							placeholder.sprooLoopContext = ifDir.context;
							const items = this.#evaluateExpression(itemsExpr, ifDir.context || {});

							if (Array.isArray(items)) {
								this.#reconcileForEachItems(forDir, items);
							}
						} catch (e) {
							console.warn(`[Sproo] For-each in if directive evaluation error: "${ itemsExpr }"`, e);
						}
					}

					this.#parseBindingsInTemplate(clone);
					newBindings = this.#bindings.slice(bindingsBeforeCount);
					ifDir.placeholder.parentElement.insertBefore(clone, ifDir.placeholder);
					ifDir.inserted = clone;
					this.#parseEventHandlers(clone);

					for (const binding of newBindings) {
						if (binding.element && clone.contains(binding.element)) {
							try {
								const context = this.#getLoopContext(binding.element) || {};
								const value = this.#evaluateExpression(binding.expression, context);

								binding.update(value);
							} catch (e) {
								// Skip
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
				} else if (!show && ifDir.inserted) {
					Component.#unloadElement(ifDir.inserted);
					ifDir.inserted = null;
				}
			} catch (e) {
				// Skip
			}
		}

		for (const forDir of this.#forEachDirectives) {
			// CRITICAL FIX: Skip directives with disconnected placeholders
			// These are stale directives from removed parent loop items
			if (!forDir.placeholder || !forDir.placeholder.isConnected) {
				continue;
			}

			const deps = this.#forEachDirectiveDeps.get(forDir);

			if (!needsUpdate(deps, forDir.itemsExpr)) {
				continue;
			}

			try {
				// Get loop context from the placeholder's parent for nested loops
				const context = this.#getLoopContext(forDir.placeholder) || {};
				const items = this.#evaluateExpression(forDir.itemsExpr, context);

				if (!Array.isArray(items)) {
					continue;
				}

				this.#reconcileForEachItems(forDir, items);
			} catch (e) {
				// Skip
			}
		}

		// CRITICAL FIX: Clean up disconnected directives at end of update cycle
		// This prevents memory leaks from accumulating stale directives
		this.#forEachDirectives = this.#forEachDirectives.filter((dir) =>
			dir.placeholder && dir.placeholder.isConnected,
		);

		// Reset the flag after all for-each directives have been processed
		this.#forEachReconciled = false;
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
					const context = this.#getLoopContext(binding.element) || {},
						value = this.#evaluateExpression(binding.expression, context);

					binding.update(value);
				} catch (e) {
					// Log error and clear stale data - Vue/Angular-like behavior
					console.warn(`[Sproo] Binding evaluation error: "${ binding.expression }"`, e);
					binding.update(null);
				}
			}

			for (const ifDir of this.#ifDirectives) {
				try {
					const shouldShow = this.#evaluateExpression(ifDir.condition, ifDir.context || {});
					const show = shouldShow !== EVALUATION_ERROR && Boolean(shouldShow);

					if (show && !ifDir.inserted) {
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
									const context = this.#getLoopContext(binding.element) || {},
										value = this.#evaluateExpression(binding.expression, context);

									binding.update(value);
								} catch (e) {
									// Log error and clear stale data
									console.warn(`[Sproo] If directive binding evaluation error: "${ binding.expression }"`, e);
									binding.update(null);
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
					} else if (!show && ifDir.inserted) {
						Component.#unloadElement(ifDir.inserted);
						ifDir.inserted = null;
					}
				} catch (e) {
					// Log error and clean up inserted content
					console.warn(`[Sproo] If directive evaluation error: "${ ifDir.condition }"`, e);

					if (ifDir.inserted) {
						Component.#unloadElement(ifDir.inserted);
						ifDir.inserted = null;
					}
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
					// Log error for for-each evaluation failures
					console.warn(`[Sproo] For-each evaluation error: "${ forDir.itemsExpr }"`, e);
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
			// Component property binding: :my-prop="value"
			if (attr.startsWith(':')) {
				const propName = kebabToCamel(attr.slice(1)),
					expression = childComponent.getAttribute(attr);

				try {
					const value = this.#evaluateExpression(expression);
					const hasBacking = Object.prototype.hasOwnProperty.call(childComponent, `_${ propName }`);

					if (hasBacking) {
						const oldValue = childComponent[`_${ propName }`];

						childComponent[`_${ propName }`] = value;

						if (childComponent.isConnected) {
							childComponent.#updateAllBindings();
						}
					} else {
						childComponent[propName] = value;
					}
				} catch (e) {
					console.error('[DEBUG 111-ERROR] Failed to evaluate expression:', expression, e);
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

			const directive = {
				condition,
				placeholder,
				template,
				inserted: null,
				context: null,
			};

			this.#ifDirectives.push(directive);
			this.#registerIfDirective(directive); // NEW: Register dependencies
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

			const directive = {
				itemsExpr,
				itemName,
				placeholder,
				template,
			};

			this.#forEachDirectives.push(directive);
			this.#registerForEachDirective(directive); // NEW: Register dependencies
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
				if (attr.startsWith(':')) {
					const actualAttr = attr.slice(1);
					const expression = el.getAttribute(attr);

					if (actualAttr === 'innerHTML') {
						const binding = {
							expression,
							element: el,
							update: (value) => {
								if (value === EVALUATION_ERROR) {
									el.innerHTML = '';
								} else {
									el.innerHTML = value ?? '';
								}
							},
						};

						this.#bindings.push(binding);
						this.#registerBinding(binding);
					} else if (actualAttr.startsWith('class.')) {
						const className = actualAttr.substring(6);

						const binding = {
							expression,
							element: el,
							update: (value) => {
								if (value === EVALUATION_ERROR || !value) {
									el.classList.remove(className);
								} else {
									el.classList.add(className);
								}
							},
						};

						this.#bindings.push(binding);
						this.#registerBinding(binding);
					} else {
						const binding = {
							expression,
							element: el,
							update: (value) => {
								if (value === EVALUATION_ERROR) {
									el.removeAttribute(actualAttr);

									// Clear property as well if it needs special handling
									if (PROPERTY_BINDINGS[actualAttr]) {
										PROPERTY_BINDINGS[actualAttr](el, '');
									}
								} else if (value === null || typeof value === 'undefined') {
									el.removeAttribute(actualAttr);

									// Clear property as well if it needs special handling
									if (PROPERTY_BINDINGS[actualAttr]) {
										PROPERTY_BINDINGS[actualAttr](el, '');
									}
								} else {
									// Set property first if special handling is needed
									if (PROPERTY_BINDINGS[actualAttr]) {
										PROPERTY_BINDINGS[actualAttr](el, value);
									}

									// Always set the attribute as well
									el.setAttribute(actualAttr, value);
								}
							},
						};

						this.#bindings.push(binding);
						this.#registerBinding(binding);
					}

					continue;
				}

				if (!attr.startsWith('[') || !attr.endsWith(']')) {
					continue;
				}

				const expression = el.getAttribute(attr),
					bindingAttr = attr.slice(1, -1);

				const propName = kebabToCamel(bindingAttr);

				const binding = {
					expression,
					element: el,
					update: (value) => {
						if (value === EVALUATION_ERROR) {
							el[propName] = null;
						} else {
							el[propName] = value;
						}
					},
				};

				this.#bindings.push(binding);
				this.#registerBinding(binding);
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
							const componentShadowRoot = parent.shadowRoot;

							if (componentShadowRoot && componentShadowRoot.contains(innerNode)) {
								return NodeFilter.FILTER_REJECT;
							}
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

					const binding = {
						expression,
						element: newTextNode,
						update: (value) => {
							if (value === EVALUATION_ERROR) {
								newTextNode.textContent = '';
							} else {
								newTextNode.textContent = value ?? '';
							}
						},
					};

					this.#bindings.push(binding);
					this.#registerBinding(binding); // NEW: Register for tracking

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
	 * Also processes if directives and nested for-each directives within the loop context.
	 * @param {DocumentFragment|HTMLElement} root - The root element to parse
	 * @param {Object<string, any>} context - The context object containing loop variables
	 * @private
	 */
	#parseTemplateInContext(root, context) {
		// First, handle nested for-each directives (MUST be done before if directives)
		const forElements = root.querySelectorAll ? root.querySelectorAll('[for-each]') : [],
			// Second, handle if directives within this context
			ifElements = root.querySelectorAll ? root.querySelectorAll('[if]') : [],
			textNodes = [];
		let iter = null,
			node = null,
			elements = [];

		for (const el of forElements) {
			const forExpr = el.getAttribute('for-each'),
				[itemName, itemsExpr] = forExpr.split(' in ').map((s) => s.trim()),
				placeholder = document.createComment('for-each'),
				template = document.importNode(el, true);

			template.removeAttribute('for-each');
			el.parentElement.insertBefore(placeholder, el);
			el.remove();

			// CRITICAL FIX: Register nested for-each as a directive so it can update
			const directive = {
				itemsExpr,
				itemName,
				placeholder,
				template,
				parentContext: context, // Store parent context for nested evaluation
			};

			this.#forEachDirectives.push(directive);
			this.#registerForEachDirective(directive);

			// Store the parent loop context on the placeholder itself for easy access
			// This ensures #getLoopContext can find it even if placeholder moves
			placeholder.sprooLoopContext = context;

			// Evaluate the items expression in the current context for initial render
			try {
				const items = this.#evaluateExpression(itemsExpr, context);

				if (Array.isArray(items)) {
					// Process each item immediately in this context
					for (const [index, item] of items.entries()) {
						const clone = document.importNode(template, true),
							nestedContext = {
								...context,
								[itemName]: item,
								index,
							};

						clone.sprooForEachItem = true;
						clone.sprooLoopContext = nestedContext;

						placeholder.parentElement.insertBefore(clone, placeholder);

						// Recursively parse the cloned template with the nested context
						this.#parseTemplateInContext(clone, nestedContext);
					}
				}
			} catch (e) {
				// Log nested for-each evaluation errors
				console.warn(`[Sproo] Nested for-each evaluation error: "${ itemsExpr }"`, e);
			}
		}

		for (const el of ifElements) {
			const condition = el.getAttribute('if'),
				placeholder = document.createComment('if'),
				template = document.importNode(el, true);
			let ifDirective = null;

			template.removeAttribute('if');

			el.parentElement.insertBefore(placeholder, el);
			el.remove();

			ifDirective = {
				condition,
				placeholder,
				template,
				inserted: null,
				context, // Store the loop context for this if directive
			};

			this.#ifDirectives.push(ifDirective);

			// Immediately evaluate this if directive
			try {
				const shouldShow = this.#evaluateExpression(ifDirective.condition, ifDirective.context || {});

				if (shouldShow) {
					const clone = document.importNode(ifDirective.template, true);
					let bindingsToUpdate = null;

					ifDirective.placeholder.parentElement.insertBefore(clone, ifDirective.placeholder);
					ifDirective.inserted = clone;

					// Parse any bindings in the inserted content
					this.#parseBindingsInTemplate(clone);
					this.#parseEventHandlers(clone, context);

					// Update any bindings in the clone
					bindingsToUpdate = this.#bindings.filter(
						(binding) => binding.element && clone.contains(binding.element),
					);

					for (const binding of bindingsToUpdate) {
						try {
							const value = this.#evaluateExpression(binding.expression, context);

							binding.update(value);
						} catch (e) {
							// Log error and clear stale data
							console.warn(`[Sproo] Loop context if directive binding error: "${ binding.expression }"`, e);
							binding.update(null);
						}
					}
				}
			} catch (e) {
				// Log if directive evaluation errors
				console.warn(`[Sproo] Loop context if directive evaluation error: "${ condition }"`, e);
			}
		}

		// Handle text nodes
		iter = document.createNodeIterator(root, NodeFilter.SHOW_TEXT);
		node = iter.nextNode();

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
						// Log error and insert empty text
						console.warn(`[Sproo] Loop context text interpolation error: "${ expression }"`, e);
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
				if (attr.startsWith(':')) {
					const actualAttr = attr.slice(1);
					const expression = el.getAttribute(attr);

					try {
						const value = this.#evaluateExpression(expression, context);

						if (actualAttr === 'innerHTML') {
							el.innerHTML = value ?? '';
						} else if (actualAttr.startsWith('class.')) {
							const className = actualAttr.substring(6);

							if (value) {
								el.classList.add(className);
							} else {
								el.classList.remove(className);
							}
						} else if (value !== null && typeof value !== 'undefined') {
							// Set property first if special handling is needed
							if (PROPERTY_BINDINGS[actualAttr]) {
								PROPERTY_BINDINGS[actualAttr](el, value);
							}

							// Always set the attribute as well
							el.setAttribute(actualAttr, value);
						} else {
							// Clear property for null/undefined values
							if (PROPERTY_BINDINGS[actualAttr]) {
								PROPERTY_BINDINGS[actualAttr](el, '');
							}
						}
					} catch (e) {
						console.warn(`[Sproo] Loop context attribute binding error: "${ expression }"`, e);
					}

					continue;
				}

				if (!attr.startsWith('[') || !attr.endsWith(']')) {
					continue;
				}

				const expression = el.getAttribute(attr);

				try {
					const value = this.#evaluateExpression(expression, context),
						bindingAttr = attr.slice(1, -1);

					const propName = kebabToCamel(bindingAttr);

					el[propName] = value;
				} catch (e) {
					console.warn(`[Sproo] Loop context attribute binding error: "${ expression }"`, e);
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
		const perfTimer = this.#perfStart('Evaluate Expression');

		try {
			if (SIMPLE_PROPERTY_REGEX.test(expression) && !expression.includes('(')) {
				const result = this.#getProperty(expression, additionalContext);

				this.#perfEnd(perfTimer, {
					expression,
					type: 'property',
					success: true,
				});

				return result;
			}

			const context = {...this.#getContext(), ...additionalContext},
				methods = this.#getMethods(),
				fullContext = {...context, ...methods},

				args = Object.keys(fullContext),
				values = Object.values(fullContext),
				// We need eval here, one way or another.
				// eslint-disable-next-line no-new-func
				func = new Function(...args, `return ${ expression }`);

			const result = func.apply(this, values);

			this.#perfEnd(perfTimer, {
				expression,
				type: 'function',
				success: true,
			});

			return result;
		} catch (error) {
			this.#perfEnd(perfTimer, {
				expression,
				type: 'error',
				error: error.message,
			});

			// Log warning similar to Vue's behavior
			if (this.logger && this.logger.warn) {
				this.logger.warn(`Error evaluating expression "${ expression }":`, error.message);
			} else {
				console.warn(`[Sproo] Error evaluating expression "${ expression }":`, error.message);
			}

			// Return error symbol to signal failed evaluation
			return EVALUATION_ERROR;
		}
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
		try {
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
		} catch (error) {
			// Log warning for property access errors
			if (this.logger && this.logger.warn) {
				this.logger.warn(`Error accessing property "${ path }":`, error.message);
			} else {
				console.warn(`[Sproo] Error accessing property "${ path }":`, error.message);
			}

			return EVALUATION_ERROR;
		}
	}

	/**
	 * Gets all reactive properties and getters from the component.
	 * Returns properties stored with underscore prefix (e.g., _propertyName) and any getters.
	 * @returns {Object<string, any>} Object containing all reactive properties and getters
	 * @private
	 */
	#getContext() {
		const context = {};

		// Get reactive properties (those with _ prefix)
		for (const key in this) {
			if (key.startsWith('_') && !key.startsWith('__')) {
				context[key.substring(1)] = this[key];
			}
		}

		// Also get properties with getters from the prototype chain
		let proto = Object.getPrototypeOf(this);

		while (proto && proto !== HTMLElement.prototype) {
			const descriptors = Object.getOwnPropertyDescriptors(proto);

			for (const [name, descriptor] of Object.entries(descriptors)) {
				// Skip private properties, constructor, and properties already in context
				if (name.startsWith('_') ||
					name.startsWith('#') ||
					name === 'constructor' ||
					Object.prototype.hasOwnProperty.call(context, name)) {
					continue;
				}

				// If it has a getter, evaluate it and add to context
				if (descriptor.get && typeof descriptor.get === 'function') {
					try {
						context[name] = this[name];
					} catch (e) {
						// Skip if getter throws
					}
				}
			}

			proto = Object.getPrototypeOf(proto);
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

		while (proto && proto !== HTMLElement.prototype) {
			const names = Object.getOwnPropertyNames(proto);

			for (const name of names) {
				if (name.startsWith('_') ||
					name.startsWith('#') ||
					name === 'constructor' ||
					typeof this[name] !== 'function') {
					continue;
				}

				if (!methods[name]) {
					methods[name] = this[name].bind(this);
				}
			}

			proto = Object.getPrototypeOf(proto);
		}

		return methods;
	}

	/**
	 * Start performance measurement
	 * @param {string} label - Label for this measurement
	 * @returns {Object} Timer object with start time and metadata
	 * @private
	 */
	#perfStart(label) {
		if (!this.constructor.performanceTracking) {
			return null;
		}

		return {
			label,
			start: performance.now(),
			component: this.constructor.name,
			memory: performance.memory ? performance.memory.usedJSHeapSize : null,
		};
	}

	/**
	 * End performance measurement and optionally log
	 * @param {Object} timer - Timer object from #perfStart
	 * @param {Object} metadata - Additional data to log
	 * @private
	 */
	#perfEnd(timer, metadata = {}) {
		if (!timer) {
			return;
		}

		const duration = performance.now() - timer.start;
		const memoryDelta = performance.memory
			? performance.memory.usedJSHeapSize - timer.memory
			: null;

		const logEntry = {
			label: timer.label,
			component: timer.component,
			duration: duration.toFixed(2),
			timestamp: (new Date).toISOString(),
			memoryDelta: memoryDelta ? `${ (memoryDelta / 1024).toFixed(2) } KB` : 'N/A',
			...metadata,
		};

		this.constructor.performanceLog.push(logEntry);

		if (duration > this.constructor.performanceThreshold) {
			console.warn(`[Sproo Perf] ${ timer.label } took ${ duration.toFixed(2) }ms`, logEntry);
		}

		return logEntry;
	}

	/**
	 * Parses event handlers from elements with @eventName attributes.
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
				// Event handler: @click="handler"
				if (attr.startsWith('@')) {
					const eventName = attr.slice(1).trim();
					const handlerName = el.getAttribute(attr);

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
					dir.context = null;
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

	/**
	 * Get performance summary
	 * @returns {Object} Summary statistics
	 */
	static getPerformanceSummary() {
		if (this.performanceLog.length === 0) {
			return {message: 'No performance data collected'};
		}

		const byLabel = {};

		for (const entry of this.performanceLog) {
			if (!byLabel[entry.label]) {
				byLabel[entry.label] = {
					count: 0,
					totalDuration: 0,
					maxDuration: 0,
					minDuration: Infinity,
				};
			}

			const duration = parseFloat(entry.duration);

			byLabel[entry.label].count++;
			byLabel[entry.label].totalDuration += duration;
			byLabel[entry.label].maxDuration = Math.max(byLabel[entry.label].maxDuration, duration);
			byLabel[entry.label].minDuration = Math.min(byLabel[entry.label].minDuration, duration);
		}

		// Calculate averages
		for (const label in byLabel) {
			byLabel[label].avgDuration = (byLabel[label].totalDuration / byLabel[label].count).toFixed(2);
			byLabel[label].totalDuration = byLabel[label].totalDuration.toFixed(2);
			byLabel[label].maxDuration = byLabel[label].maxDuration.toFixed(2);
			byLabel[label].minDuration = byLabel[label].minDuration.toFixed(2);
		}

		return byLabel;
	}

	/**
	 * Print performance summary to console
	 */
	static printPerformanceSummary() {
		const summary = this.getPerformanceSummary();

		console.log('=== Sproo Performance Summary ===');
		console.table(summary);

		// Find slowest operations
		const sorted = Object.entries(summary).sort((a, b) =>
			parseFloat(b[1].totalDuration) - parseFloat(a[1].totalDuration),
		);

		if (sorted.length > 0) {
			console.log('\n=== Top 10 Slowest Operations (by total time) ===');
			console.table(sorted.slice(0, 10).reduce((acc, [label, stats]) => {
				acc[label] = stats;

				return acc;
			}, {}));
		}
	}

	/**
	 * Clear performance log
	 */
	static clearPerformanceLog() {
		this.performanceLog = [];
		console.log('[Sproo] Performance log cleared');
	}

	/**
	 * Export performance log as JSON
	 * @returns {string} JSON string of performance log
	 */
	static exportPerformanceLog() {
		return JSON.stringify(this.performanceLog, null, 2);
	}

	/**
	 * Get entries by component name
	 * @param {string} componentName - Component name to filter by
	 * @returns {Array} Filtered performance entries
	 */
	static getPerformanceByComponent(componentName) {
		return this.performanceLog.filter((entry) => entry.component === componentName);
	}
}
