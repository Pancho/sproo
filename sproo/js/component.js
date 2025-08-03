import App from './app.js';
import DeepProxy from './utils/deepproxy.js';
import Loader from './utils/loader.js';

// Add 'u' flag to regex constants
const CLEAN_TRAILING_SLASH = /\/+$/u,
	CLEAN_LEADING_SLASH = /^\/+/u,
	TEXT_NODE_TAGS = /(\{\{.+?\}\})/u,
	FUNCTION_PREFIX = /^\w+\s*\(/u,
	FUNCTION_SUFFIX = /[!&|()]/,
	FUNCTION_REGEX = /^(\w+)\s*\(([^)]*)\)/u,
	WHITESPACE = /\s+/u,
	FORBIDDEN_VAR_SYNTAX = /^[0-9"'`]/u,
	SIMPLE_PROPERTY_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$.]*$/u,
	STRING_LITERALS = /'([^'\\]|\\.)*'|"([^"\\]|\\.)*"|`([^`\\]|\\.)*`/u,
	PROPERTY_ACCESS_PATTERN = /([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)/ug,
	ARRAY_DESTRUCTURING_PATTERN = /\[([^\]]+)\]\s*=/u,
	OBJECT_DESTRUCTURING_PATTERN = /\{([^}]+)}\s*=/,
	TERNARY_DESTRUCTURING_PATTERN = /[?:]/u,
	LOGICAL_OPERATORS_PATTERN = /&&|\|\||[!()]/u,
	ARITHMETIC_OPERATORS_PATTERN = /[-+*/=%<>]/u,
	JS_RESERVED_WORDS = new Set([
		'true',
		'false',
		'null',
		'undefined',
		'this',
		'new',
		'function',
		'class',
		'if',
		'else',
		'for',
		'while',
		'do',
		'try',
		'catch',
		'finally',
		'throw',
		'return',
		'break',
		'continue',
		'switch',
		'case',
		'default',
		'var',
		'let',
		'const',
	]),
	GLOBAL_OBJECTS = new Set([
		'App',
		'window',
		'document',
		'Component',
	]);

export default class Component extends HTMLElement {
	[Symbol.toStringTag] = 'Component';
	templateLoaded;
	bindingIndex = {};
	ifIndex = {};
	forEachIndex = {};

	constructor() {
		super();

		this.templateContext = {};
		this.attachShadow({mode: 'open'});

		const importPromises = [],
			templateReady = new Promise((resolve) => {
				if (this.constructor.template) {
					Loader.getTemplateHTML(this.constructor.template, resolve);
				} else {
					resolve();
				}
			}),
			styleSheetPromises = [];
		let componentReady = false;

		if (this.constructor.stylesheets) {
			this.constructor.stylesheets.forEach((stylesheet) => {
				styleSheetPromises.push(
					new Promise((resolve) => {
						Loader.getCSS(typeof stylesheet === 'string' ? `${App.staticRoot}${stylesheet}` : stylesheet, resolve);
					}),
				);
			});
		}

		if (this.constructor.registerComponents) {
			this.constructor.registerComponents.forEach((component) => {
				importPromises.push(import(component));
			});
		}

		this.app = App.instance;

		if (App.loggerFactory) {
			this.logger = App.loggerFactory.getLogger(this.constructor);
		} else {
			this.logger = new Proxy({}, {
				get: function () {
					return function () {
						throw new Error('To use logging (this.logger) you must setup logging (loggerConfig) in your App config');
					};
				},
			});
		}

		this.templateLoaded = new Promise((resolve) => {
			/* This is the list of all the properties on the Component instance. We use this to filter them out, so we're left only with the
			 properties on the inherited class's instance.
			*/
			const baseProperties = Object.keys(this);

			Promise.all([
				templateReady,
				...styleSheetPromises,
			]).then(([templateDocument, ...stylesheets]) => {
				const initialContext = {},
					obj = this;

				Object.getOwnPropertyNames(this)
					.filter((name) => !baseProperties.includes(name))
					.forEach(function (name) {
						const internalName = `sprooInternal-${name}`;

						initialContext[name] = obj[name];
						Object.defineProperty(obj, internalName, {
							writable: true,
							value: obj[name],
						});

						Object.defineProperty(obj, name, {
							get: function () {
								return obj[internalName];
							},
							set: function (value) {
								let setValue = value;

								if (componentReady && typeof setValue === 'object' && !(setValue instanceof Element)) {
									setValue = Component.newDeepProxy(setValue, name, obj);
								}

								obj[internalName] = setValue;
								Component.setContext(obj, null, obj, obj.shadowRoot, {[name]: setValue});
							},
						});

						/* For the variables containing immutable values, the proxy is not necessary, the wrapper is enough as only
						(re)assignments will change the values */
						if (typeof obj[name] !== 'object') {
							return false;
						}

						obj[name] = new DeepProxy(obj[name], {
							set(target, property) {
								if (Array.isArray(obj[internalName]) && property.includes('length')) {
									Component.setContext(obj, null, obj, obj.shadowRoot, {[name]: obj[internalName]});
								} else {
									Component.setContext(obj, null, obj, obj.shadowRoot, {[name]: obj[internalName]});
								}
							},
						}).proxy;

						return false;
					});

				if (templateDocument instanceof Node) {
					this.shadowRoot.adoptedStyleSheets = [...stylesheets];
					this.shadowRoot.append(templateDocument);
					Component.parseReferences(this, this.shadowRoot);
					Component.parseTemplate(this, null, this, this.shadowRoot);
					Component.parseEventHandlers(this, this.shadowRoot);
					this.updatePageLinks(this.shadowRoot);
					Promise.all(importPromises).then(([...componentModules]) => {
						componentModules
							.filter((module) => !customElements.get(module.default.tagName))
							.forEach((module) => customElements.define(module.default.tagName, module.default));
						this.onTemplateLoaded();
						Component.setContext(this, null, this, this.shadowRoot, initialContext); // Force update
						resolve();
						componentReady = true;
					});
				}
			});
		});
	}

