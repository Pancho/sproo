import App from './app.js';
import utils from './utils/index.js';


const CLEAN_TRAILING_SLASH = /\/+$/u,
	CLEAN_LEADING_SLASH = /^\/+/u,
	TEXT_NODE_TAGS = /(\{\{.+?\}\})/u;


export default class Component extends HTMLElement {
	[Symbol.toStringTag] = 'Component';
	// Promise that's resolved when the onTemplateLoaded has already been executed
	templateLoaded;
	// Index of bound elements. Can change during runtime as it gets updated (or rather overwritten) on every mutation.
	bindingIndex = {};
	// If element Index
	ifIndex = {};
	// For-each element Index
	forEachIndex = {};

	/* Creates an instance of Component, which is really just a convenience wrapper for HTMLElement (the actual component)
	*
	* @constructor
	* @author: www.unuaondo.com
	*/
	constructor() {
		super();

		// Template context, from which the template gets updated
		this.templateContext = {};
		this.attachShadow({mode: 'open'});

		const importPromises = [],
			templateReady = new Promise((resolve) => {
				if (this.constructor.template) {
					utils.Loader.getTemplateHTML(this.constructor.template, resolve);
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
						utils.Loader.getCSS(typeof stylesheet === 'string' ? `${ App.staticRoot }${ stylesheet }` : stylesheet, resolve);
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
		}

		this.templateLoaded = new Promise((resolve) => {
			/* This is the list of all the properties on Component instance. We use this to filter them out, so we're left only with the
			 properties on the inherited class's instance.
			*/
			const baseProperties = Object.keys(this);

			Promise.all([templateReady, ...styleSheetPromises]).then(([templateDocument, ...stylesheets]) => {
				const initialContext = {},
					obj = this;

				Object.getOwnPropertyNames(this)
					.filter((name) => !baseProperties.includes(name))
					.forEach(function (name) {
						const internalName = `fiuInternal-${ name }`;

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
								if (componentReady && typeof value === 'object') {
									value = Component.newDeepProxy(value, name, obj);
								}
								obj[internalName] = value;
								Component.setContext(obj, null, obj, obj.shadowRoot, {[name]: value});
							},
						});

						/* For the variables containing immutable values, the proxy is not necessary, the wrapper is enough as only
						(re)assignments will change the values */
						if (typeof obj[name] !== 'object') {
							return false;
						}

						obj[name] = new utils.DeepProxy(obj[name], {
							set(target, property, value, receiver) {
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
							{...target.dataset}, // "cast" to dict
						);
					}

					break;
				}
			}

			return false; // Do not allow the click to the element actually do anything
		});
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
	* A shorthand for this.shadowRoot.querySelector
	*/
	getElement(selector) {
		return this.shadowRoot.querySelector(selector);
	}

	/*
	* A shorthand for this.shadowRoot.querySelectorAll
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
		this.dispatchEvent(new CustomEvent(eventName, obj));
	}

	static parseReferences(component, templateDocument) {
		templateDocument.querySelectorAll('*').forEach((refElement) => {
			if (refElement.getAttribute('fiu-ref')) {
				component[refElement.getAttribute('fiu-ref')] = refElement;
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
									const fiuData = ev.target.closest('[for-each-data]').fiu,
										result = component[attributeValue](ev, fiuData);

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
							console.warn(`Handler ${ attributeValue } not present on component`);
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
		Component.parseFiuAttributes(component, parent, owner, templateDocument);
		Component.parseEventHandlers(component, templateDocument);
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

	static parseIf(component, parent, owner, templateDocument) {
		let refElements = templateDocument.querySelectorAll('[if]');

		refElements.forEach((refElement) => {
			if (refElement.closest('[for-each]')) {
				return false;
			}

			const attributeValue = refElement.getAttribute('if'),
				clone = document.importNode(refElement, true),
				ifElement = document.createElement('fiu-if');

			if (!owner.ifIndex[attributeValue]) {
				owner.ifIndex[attributeValue] = [];
			}

			refElement.parentElement.insertBefore(ifElement, refElement);
			refElement.parentElement.removeChild(refElement);
			clone.removeAttribute('if');
			owner.ifIndex[attributeValue].push({
				template: clone,
				ifElement: ifElement,
			});
		});
	}

	static parseForEach(component, parent, owner, templateDocument) {
		let refElements = templateDocument.querySelectorAll('[for-each]');

		refElements.forEach((refElement) => {
			if (refElement.closest('[if]')) {
				return false;
			}

			const template = document.importNode(refElement, true),
				forElement = document.createElement('fiu-for-each'),
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
		});

		// let refElement = templateDocument.querySelector('[for-each]');
		//
		// while (refElement) {
		// 	const template = document.importNode(refElement, true),
		// 		forElement = document.createElement('fiu-for-each'),
		// 		split = refElement.getAttribute('for-each').split(' in '),
		// 		itemName = split[0].trim(),
		// 		itemsName = split[1].trim(),
		// 		keyIdentifier = refElement.getAttribute('for-key');
		//
		// 	if (!owner.forEachIndex[itemsName]) {
		// 		owner.forEachIndex[itemsName] = [];
		// 	}
		//
		// 	refElement.parentElement.insertBefore(forElement, refElement);
		// 	refElement.parentElement.removeChild(refElement);
		//
		// 	template.removeAttribute('for-each');
		// 	template.setAttribute('for-each-data', '');
		// 	owner.forEachIndex[itemsName].push({
		// 		template: template,
		// 		forElement: forElement,
		// 		itemName: itemName,
		// 		keyIdentifier: keyIdentifier,
		// 		previousKeys: [],
		// 		// We'll use map here, to keep element order, so we can use document fragment to reduce repaints when reacting to changes
		// 		keyElementMapping: new Map,
		// 	});
		// 	refElement = templateDocument.querySelector('[for-each]');
		// }
	}

	static parseFiuAttributes(component, parent, owner, templateDocument) {
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

						owner.bindingIndex[attributeValue] = propertyName;
					}
				});
			}
		});

		while (textNode) {
			const parentElement = textNode.parentNode;

			// If (textNode.textContent.includes('{{')) {
			if (textNode.textContent.includes('{{') && !parentElement.closest('[for-each]')) {
				const nodes = [];

				textNode.textContent.split(TEXT_NODE_TAGS).filter(Boolean).forEach((part) => {
					if (part.startsWith('{{') && part.endsWith('}}')) {
						const partCleaned = part.replace('{{', '').replace('}}', '').trim(),
							newNode = document.createTextNode('');

						if (!owner.bindingIndex[partCleaned]) {
							owner.bindingIndex[partCleaned] = [];
						}

						owner.bindingIndex[partCleaned].push(newNode);

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

	static processIf(component, parent, owner, key, value, inheritedContext) {
		owner.ifIndex[key].forEach((entry) => {
			const template = document.importNode(entry.template, true),
				ifElement = entry.ifElement;

			if (value) {
				if (!entry.template.parentElement) {
					// We'll just clean the removed "if" element form the index, as it will get recreated if needed again.
					owner.ifIndex[key] = utils.uniqueBy(owner.ifIndex[key], (item) => item.ifElement);

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
				parent = forElement.parentElement,
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

					clone.fiu = forElement.previousElementSibling.fiu;
					documentFragment.prepend(clone);
					clonedKeyElementMapping.set(
						keyIdentifier.split('.').reduce((previous, current) => previous[current], clone.fiu),
						clone,
					);
					parent.removeChild(forElement.previousElementSibling);
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
						adds.push([lastKey, index]);
					} else if (previousIndex !== index) {
						const keyInSpot = previousKeys.splice(index, 1)[0],
							keyForSpot = previousKeys.splice(previousIndex - 1, 1)[0];

						previousKeys.splice(index, 0, keyForSpot);
						previousKeys.splice(previousIndex, 0, keyInSpot);

						moves.push([keyInSpot, keyForSpot]);
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
					// This returns a list of bindings inside, and parent's fors (and ifs) should be notified somehow that they should update if that value changes
					Component.parseTemplate(component, owner, template, template);

					Component.setContext(component, owner, template, template, {
						...inheritedContext,
						[itemName]: items[addIndex],
						index: addIndex,
					});
					template.fiu = items[addIndex];
					anchor.after(template);
					clonedKeyElementMapping.set(keys[addIndex], template);
				});

				entry.previousKeys = keys;
				entry.keyElementMapping = clonedKeyElementMapping;
				documentFragment.removeChild(endingAnchor);
			} else {
				while (forElement.previousElementSibling) {
					parent.removeChild(forElement.previousElementSibling);
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
					template.fiu = item;
					documentFragment.appendChild(template);
				});
			}

			parent.insertBefore(documentFragment, forElement);
		});
	}

	static setContext(component, parent, owner, templateDocument, change) {
		// Console.time(`Set context ${templateDocument}`);
		if (!Component.isObject(change)) {
			throw Error(`Context has to be updated with an object. Got ${ change }`);
		}

		owner.templateContext = {
			...parent ? parent.templateContext : {},
			...owner.templateContext,
			...change,
		};

		Object.entries(change).forEach(([key, value]) => {
			const selectorKeys = Component.isObject(value) ? [key, ...Component.spreadPath(key, value).flat()] : [key];

			selectorKeys.forEach((selectorKey) => {
				if (selectorKey in owner.ifIndex) {
					const extractedValue = selectorKey.split('.').slice(1).reduce((previous, current) => previous[current], value);

					owner.ifIndex[selectorKey].forEach(() => {
						Component.processIf(component, parent, owner, selectorKey, extractedValue, owner.templateContext);
					});
				}

				if (selectorKey in owner.forEachIndex) {
					const extractedValue = selectorKey.split('.').slice(1).reduce((previous, current) => previous[current], value);

					if (Component.isObject(extractedValue)) {
						Component.processForEach(component, parent, owner, selectorKey, Object.entries(extractedValue).map(([forKey, forValue]) => ({
							key: forKey,
							value: forValue,
						})), owner.templateContext);
					} else if (Array.isArray(extractedValue)) {
						Component.processForEach(component, parent, owner, selectorKey, extractedValue, owner.templateContext);
					}
				}

				if (selectorKey in owner.bindingIndex) {
					const targetSelection = owner.bindingIndex[selectorKey],
						boundValue = selectorKey.split('.').reduce((blob, prevKey) => blob[prevKey], change);

					if (Array.isArray(targetSelection)) {
						targetSelection.forEach((textNode) => {
							textNode.textContent = boundValue;
						});
					} else {
						templateDocument.querySelectorAll(`[\\[${ targetSelection }\\]="${ selectorKey }"]`).forEach((elm) => {
							if (targetSelection.includes('.')) {
								const split = targetSelection.split('\\.');

								if (split[0] === 'attr') {
									elm.setAttribute(split[1], boundValue);
								} else if (split[0] === 'style') {
									elm.style[split[1]] = boundValue;
								}
							} else if (elm instanceof Component) {
								elm.templateLoaded.then(() => {
									elm[targetSelection] = boundValue;
								});
							} else {
								elm[targetSelection] = boundValue;
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
					`${ key }.${ innerKey }`, Component.spreadPath(innerKey, value[innerKey]).map(
						(newKey) => `${ key }.${ newKey }`,
					),
				].flat();
			}

			return `${ key }.${ innerKey }`;
		});
	}

	static isInChildBlock(refElement) {
		return Boolean(refElement.closest('[for-each]')) || Boolean(refElement.closest('[if]'));
	}

	static isObject(obj) {
		return Object.prototype.toString.call(obj) === '[object Object]';
	}

	static newDeepProxy(value, name, obj) {
		return new utils.DeepProxy(value, {
			set: function (target, property, x, y, z) {
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
			Object.keys(current).forEach(key => {
				const previousValue = previous[key];
				const currentValue = current[key];

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
