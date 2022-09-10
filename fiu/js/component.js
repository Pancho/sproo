import App from './app.js';
import utils from './utils/index.js';


const CLEAN_TRAILING_SLASH = /\/+$/u,
	CLEAN_LEADING_SLASH = /^\/+/u,
	TEXT_NODE_TAGS = /({{.+?}})/g;


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
								obj[internalName] = value;
								Component.setContext(obj, obj, obj.shadowRoot, {[name]: value});
							},
						});

						/* For the variables containing immutable values, the proxy is not necessary, the wrapper is enough as only
						(re)assignments will change the values */
						if (typeof obj[name] !== 'object') {
							return false;
						}

						obj[name] = new utils.DeepProxy(obj[name], {
							get: function (target, property, receiver) {
								return obj[internalName];
							},
							set: function (target, property, value, receiver) {
								if (!property.includes('length')) {
									Component.setContext(obj, obj, obj.shadowRoot, {[name]: obj[internalName]});
								}
							},
						});
					});

				if (templateDocument instanceof Node) {
					this.shadowRoot.adoptedStyleSheets = [...stylesheets];
					this.shadowRoot.append(templateDocument);
					Component.processTemplate(this, this, this.shadowRoot);
					this.updatePageLinks(this.shadowRoot);
					Promise.all(importPromises).then(([...componentModules]) => {
						componentModules
							.filter((module) => !customElements.get(module.default.tagName))
							.forEach((module) => customElements.define(module.default.tagName, module.default));
						this.onTemplateLoaded();
						Component.setContext(this, this, this.shadowRoot, initialContext); // Force update
						resolve();
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

	getStyleElement() {
		let style = this.getElement('style');

		if (!style) {
			style = this.newElement('style');
			this.shadowRoot.appendChild(style);
		}

		return style;
	}

	static processTemplate(root, owner, templateDocument) {
		// Console.time(`Process Template ${ templateDocument }`);
		Component.parseForEach(root, owner, templateDocument);
		Component.parseIf(owner, templateDocument);
		Component.parseFiuAttributes(root, owner, templateDocument);
		// Console.timeEnd(`Process Template ${ templateDocument }`);
	}

	static parseIf(owner, templateDocument) {
		let refElement = null;

		while (refElement = templateDocument.querySelector('[if]')) {
			const attributeValue = refElement.getAttribute('if');

			if (!owner.ifIndex[attributeValue]) {
				owner.ifIndex[attributeValue] = [];
			}

			const clone = document.importNode(refElement, true),
				ifElement = document.createElement('fiu-if');

			refElement.parentElement.insertBefore(ifElement, refElement);
			refElement.parentElement.removeChild(refElement);
			owner.ifIndex[attributeValue].push({
				elm: clone,
				ifElement: ifElement,
			});
		}
	}

	static parseForEach(root, owner, templateDocument) {
		let refElement = null;

		while (refElement = templateDocument.querySelector('[for-each]')) {
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
				keyElementMapping: new Map, // We'll use map here, to keep element order, so we can use document fragment to reduce repaints when reacting to changes
			});
		}
	}

	static parseFiuAttributes(root, owner, templateDocument) {
		const iter = document.createNodeIterator(templateDocument, NodeFilter.SHOW_TEXT);
		let textNode;

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

					if (attributeName === 'fiu-ref') {
						root[attributeValue] = refElement;
					} else if (attributeName.startsWith('(') && attributeName.endsWith(')')) {
						const eventName = attributeName.replace('(', '').replace(')', '').trim();

						if (typeof root[attributeValue] === 'function') {
							if (!refElement.eventListeners) {
								refElement.eventListeners = {};
							}

							if (refElement.closest('[for-each-data]')) {
								refElement.eventListeners[eventName] = (ev) => {
									const fiuData = ev.target.closest('[for-each-data]').fiu;

									root[attributeValue](ev, fiuData);
								};
							} else {
								refElement.eventListeners[eventName] = (ev) => {
									root[attributeValue](ev);
								};
							}

							refElement.addEventListener(eventName, refElement.eventListeners[eventName]);
						} else {
							console.warn(`Handler ${ attributeValue } not present on component`);
						}
					} else if (attributeName.startsWith('[') && attributeName.endsWith(']')) {
						let propertyName = attributeName.replace('[', '').replace(']', '').trim();

						if (propertyName.includes('.')) {
							propertyName = propertyName.replace('.', '\\.');
						}

						owner.bindingIndex[attributeValue] = propertyName;

						if (root !== owner && !(attributeValue in root.bindingIndex)) {
							root.bindingIndex[attributeValue] = propertyName;
						}
					}
					/* See if one can bind everything before hand and then remove the binding attributes (at least in production) so the
						HTML looks better
					*/
					// RefElement.removeAttribute(attributeName);
				});
			}
		});

		while (textNode = iter.nextNode()) {
			const parent = textNode.parentNode;

			// If (textNode.textContent.includes('{{')) {
			if (textNode.textContent.includes('{{') && !parent.closest('[for-each]')) {
				const nodes = [];

				textNode.textContent.split(TEXT_NODE_TAGS).filter(Boolean).forEach((part) => {
					if (part.startsWith('{{') && part.endsWith('}}')) {
						const partCleaned = part.replace('{{', '').replace('}}', '').trim(),
							newNode = document.createTextNode('');

						if (!owner.bindingIndex[partCleaned]) {
							owner.bindingIndex[partCleaned] = [];
						}

						owner.bindingIndex[partCleaned].push(newNode);

						if (root !== owner) {
							if (!root.bindingIndex[partCleaned]) {
								root.bindingIndex[partCleaned] = [];
							}

							root.bindingIndex[partCleaned].push(newNode);
						}

						nodes.push(newNode);
					} else {
						nodes.push(document.createTextNode(part));
					}
				});

				textNode.after(...nodes);
				parent.removeChild(textNode);
			}
		}
	}

	static processIf(root, owner, key, value, inheritedContext) {
		owner.ifIndex[key].forEach((entry) => {
			const elm = entry.elm,
				ifElement = entry.ifElement;

			if (value) {
				if (!elm.parentElement) {
					// We'll just clean the removed "if" element form the index, as it will get recreated if needed again.
					owner.ifIndex[key] = utils.uniqueBy(owner.ifIndex[key], (item) => item.ifElement);

					elm.bindingIndex = {};
					elm.ifIndex = {};
					elm.forEachIndex = {};
					Component.processTemplate(root, elm, elm);

					Component.setContext(root, elm, elm, {...inheritedContext});

					if (ifElement.parentElement) {
						ifElement.parentElement.insertBefore(elm, ifElement);
						ifElement.parentElement.removeChild(ifElement);
					}
				}
			} else if (elm.parentElement) {
				elm.parentElement.insertBefore(ifElement, elm);
				elm.parentElement.removeChild(elm);
			}
		});
	}

	/*
	I'm borrowing optimization from alpinejs
	 */
	static processForEach(root, owner, forKey, items, inheritedContext) {
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

				removes.forEach((remove, index) => {
					clonedKeyElementMapping.get(remove).remove();
					clonedKeyElementMapping.delete(remove);
				});

				moves.forEach((move, index) => {
					const elementInSpot = clonedKeyElementMapping.get(move[0]),
						elementForSpot = clonedKeyElementMapping.get(move[1]),
						marker = document.createElement('for-each-marker');

					elementForSpot.after(marker);
					elementInSpot.after(elementForSpot);
					marker.before(elementInSpot);
					marker.remove();
				});

				adds.forEach((add, index) => {
					const [lastKey, addIndex] = add,
						template = document.importNode(entry.template, true),
						anchor = lastKey ? clonedKeyElementMapping.get(lastKey) : endingAnchor;

					template.bindingIndex = {};
					template.ifIndex = {};
					template.forEachIndex = {};
					Component.processTemplate(root, template, template);
					Component.setContext(root, template, template, {
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
					Component.processTemplate(root, template, template);
					Component.setContext(root, template, template, {
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

	static setContext(root, owner, templateDocument, change) {
		// Console.time(`Set context ${templateDocument}`);
		if (!Component.isObject(change)) {
			throw Error(`Context has to be updated with an object. Got ${ change }`);
		}

		owner.templateContext = {
			...root.templateContext,
			...owner.templateContext,
			...change,
		};

		Object.entries(change).forEach(([key, value]) => {
			const selectorKeys = Component.isObject(value) ? [key, ...Component.spreadPath(key, value).flat()] : [key];

			selectorKeys.forEach((selectorKey) => {
				if (selectorKey === 'other.booleanValue') {
				}

				if (selectorKey in owner.ifIndex) {
					const extractedValue = selectorKey.split('.').slice(1).reduce((previous, current) => previous[current], value);

					owner.ifIndex[selectorKey].forEach((entry) => {
						Component.processIf(root, owner, selectorKey, extractedValue, owner.templateContext);
					});
				}

				if (selectorKey in owner.forEachIndex) {
					const extractedValue = selectorKey.split('.').slice(1).reduce((previous, current) => previous[current], value);

					if (Component.isObject(extractedValue)) {
						Component.processForEach(root, owner, selectorKey, Object.entries(extractedValue).map(([key, value]) => ({
							key: key,
							value: value,
						})), owner.templateContext);
					} else if (Array.isArray(extractedValue)) {
						Component.processForEach(root, owner, selectorKey, extractedValue, owner.templateContext);
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

	static isObject(obj) {
		return Object.prototype.toString.call(obj) === '[object Object]';
	}
}
