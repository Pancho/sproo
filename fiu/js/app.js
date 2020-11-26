import { Authentication } from './authentication.js';
import { Http } from './http.js';
import { LoggerFactory } from './logging.js';
import { Router } from './router.js';
import { Utils } from './utils.js';

export class App {
	static instance;
	static appReady;
	static injectionRegistry = {};
	static loggerFactory = new LoggerFactory();
	router = null;
	http = null;

	constructor(config) {
		let authentication,
			styleSheetPromises = [];

		if (!!App.instance) {
			throw new Error('Only one instance of App allowed');
		}

		if (!!config.rootStylesheets) {
			config.rootStylesheets.forEach(stylesheet => {

				styleSheetPromises.push(new Promise(resolve => Utils.getCSS(stylesheet, resolve)));
			});
		}

		Promise.all([
			...styleSheetPromises,
		]).then(stylesheets => {
			document.adoptedStyleSheets = stylesheets;
		});

		if (!!config.providers) {
			config.providers.forEach(provider => App.provide(...provider));
		}

		if (!!config.loggerConfig) {
			if (!!config.loggerConfig.handler) {
				App.loggerFactory.setEndpoint(config.loggerConfig.handler);
			}
			if (!!config.loggerConfig.level) {
				App.loggerFactory.setLogLevel(config.loggerConfig.level);
			}
		} else {
			// Since it's expected that it's not referenced by anything else, we can expect GC will dispose of it.
			App.loggerFactory = null;
		}

		App.instance = this;
		App.appReady = new Promise(resolve => {
			// We must delay the initialization of the root components and router, as some modules used in this callback refer to the
			// App.appReady promise.
			setTimeout(() => {
				if (!!config.rootComponents) {
					config.rootComponents.forEach((component) => {
						if (!customElements.get(component.tagName)) {
							customElements.define(component.tagName, component);
						}
					});
				}

				this.router = new Router(
					config.routeRoot,
					config.homePage,
					config.notFound,
					config.routes,
					config.authenticationUrl,
				);

				if (!!config.authenticationClass) {
					authentication = new config.authenticationClass();
				} else {
					authentication = new Authentication();
				}

				if (!!config.httpEndpointStub) {
					this.http = new Http(config.httpEndpointStub, authentication);
				}

				if (Array.isArray(config.onAppReady)) {
					config.onAppReady.forEach(fn => fn(this));
				}

				resolve(this);
			});
		});

		return this;
	}

	get [Symbol.toStringTag]() {
		return 'App';
	}

	static provide(clazz, name, config) {
		const key = clazz.name;

		if (!App.injectionRegistry[key]) {
			App.injectionRegistry[key] = [];
		}
		if (!!config.useFactory) {
			App.injectionRegistry[key].push(function () {
				return {
					name,
					entity: config.useFactory(...config.params),
				};
			});
		} else if (!!config.useClass) {
			App.injectionRegistry[key].push(function () {
				return {
					name,
					entity: new config.useClass(...config.params),
				};
			});
		}
	}

	static inject(clazz) {
		let result = {};

		if (!App.injectionRegistry[clazz.name]) {
			return result;
		}

		App.injectionRegistry[clazz.name].forEach(injector => {
			const injection = injector();
			result = {
				...result,
				[injection.name]: injection.entity,
			};
		});

		return result;
	}
}