	static evaluateExpression(expression, context, component) {
		if (expression.startsWith('!') && SIMPLE_PROPERTY_REGEX.test(expression.slice(1))) {
			const baseValue = expression.slice(1).split('.').reduce((obj, prop) => obj?.[prop], context);

			return !baseValue;
		}

		if (SIMPLE_PROPERTY_REGEX.test(expression) && !expression.startsWith('!')) {
			return expression.split('.').reduce((obj, prop) => obj?.[prop], context);
		}

		try {
			const methods = {};
			let proto = Object.getPrototypeOf(component);

			while (proto && !proto.constructor.name.startsWith('HTML')) {
				Object.getOwnPropertyNames(proto)
					.filter((name) => typeof component[name] === 'function')
					.forEach((name) => {
						methods[name] = component[name].bind(component);
					});
				proto = Object.getPrototypeOf(proto);
			}

			const fullContext = {
					...methods,
					...context,
				},
				args = Object.keys(fullContext),
				values = Object.values(fullContext),
				// eslint-disable-next-line no-new-func
				func = new Function(...args, `return ${expression}`);

			return func.apply(component, values);
		} catch (e) {
			console.warn(`Error evaluating expression: ${expression}`, e);
			return null;
		}
	}

	updatePageLinks(doc) {
		doc.addEventListener('click', (event) => {
			let target = event.target;

			if (target instanceof Component || !doc.contains(target)) {
				return false;
			}

			for (; Boolean(target) && Boolean(target.parentElement); target = target.parentNode) {
				if (target.matches('[route]')) {
					if ((event.ctrlKey || event.metaKey) && event.target.tagName.toLowerCase() === 'a') {
						return false; // Could do preventDefault, but would return either way, so this is actually perfectly fine
					}

					const location = target.getAttribute('route');

					if (!this.app.router.destroyed) {
						event.preventDefault();
						this.app.router.navigate(
							location
								.replace(CLEAN_TRAILING_SLASH, '')
								.replace(CLEAN_LEADING_SLASH, '/'),
							{prevUrl: window.location.href, ...target.dataset}, // "cast" to dict
						);
					}

					break;
				}
			}

			return false; // Do not allow the click to the element actually do anything
		});
	}

	unloadComponent() {
		Array.from(this.getElements('*'))
			.filter((element) => element instanceof Component)
			.forEach((component) => {
				component.unloadComponent();
			});
		this.unload();
	}

