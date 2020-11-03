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

	constructor(
		config,
	) {
		let authentication;

		if (!!App.instance) {
			throw new Error('Only one instance of App allowed');
		}

		if (!!config.rootStylesheets) {
			config.rootStylesheets.forEach(stylesheet => {
				Utils.applyCss(stylesheet, document);
			});
		}

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
			// We must delay the initialization of the root components and router, so that the Component classes have time to subscribe to
			// router's link handling, even if just by pushing everything to the end of the stack
			setTimeout(() => {
				if (!!config.rootComponents) {
					config.rootComponents.forEach((component) => {
						customElements.define(component.tagName, component);
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

				this.http = new Http(config.httpEndpointStub, authentication);

				config.onAppReady.forEach(fn => fn());

				resolve(this);
			});
		});

		return this;
	}

	static provide(clazz, name, config) {
		const key = clazz.name;

		if (!App.injectionRegistry[key]) {
			App.injectionRegistry[key] = [];
		}
		if (!!config.useFactory) {
			App.injectionRegistry[key].push(function () {
				return {name, entity: config.useFactory(...config.params)};
			});
		} else if (!!config.useClass) {
			App.injectionRegistry[key].push(function () {
				return {name, entity: new config.useClass(...config.params)};
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
