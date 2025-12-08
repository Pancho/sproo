import services from './services.js';
import Loader from './utils/loader.js';
import {camelToKebab} from './utils/text.js';
import TemplateFragment from './template-fragment.js';


export default class Component extends HTMLElement {
	[Symbol.toStringTag] = 'Component';

	#rootFragment = null;
	#childComponents = [];
	#eventListeners = {};
	#isUpdating = false;
	#updatePromise = null;
	#isDestroyed = false;
	#propertiesToUpdate = new Set;

	templateLoaded;
	app;
	logger;

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
							typeof stylesheet === 'string' ? `${services.staticRoot}${stylesheet}` : stylesheet,
							resolve,
						);
					}),
				);
			}
		}

		this.app = services.app;

		if (this.constructor.registerComponents) {
			for (const component of this.constructor.registerComponents) {
				importPromises.push(import(`${services.staticRoot}${component}`));
			}
		}

		this.logger = services.getLogger(this.constructor);

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

					this.#rootFragment = new TemplateFragment(this, this.shadowRoot, {type: 'root'});
					this.#rootFragment.parse();

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

	#resolveTagName(clazz) {
		return `${services.appName}-${camelToKebab(clazz.name.replace('Component', ''))}`;
	}

	#makeReactive(propName) {
		const internalKey = `_${propName}`;

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
					this.#propertiesToUpdate.add(propName);

					this.#updatePromise = this.templateLoaded.then(() => {
						if (this.isConnected && !this.#isDestroyed) {
							this.#updateAllBindings();
						}
					});
				}
			},
		});
	}

	update(changes) {
		if (changes && typeof changes === 'object') {
			for (const [key, value] of Object.entries(changes)) {
				if (Object.prototype.hasOwnProperty.call(this, `_${key}`)) {
					this[`_${key}`] = value;
					this.#propertiesToUpdate.add(key);
				}
			}
		}

		this.#updatePromise = Promise.resolve().then(() => {
			if (!this.#isDestroyed) {
				this.#updateAllBindings();
			}
		});
	}

	async whenUpdated() {
		await this.templateLoaded;

		if (this.#updatePromise) {
			await this.#updatePromise;
		}
	}

	getContext() {
		const context = {};

		for (const key in this) {
			if (key.startsWith('_') && !key.startsWith('__')) {
				context[key.substring(1)] = this[key];
			}
		}

		let proto = Object.getPrototypeOf(this);

		while (proto && proto !== HTMLElement.prototype) {
			const descriptors = Object.getOwnPropertyDescriptors(proto);

			for (const [name, descriptor] of Object.entries(descriptors)) {
				if (name.startsWith('_') ||
					name.startsWith('#') ||
					name === 'constructor' ||
					Object.prototype.hasOwnProperty.call(context, name)) {
					continue;
				}

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

	getMethods() {
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

	#updateAllBindings() {
		if (this.#isUpdating || this.#isDestroyed) {
			return;
		}

		this.#isUpdating = true;

		try {
			this.onBeforeUpdate();

			this.#propertiesToUpdate.clear();

			if (this.#rootFragment) {
				this.#rootFragment.update(this.getContext());
			}

			const currentChildren = Array.from(this.shadowRoot.querySelectorAll('*'))
				.filter((el) => el instanceof Component && el !== this);

			this.#childComponents = this.#childComponents.filter((child) =>
				currentChildren.includes(child) && child.isConnected,
			);

			this.onAfterUpdate();
		} finally {
			this.#isUpdating = false;
		}
	}

	#parseReferences(root) {
		for (const el of root.querySelectorAll('[ref]')) {
			this[el.getAttribute('ref')] = el;
		}
	}

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

					if (services.router && !services.router.destroyed) {
						services.router.navigate(location, {
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

	listen(event, listener) {
		this.#eventListeners[event] = listener;
		this.addEventListener(event, this.#eventListeners[event]);
	}

	dispatch(eventName, detail = null) {
		this.dispatchEvent(new CustomEvent(eventName, {
			bubbles: true,
			composed: true,
			detail,
		}));
	}

	getElement(selector) {
		return this.shadowRoot.querySelector(selector);
	}

	getElements(selector) {
		return this.shadowRoot.querySelectorAll(selector);
	}

	disconnectedCallback() {
		this.#cleanup();
	}

	#cleanup() {
		if (this.#isDestroyed) {
			return;
		}

		this.#isDestroyed = true;

		if (this.#rootFragment) {
			this.#rootFragment.cleanup();
			this.#rootFragment = null;
		}

		for (const child of this.#childComponents) {
			if (child.isConnected) {
				child.disconnectedCallback();
			}
		}

		this.#childComponents = [];

		for (const [event, handler] of Object.entries(this.#eventListeners)) {
			this.removeEventListener(event, handler);
		}

		this.#eventListeners = {};
		this.#updatePromise = null;

		if (this.logger?.release) {
			this.logger.release();
		}

		this.logger = null;

		if (this.shadowRoot) {
			this.shadowRoot.adoptedStyleSheets = [];
			this.shadowRoot.innerHTML = '';
		}

		this.unload();
	}

	unload() {
	}

	onTemplateLoaded() {
	}

	// eslint-disable-next-line class-methods-use-this
	onBeforeUpdate() {
	}

	// eslint-disable-next-line class-methods-use-this
	onAfterUpdate() {
	}
}