	unload() {
	}

	/**
	 * This method runs after the template for this component is populated with template, so it's safe to start querying and manipulating
	 * its DOM. It's pretty similar to Angular's ngOnInit or ngAfterViewInit (not reflecting either, just similar). It accepts no parameters
	 * and returns none either. I mean... it can return whatever it wants, it's just very much ignored and might just pollute your memory.
	 */
	onTemplateLoaded() {
	}

	/*
	* This method has an "overridden" signature;
	*
	* If you supply only the name of the attribute, this method will fetch component's attribute by that name
	* If you supply both the name and value, this method will set this attribute for this component
	*/
	attribute(name, value) {
		if (value) {
			this.setAttribute(name, value);

			return value;
		}

		return this.getAttribute(name);
	}

	/*
	* Shorthand for this.shadowRoot.querySelector
	*/
	getElement(selector) {
		return this.shadowRoot.querySelector(selector);
	}

	/*
	* Shorthand for this.shadowRoot.querySelectorAll
	*/
	getElements(selector) {
		return this.shadowRoot.querySelectorAll(selector);
	}

	/*
	* Creates a new DOM element and populates it with supplied attributes
	*/
	newElement(tagName, attributes) {
		const newElement = document.createElement(tagName);

		Object.entries(attributes || {}).forEach((entry) => {
			newElement.setAttribute(...entry);
		});

		return newElement;
	}

	remove() {
		if (!this.parentElement) {
			return;
		}

		this.parentElement.removeChild(this);
	}

	dispatch(eventName, obj) {
		this.dispatchEvent(new CustomEvent(eventName, {
				bubbles: true,
				composed: true,
				payload: obj,
			},
		));
	}

	static parseReferences(component, templateDocument) {
		templateDocument.querySelectorAll('*').forEach((refElement) => {
			if (refElement.getAttribute('ref')) {
				component[refElement.getAttribute('ref')] = refElement;
			}
		});
	}

	static parseEventHandlers(component, templateDocument) {
		templateDocument.querySelectorAll('*').forEach((refElement) => {
			const attributeNames = refElement.getAttributeNames();

			if (refElement.eventListeners) {
				Object.entries(refElement.eventListeners).forEach(([event, listener]) => {
					refElement.removeEventListener(event, listener);
				});
			}

			if (attributeNames.length > 0) {
				attributeNames.forEach((attributeName) => {
					const attributeValue = refElement.getAttribute(attributeName);

					if (attributeName.startsWith('(') && attributeName.endsWith(')')) {
						const eventName = attributeName.replace('(', '').replace(')', '').trim();

						if (typeof component[attributeValue] === 'function') {
							if (!refElement.eventListeners) {
								refElement.eventListeners = {};
							}

							if (refElement.closest('[for-each-data]')) {
								refElement.eventListeners[eventName] = (ev) => {
									const sprooData = ev.target.closest('[for-each-data]').sproo,
										result = component[attributeValue](ev, sprooData);

									if (result === false) {
										ev.preventDefault();
										ev.stopPropagation();
									}
								};
							} else {
								refElement.eventListeners[eventName] = (ev) => {
									const result = component[attributeValue](ev);

									if (result === false) {
										ev.preventDefault();
										ev.stopPropagation();
									}
								};
							}

							refElement.addEventListener(eventName, refElement.eventListeners[eventName]);
						} else {
							console.warn(`Handler ${attributeValue} not present on component`);
						}
					}
				});
			}
		});
	}

	static parseTemplate(component, parent, owner, templateDocument) {
		// Console.time(`Process Template ${ templateDocument }`);
		Component.parseIf(component, parent, owner, templateDocument);
		Component.parseForEach(component, parent, owner, templateDocument);
		Component.parseSprooAttributes(component, parent, owner, templateDocument);
		Component.parseEventHandlers(component, templateDocument);
		Component.parseReferences(component, templateDocument);

		if (parent) {
			if (!parent.childBlocks) {
				parent.childBlocks = [];
			}

			if (!parent.childBlocks.includes(owner)) {
				parent.childBlocks.push(owner);
			}
		}

		// Console.timeEnd(`Process Template ${ templateDocument }`);
	}

