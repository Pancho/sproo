import App from './app.js';
import utils from './utils/index.js';

/* I wanted to have this "middleman", due to JS not supporting real decorators yet, to avoid boilerplate in the actual
* component/element class implementation. I insist on not using babels and some obscure pollyfills, to achieve decorator like effect,
* both of which require one quarter of npm dependencies to produce sub-par, bloated, unreadable cesspool of JS code in the end (let's
* not forget the .map.js files, which totally solve this and they are absolutely not clutter or an anti-pattern in this case), all to
* avoid having this meh-hack.
*
* Usage:
*
* Let's suppose you wanted to have a custom html element with a tag named "navigation". First you would have to define a new class, as such:
*
* class Navigation extends HTMLElement { // What a time to live in... JS has classes now, and COVID-19 has reduced us to 17th century plebs.
*       constructor() {
*           super(); // Yes, semicolons are super important!
*       }
* }
*
* Next, you would have to define this element, so the browser knows what you intended in the first place:
*
* customElements.define('navigation', Navigation); // This will execute the constructor of the Navigation class for each and every
* <navigation> element in your html (past, present and future)
*
*
* But then you also have to include some CSS and render a template...
*
* class Navigation extends HTMLElement {
*       constructor() {
*           super(); // Yes, semicolons are still important
*           const shadowRoot = this.attachShadow({ mode: 'open' }), // For instance
*               style = document.createElement('style'),
*               template = '<div><p>Some text in my awesome component</p></div>',
*               someElement = document.createElement('some');
*
*           style.textContent = '\/* a bunch of css... *\/'';
*           shadowRoot.append(style);
*           shadowRoot.append(someElement);
*           // or
*           this.innerHTML = template; // Or some other way
*           shadowRoot.append(style);
*       }
* }
*
* This way each instance gets it's own style tag with possibly more CSS that it needs and templates are a part of the class, which might
* sound convenient but is really not.
*
* What we want is an Angular like component, but done in the spirit of WebComponents API and not some über hack that downloads everyone's
* JavaScript from npm, needs Webpack and NodeJS to work and works through TypeScript and and and is mangled beyond anything you could call
* JavaScript any more (you can always go back to 90' and start writing Java Swing components if you really are a masochist). oh, and if you
* are using Angular for your 5 users a month page, don't do it the pleb way, use ramda to write an if/else with no less than 5 functions!
* (to authors of ramda: it's awesome, it really is, but users often do things that are irrational... borderline insane even)
*
* Component class will solve some of these problems for you. Each class that extends Component, should expose these four static (must be
* static) members:
*
* 1. tagName - the name of the tag
* 2. template - path to the template, without the html extension, which Component expects!
* 3. stylesheets - a *list* of css you want this component to use
* 4. registerComponents - a *list* of component classes that will be used in the context of this component
* 5. observedAttributes - a mapping (dict) of attributes you wish to watch for changes on this component
*
*
* ---tagName---
* This one is simple; if you want to associate your component with the tag <tag> then you should set template member to 'tag'
*
*
* ---template---
* This one might not be simple, but let's try. Each component can use an html file (it doesn't have to, though!) that will serve as the
* template for the innards of the component. If you don't like the paths, feel free to configure them via App settings. But in essence, all
* you have to do is create the template file in the right folder, as such:
*
* /media
*   /js
*       /sablono
*           /fiu
*               ...files
*           /components
*               ...files
*           /domain
*               tag.js (class that extends Component)
*   my-app-file.js
*   conf-file-you-were-looking-for-but-doesnt-exist.js
*   conf-file-for-something-else-you-were-looking-for-but-doesnt-exist.js
*   conf-file-for-something-that-will-make-your-app-super-slow-you-were-looking-for-but-doesnt-exist.js
*   /css
*       /sablono
*           reset.css
*           /domain
*               tag.css
*   /templates
*       /sablono
*           /components
*               ...files
*           /domain
*               tag.html <----- this is the template (if you keep the default folder structure, which you don't need to do)
*
* In such scenario, you would set template member to 'domain/tag' (no .html necessary, as this extension is not negotiable, we don't want
* to preprocess anything!).
*
* VERY IMPORTANT: If you wish to handle your templates on your own, just don't declare this member or set it to a falsy value.
*
* ---stylesheets---
* If we arrived this far, we are familiar with the folder structure at least a bit, in which case this one's easy as well. This functions
* very much like the template, except it's a list, which means you can include more than one css file for one component (which makes sense).
*
* VERY IMPORTANT: If you wish to handle your stylesheets on your own, just don't declare this member or set it to a falsy value.
*
* ---registerComponents---
* This is just a simple list of classes (classes, not strings, like names of classes or class instances, class objects) of the components
* that you want to be loaded when this Component instance is set up (think: child components). This cascades (A registers B which registers
* C that registers D and from here on you are probably just complicating) and it probably is smart to let this cascade, so you don't
* actually add clutter instead of removing it. With this simple trick, we totally and completely avoid modules and a ton of configuration.
*
* VERY IMPORTANT: If you wish to register your components on your own, just don't declare this member or set it to a falsy value.
*
*
* ---observedAttributes--- TODO: finish
* This is a convenient way to attach mutation observers for attributes through a simple dictionary. Think two-way-binding.
*
*
* Why jump through all of these hoops? Well, templates are still more or less a matter of choice on how to use them, we just provided a
* convenient way to do it, but css files can be a problem; most tutorials on the internets suggest you include your styles into the
* component like in the example at the top, but that's ok for some demo component that uses 5 lines of CSS and even if there are 100
* instances of such component on your page it will not pose any real problem. But should your css be some legacy or some compiled sass
* file, you would feel the burn even if you had only 10 instances.
*
* What sablono does is use adoptedStyleSheets for each shadowRoot, so in reality only one instance of the StyleSheet is really loaded at
* once and then shared among all components that need it, so you could still use a large file, even though I strongly advise against that.
* I like what Angular is trying to do, except I really dislike how they do it... Could be worse though: some advise using some css selectors
* that either don't work or will not work in the near future. Maybe it's the spec that could use some more work?
*
* So... in the end, you would end with the folder structure mentioned at the "template" section and a class looking like this:
*
* import Component from './sablono/fiu/component.js';
*
* export class TagComponent extends Component {
*     static tagName = 'tag';
*     static template = 'domain/tag';
*     static stylesheets = [
*         'reset',
*         'domain/tag',
*     ];
*
*     constructor(params) { // For params, see sablono/fiu/router.js
*         super();
*         // Your code here
*     } // You may omit the constructor altogether
* }
*/


