'use strict';
import { App } from './app.js';
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
* class Navigation extends HTMLElement { // What a time we live in... JS has classes now, and COVID-19 is reducing us into 17th century plebs.
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
*           style.textContent = '\/* a bunch of css... that gets inserted into every single instance of this component class... neat, possibly a single large css or generated poop from a scss file *\/';
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
* import { Component } from './sablono/fiu/component.js';
*
* export class TagComponent extends Component {
* 	static tagName = 'tag';
* 	static template = 'domain/tag';
* 	static stylesheets = [
* 		'reset',
* 		'domain/tag',
* 	];
*
* 	constructor(params) { // For params, see sablono/fiu/router.js
* 		super(TagComponent);  // This is the price you pay to avoid carfuffle of dealing with styles and templates
*       // Your code here
* 	}
* }
*/
import { Utils } from './utils.js';

export class Component extends HTMLElement {
	// Registered components, a registry of sorts, but in reality it's just a plain ole list
	static registeredComponents = [];

	// This property tells whether this component has been removed from the host document
	unloaded = false;

	// Promise, for if you need to react on template loaded event, but aren't in the onTemplateLoaded method
	templateLoaded;

	/* Creates an instance of Component, which is really just a convenience wrapper for HTMLElement (the actual component)
	*
	* @constructor
	* @author: www.unuaondo.com
	* @param {class} clazz A JS class that would otherwise extend HTMLElement
	*/
	constructor(clazz) {
		super();

		if (!clazz) {
			throw Error('Please provide the class for the component constructor, as such: super(MySuperYetSimpleAndCertainlyNotHackedComponent);');
		}

		this.attachShadow({
			mode: 'open',
		});

		if (!!clazz.stylesheets) {
			Utils.applyCss(clazz.stylesheets, this.shadowRoot);
		}

		const injections = App.inject(clazz);
		Object.keys(injections).forEach((propertyName) => {
			this[propertyName] = injections[propertyName];
		});
		this.logger = App.loggerFactory.getLogger(clazz);

		if (!!clazz.registerComponents) {
			clazz.registerComponents.forEach((component) => {
				if (Component.registeredComponents.indexOf(component) === -1) {  // Should not load twice, right
					if (!component.manualAttributeHandling) {
						Component.attachObservedAttributes(component);
					}
					customElements.define(component.tagName, component);
					Component.registeredComponents.push(component);
				}
				Object.keys(injections).forEach((propertyName) => {
					component.prototype[propertyName] = injections[propertyName];
				});
			});
		}

		this.templateLoaded = new Promise(resolve => {
			if (!!clazz.template) {
				Utils.getTemplateHTML(clazz.template, this.shadowRoot, resolve);
			} else {
				resolve();
			}
		});

		Promise.all([
			App.appReady,
			this.templateLoaded,
		]).then(() => {
			this.app = App.instance;
			this.app.router.updatePageLinks(this.shadowRoot);
			// We'll just populate the extending's component's fields with elements found under selectors specified
			// This is here, because ES5 does not have decorators... should time arrive when vanilla JS supports decorators, this is the
			// first thing that goes
			// TODO: ES5 quirk
			Object.entries(this.populateFields()).forEach((entry, index) => {
				const field = entry[0],
					selector = entry[1];
				if (selector.startsWith('|all|')) {
					this[field] = this.getElements(selector.replace('|all|', ''));
				} else {
					this[field] = this.getElement(selector);
				}
			});
			this.onTemplateLoaded();
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
	* This method is here, because ES5 does not have any decorators or I'd solve this problem with those. So... the problem:
	*
	* NOBODY WANTS TO FETCH ELEMENTS THAT ARE EXPECTED TO BE PRESENT WHEN COMPONENT'S TEMPLATE IS LOADED!
	*
	* So, to remedy this, I provided this method that works like this:
	* ---return a dict with specs, that's it---
	*
	* This magic dict (do not try to repeat this 10 times!) should look like this:
	*
	* {
	*   myField: 'div h1'
	* }
	*
	* if you wish for (you repeated it 10 times, didn't you) your component to have this.myField populated with the DOM element reference to
	* that h1.
	*
	* If you wish to populate a field with a node list, the dict should look something like this:
	*
	* {
	*   myElements: '|all|ol li'
	* }
	*
	* Why on this green Earth have I resorted to gibberish like "|all|". It's simple: to not complicate too much with nested dicts or some
	* other solution, where you can choose which method to use, I resorted to a string which would produce an error if passed to
	* querySelector or querySelectorAll, so you'd immediately know something's wrong (instantfacepalmfailure).
	*/
	populateFields() {
		return {};
	}

	/*
	* This method has an "overridden" signature;
	*
	* If you supply only the name of the attribute, this method will fetch component's attribute by that name
	* If you supply both the name and value, this method will set this attribute for this component
	*/
	attribute(name, value) {
		if (value === undefined) {
			return this.getAttribute(name);
		} else {
			this.setAttribute(name, value);
		}
	}

	attributeJSON(name, value) {
		if (value === undefined) {
			return JSON.parse(this.getAttribute(name));
		} else {
			this.setAttribute(name, JSON.stringify(value));
		}
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

		Object.entries(attributes || {}).forEach((entry, index) => {
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

	static attachObservedAttributes(component) {
		const observedAttributes = [];
		Object.getOwnPropertyNames(component.prototype).forEach((classMember, index) => {
			if (classMember.startsWith('observe')) {
				observedAttributes.push(classMember.replace('observe', '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase());
			}
		});

		if (observedAttributes.length > 0) {
			// Since this is a static property, we need to be sure, we don't try to redefine it, as the whole app goes kabloomey
			if (Object.getOwnPropertyNames(component).indexOf('observedAttributes') === -1) {
				Object.defineProperty(component, 'observedAttributes', {
					get() {
						return observedAttributes;
					},
				});

				const changeResolvers = {};
				observedAttributes.forEach((attribute, index) => {
					component.prototype[attribute.replace(/-./g, x => x.toUpperCase()[1]) + 'Change'] = function (resolve) {
						changeResolvers[
						'observe' + attribute.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')
							] = resolve;
					};
				});
				component.prototype.attributeChangedCallback = function (name, oldValue, newValue) { // We must use "function" here, since we need "this" to be bound to the actual component instance, not the Component class
					const method = 'observe' + name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
					this[method](oldValue, newValue);
					if (!!changeResolvers[method]) {
						changeResolvers[method](oldValue, newValue);
					}
				};
			}
		}
	}
}