	static extractVariables(expression) {
		const variables = new Set(),
			functions = new Set();

		// First handle function calls
		let modifiedExpr = expression;
		let functionMatch;
		while ((functionMatch = FUNCTION_REGEX.exec(modifiedExpr)) !== null) {
			if (FUNCTION_PREFIX.test(functionMatch[0])) {
				// Extract the function name
				functions.add(functionMatch[1]);
			}

			if (functionMatch[2]) {
				// Recursively extract variables from function parameters
				Component.extractVariables(functionMatch[2]).forEach(v => variables.add(v));
			}
			// Remove the processed function call to avoid re-processing
			modifiedExpr = modifiedExpr.replace(functionMatch[0], '');
		}

		function parseExpression(expr) {
			// Skip if empty or just whitespace
			if (!expr || !expr.trim()) {
				return;
			}

			// Remove string literals
			expr = expr.replace(STRING_LITERALS, '');

			// Handle object property access (both dot and bracket notation)
			const matches = expr.match(PROPERTY_ACCESS_PATTERN);
			if (matches) {
				matches.forEach(match => {
					// Get the base variable name (before any dots)
					const baseVar = match.split('.')[0];
					if (isValidVariable(baseVar) && !functions.has(baseVar)) {
						variables.add(baseVar);
					}
				});
			}

			// Handle array destructuring
			const destructuringMatch = expr.match(ARRAY_DESTRUCTURING_PATTERN);
			if (destructuringMatch) {
				destructuringMatch[1].split(',')
					.map(v => v.trim())
					.filter(v => isValidVariable(v) && !functions.has(v))
					.forEach(v => variables.add(v));
			}

			// Handle object destructuring
			const objDestructMatch = expr.match(OBJECT_DESTRUCTURING_PATTERN);
			if (objDestructMatch) {
				objDestructMatch[1].split(',')
					.map(v => v.split(':')[0].trim())
					.filter(v => isValidVariable(v) && !functions.has(v))
					.forEach(v => variables.add(v));
			}
		}

		function isValidVariable(name) {
			// Skip JavaScript keywords and literals
			return name &&
				!JS_RESERVED_WORDS.has(name) &&
				!GLOBAL_OBJECTS.has(name) &&
				!functions.has(name) &&
				!name.match(FORBIDDEN_VAR_SYNTAX) &&
				SIMPLE_PROPERTY_REGEX.test(name);
		}

		// Process the modified expression (after removing function calls)
		// Handle ternary operators
		const ternaryParts = modifiedExpr.split(TERNARY_DESTRUCTURING_PATTERN);
		ternaryParts.forEach(parseExpression);

		// Handle logical operators
		modifiedExpr.split(LOGICAL_OPERATORS_PATTERN).forEach(part => {
			parseExpression(part.trim());
		});

		// Handle arithmetic operations
		modifiedExpr.split(ARITHMETIC_OPERATORS_PATTERN).forEach(part => {
			parseExpression(part.trim());
		});

		return Array.from(variables);
	}

	static parseIf(component, parent, owner, templateDocument) {
		const refElements = templateDocument.querySelectorAll('[if]');

		refElements.forEach((refElement) => {
			if (refElement.closest('[for-each]')) {
				return false;
			}

			const attributeValue = refElement.getAttribute('if'),
				clone = document.importNode(refElement, true),
				ifElement = document.createElement('sproo-if'),

				// Extract the base variable name(s) that this if depends on
				variables = Component.extractVariables(attributeValue);

			// Register the if condition for each variable it depends on
			variables.forEach((variable) => {
				if (!owner.ifIndex[variable]) {
					owner.ifIndex[variable] = [];
				}

				owner.ifIndex[variable].push({
					template: clone,
					ifElement: ifElement,
					condition: attributeValue, // Store the original condition
				});
			});

			refElement.parentElement.insertBefore(ifElement, refElement);
			refElement.parentElement.removeChild(refElement);
			clone.removeAttribute('if');

			return false;
		});
	}