const CLEAN_TRAILING_SLASH = /\/+$/u,
	CLEAN_LEADING_SLASH = /^\/+/u,
	PROPERTY_NAMES_MAP = {'text-content': 'textContent'};


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
		Component.parseFiuAttributes(root, owner, templateDocument);
		Component.parseIf(owner, templateDocument);
		Component.parseForEach(owner, templateDocument);
	}

	static parseFiuAttributes(root, owner, templateDocument) {
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
									root[attributeValue](ev, fiuData.for.data, fiuData.for.index);
								}
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
					}
					/* See if one can bind everything before hand and then remove the binding attributes (at least in production) so the
						HTML looks better
					*/
					// RefElement.removeAttribute(attributeName);
				});
			}
		});
	}

	static parseForEach(owner, templateDocument) {
		let refElement = null;

		while (refElement = templateDocument.querySelector('[for-each]')) {
			const template = document.importNode(refElement, true),
				forElement = document.createElement('fiu-for-each'),
				split = refElement.getAttribute('for-each').split(' in '),
				itemName = split[0].trim(),
				itemsName = split[1].trim();

			if (!owner.forEachIndex[itemsName]) {
				owner.forEachIndex[itemsName] = [];
			}

			refElement.parentElement.insertBefore(forElement, refElement);
			refElement.parentElement.removeChild(refElement);
			owner.forEachIndex[itemsName].push({
				template: template,
				forElement: forElement,
				itemName: itemName,
			});
		}
	}

	static processForEach(root, owner, key, value, inheritedContext) {
		owner.forEachIndex[key].forEach((entry) => {
			const forElement = entry.forElement,
				itemName = entry.itemName,
				parent = forElement.parentElement;

			while (forElement.previousElementSibling) {
				parent.removeChild(forElement.previousElementSibling);
			}

			value.forEach((item, index) => {
				const template = document.importNode(entry.template, true);

				template.removeAttribute('for-each');
				template.setAttribute('for-each-data', '');

				template.bindingIndex = {};
				template.ifIndex = {};
				template.forEachIndex = {};
				Component.processTemplate(root, template, template);

				Component.setContext(root, template, template, {
					...inheritedContext,
					[itemName]: item,
					index: index,
				});
				template.fiu = {
					for: {
						data: item,
						index: index,
					},
				};
				parent.insertBefore(template, forElement);
			});
		});
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

	static processIf(root, owner, key, value, inheritedContext) {
		owner.ifIndex[key].forEach((entry) => {
			const elm = entry.elm,
				ifElement = entry.ifElement;

			if (value) {
				if (!elm.parentElement) {
					// We'll just clean the removed if element form the index, as it will get recreated if needed again.
					owner.ifIndex[key] = utils.uniqueBy(owner.ifIndex[key], item => item.ifElement);

					Component.processTemplate(root, root, elm);
					if (elm.querySelectorAll('[if]').length > 0) {
						Component.setContext(root, root, elm, {
							...inheritedContext,
						});
					}
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

	static setContext(root, owner, templateDocument, change) {
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
					const innerAttributeName = owner.bindingIndex[selectorKey];

					templateDocument.querySelectorAll(`[\\[${ innerAttributeName }\\]="${ selectorKey }"]`).forEach((elm) => {
						const boundValue = selectorKey.split('.').reduce((blob, prevKey) => blob[prevKey], change);

						if (innerAttributeName.includes('.')) {
							const split = innerAttributeName.split('\\.');

							if (split[0] === 'attr') {
								elm.setAttribute(split[1], boundValue);
							} else if (split[0] === 'style') {
								elm.style[split[1]] = boundValue;
							}
						} else if (elm instanceof Component) {
							elm.templateLoaded.then(() => {
								elm[innerAttributeName] = boundValue;
							});
						} else if (PROPERTY_NAMES_MAP[innerAttributeName]) {
							elm[PROPERTY_NAMES_MAP[innerAttributeName]] = boundValue;
						} else {
							elm[innerAttributeName] = boundValue;
						}
					});
				}
			});
		});
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