	static parseForEach(component, parent, owner, templateDocument) {
		const refElements = templateDocument.querySelectorAll('[for-each]');

		refElements.forEach((refElement) => {
			if (refElement.closest('[if]')) {
				return false;
			}

			const template = document.importNode(refElement, true),
				forElement = document.createElement('sproo-for-each'),
				split = refElement.getAttribute('for-each').split(' in '),
				itemName = split[0].trim(),
				itemsName = split[1].trim(),
				keyIdentifier = refElement.getAttribute('for-key');

			if (!owner.forEachIndex[itemsName]) {
				owner.forEachIndex[itemsName] = [];
			}

			refElement.parentElement.insertBefore(forElement, refElement);
			refElement.parentElement.removeChild(refElement);

			template.removeAttribute('for-each');
			template.setAttribute('for-each-data', '');
			owner.forEachIndex[itemsName].push({
				template: template,
				forElement: forElement,
				itemName: itemName,
				keyIdentifier: keyIdentifier,
				previousKeys: [],
				// We'll use map here, to keep element order, so we can use document fragment to reduce repaints when reacting to changes
				keyElementMapping: new Map,
			});

			return false;
		});
	}

	static parseSprooAttributes(component, parent, owner, templateDocument) {
		const iter = document.createNodeIterator(templateDocument, NodeFilter.SHOW_TEXT);
		let textNode = iter.nextNode();

		templateDocument.querySelectorAll('*').forEach((refElement) => {
			const attributeNames = refElement.getAttributeNames();

			if (attributeNames.length > 0) {
				attributeNames.forEach((attributeName) => {
					const attributeValue = refElement.getAttribute(attributeName);

					if (attributeName.startsWith('[') && attributeName.endsWith(']')) {
						let propertyName = attributeName.replace('[', '').replace(']', '').trim();

						if (propertyName.includes('.')) {
							propertyName = propertyName.replace('.', '\\.');
						}

						// Store both the target property and the expression
						owner.bindingIndex[attributeValue] = {
							property: propertyName,
							expression: attributeValue,
						};
					}
				});
			}
		});

		while (textNode) {
			const parentElement = textNode.parentNode;

			if (textNode.textContent.includes('{{') && !parentElement.closest('[for-each]')) {
				const nodes = [];

				textNode.textContent.split(TEXT_NODE_TAGS).filter(Boolean).forEach((part) => {
					if (part.startsWith('{{') && part.endsWith('}}')) {
						const expression = part.replace('{{', '').replace('}}', '').trim(),
							newNode = document.createTextNode(''),

							// Extract variable names from the expression
							variables = Component.extractVariables(expression);

						// If there are variables, set up bindings
						if (variables.length > 0) {
							variables.forEach((varName) => {
								if (!owner.bindingIndex[varName]) {
									owner.bindingIndex[varName] = [];
								}

								owner.bindingIndex[varName].push({
									node: newNode,
									expression: expression,
								});
							});
						} else {
							// No variables found, but we still need to evaluate the expression once
							// This handles cases like static function calls: getTranslation('Translation')
							newNode.textContent = Component.evaluateExpression(expression, {}, component);
						}

						nodes.push(newNode);
					} else {
						nodes.push(document.createTextNode(part));
					}
				});

				textNode.after(...nodes);
				parentElement.removeChild(textNode);
			}

			textNode = iter.nextNode();
		}
	}

	static processIf(component, parent, owner, key, inheritedContext) {
		owner.ifIndex[key].forEach((entry) => {
			// Use the original condition stored during parsing
			const evaluatedValue = Component.evaluateExpression(entry.condition, inheritedContext, component),
				template = document.importNode(entry.template, true),
				ifElement = entry.ifElement;

			if (evaluatedValue) {
				if (!entry.inserted) {
					template.bindingIndex = {};
					template.ifIndex = {};
					template.forEachIndex = {};

					Component.parseTemplate(component, owner, template, template);
					Component.setContext(component, owner, template, template, {...inheritedContext});

					if (ifElement.parentElement) {
						ifElement.parentElement.insertBefore(template, ifElement);
						ifElement.parentElement.removeChild(ifElement);
						entry.inserted = template;
					}
				}
			} else if (entry.inserted) {
				entry.inserted.parentElement.insertBefore(ifElement, entry.inserted);
				entry.inserted.parentElement.removeChild(entry.inserted);
				entry.inserted = false;
			}
		});
	}

	/*
	I'm borrowing optimization from alpinejs
	 */
	static processForEach(component, parent, owner, forKey, items, inheritedContext) {
		owner.forEachIndex[forKey].forEach((entry) => {
			const forElement = entry.forElement,
				itemName = entry.itemName,
				parentElement = forElement.parentElement,
				keyIdentifier = entry.keyIdentifier,
				documentFragment = document.createDocumentFragment(),
				endingAnchor = document.createElement('for-each-ending-anchor');
			let previousKeys = entry.previousKeys;

			if (keyIdentifier) {
				const keys = items.map((item) => keyIdentifier.split('.').reduce((previous, current) => previous[current], item)),
					adds = [],
					moves = [],
					removes = [],
					clonedKeyElementMapping = new Map;
				let lastKey = false;

				while (forElement.previousElementSibling) {
					const clone = document.importNode(forElement.previousElementSibling, true);

					clone.sproo = forElement.previousElementSibling.sproo;
					documentFragment.prepend(clone);
					clonedKeyElementMapping.set(
						keyIdentifier.split('.').reduce((previous, current) => previous[current], clone.sproo),
						clone,
					);
					parentElement.removeChild(forElement.previousElementSibling);
				}

				documentFragment.prepend(endingAnchor);

				previousKeys.forEach((key) => {
					if (keys.indexOf(key) === -1) {
						removes.push(key);
					}
				});
				previousKeys = previousKeys.filter((key) => !removes.includes(key));

				keys.forEach((key, index) => {
					const previousIndex = previousKeys.indexOf(key);

					if (previousIndex === -1) {
						previousKeys.splice(index, 0, key);
						adds.push([
							lastKey,
							index,
						]);
					} else if (previousIndex !== index) {
						const keyInSpot = previousKeys.splice(index, 1)[0],
							keyForSpot = previousKeys.splice(previousIndex - 1, 1)[0];

						previousKeys.splice(index, 0, keyForSpot);
						previousKeys.splice(previousIndex, 0, keyInSpot);

						moves.push([
							keyInSpot,
							keyForSpot,
						]);
					}

					lastKey = key;
				});

				removes.forEach((remove) => {
					clonedKeyElementMapping.get(remove).remove();
					clonedKeyElementMapping.delete(remove);
				});

				moves.forEach((move) => {
					const elementInSpot = clonedKeyElementMapping.get(move[0]),
						elementForSpot = clonedKeyElementMapping.get(move[1]),
						marker = document.createElement('for-each-marker');

					elementForSpot.after(marker);
					elementInSpot.after(elementForSpot);
					marker.before(elementInSpot);
					marker.remove();
				});

				adds.forEach((add) => {
					const [addLastKey, addIndex] = add,
						template = document.importNode(entry.template, true),
						anchor = addLastKey ? clonedKeyElementMapping.get(addLastKey) : endingAnchor;

					template.bindingIndex = {};
					template.ifIndex = {};
					template.forEachIndex = {};
					Component.parseTemplate(component, owner, template, template);

					Component.setContext(component, owner, template, template, {
						...inheritedContext,
						[itemName]: items[addIndex],
						index: addIndex,
					});
					template.sproo = items[addIndex];
					anchor.after(template);
					clonedKeyElementMapping.set(keys[addIndex], template);
				});

				entry.previousKeys = keys;
				entry.keyElementMapping = clonedKeyElementMapping;
				documentFragment.removeChild(endingAnchor);
			} else {
				while (forElement.previousElementSibling) {
					parentElement.removeChild(forElement.previousElementSibling);
				}

				items.forEach((item, index) => {
					const template = document.importNode(entry.template, true);

					template.bindingIndex = {};
					template.ifIndex = {};
					template.forEachIndex = {};
					Component.parseTemplate(component, owner, template, template);

					Component.setContext(component, owner, template, template, {
						...inheritedContext,
						[itemName]: item,
						index: index,
					});
					template.sproo = item;
					documentFragment.appendChild(template);
				});
			}

			parentElement.insertBefore(documentFragment, forElement);
		});
	}

	static setContext(component, parent, owner, templateDocument, change) {
		// Console.time(`Set context ${templateDocument}`);
		if (!Component.isObject(change)) {
			throw Error(`Context has to be updated with an object. Got ${change}`);
		}

		owner.templateContext = {
			...parent ? parent.templateContext : {},
			...owner.templateContext,
			...change,
		};

		Object.entries(change).forEach(([key, value]) => {
			const selectorKeys = Component.isObject(value) ? [
				key,
				...Component.spreadPath(key, value).flat(),
			] : [key];

			selectorKeys.forEach((selectorKey) => {
				if (selectorKey in owner.ifIndex) {
					owner.ifIndex[selectorKey].forEach(() => {
						Component.processIf(component, parent, owner, selectorKey, owner.templateContext);
					});
				}

				if (selectorKey in owner.forEachIndex) {
					const extractedValue = selectorKey.split('.').slice(1).reduce((previous, current) => previous[current], value);

					if (Component.isObject(extractedValue)) {
						Component.processForEach(
							component,
							parent,
							owner,
							selectorKey,
							Object.entries(extractedValue).map(([forKey, forValue]) => ({
								key: forKey,
								value: forValue,
							})), owner.templateContext);
					} else if (Array.isArray(extractedValue)) {
						Component.processForEach(component, parent, owner, selectorKey, extractedValue, owner.templateContext);
					}
				}

				if (selectorKey in owner.bindingIndex) {
					const binding = owner.bindingIndex[selectorKey];

					if (Array.isArray(binding)) {
						// Handle text node bindings
						binding.forEach((bindingInfo) => {
							bindingInfo.node.textContent = Component.evaluateExpression(
								bindingInfo.expression,
								owner.templateContext,
								component,
							);
						});
					} else {
						// Handle attribute bindings
						templateDocument.querySelectorAll(`[\\[${binding.property}\\]="${selectorKey}"]`)
							.forEach((elm) => {
								const evaluatedValue = Component.evaluateExpression(
									binding.expression,
									owner.templateContext,
									component,
								);

								if (binding.property.includes('.')) {
									const split = binding.property.split('\\.');

									if (split[0] === 'attr') {
										elm.setAttribute(split[1], evaluatedValue);
									} else if (split[0] === 'style') {
										elm.style[split[1]] = evaluatedValue;
									}
								} else if (elm instanceof Component) {
									elm.templateLoaded.then(() => {
										elm[binding.property] = evaluatedValue;
									});
								} else {
									if (elm.hasOwnProperty(binding.property)) {
										elm[binding.property] = evaluatedValue;
									} else {
										elm.setAttribute(binding.property, evaluatedValue);
									}
								}
							});
					}
				}
			});
		});

		if (Array.isArray(owner.childBlocks)) {
			owner.childBlocks.forEach((childBlock) => Component.setContext(component, owner, childBlock, childBlock, change));
		}
		// Console.timeEnd(`Set context ${templateDocument}`);
	}

	static spreadPath(key, value) {
		return Object.keys(value).map((innerKey) => {
			if (Component.isObject(value[innerKey])) {
				return [
					`${key}.${innerKey}`,
					Component.spreadPath(innerKey, value[innerKey]).map(
						(newKey) => `${key}.${newKey}`,
					),
				].flat();
			}

			return `${key}.${innerKey}`;
		});
	}

	static isObject(obj) {
		return Object.prototype.toString.call(obj) === '[object Object]';
	}

	static newDeepProxy(value, name, obj) {
		return new DeepProxy(value, {
			set: function (target, property) {
				if (Array.isArray(value) && property.includes('length')) {
					Component.setContext(obj, null, obj, obj.shadowRoot, {[name]: value});
				} else {
					Component.setContext(obj, null, obj, obj.shadowRoot, {[name]: value});
				}
			},
		}).proxy;
	}

	// https://stackoverflow.com/a/48218209
	static deepMerge(...objects) {
		return objects.reduce((previous, current) => {
			Object.keys(current).forEach((key) => {
				const previousValue = previous[key],
					currentValue = current[key];

				if (Array.isArray(previousValue) && Array.isArray(currentValue)) {
					previous[key] = previousValue.concat(...currentValue);
				} else if (Component.isObject(previousValue) && Component.isObject(currentValue)) {
					previous[key] = Component.deepMerge(previousValue, currentValue);
				} else {
					previous[key] = currentValue;
				}
			});

			return previous;
		}, {});
	}
}
