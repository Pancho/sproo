import { Authentication } from './authentication.js';
import { Component } from './component.js';
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
		routeRoot,
		homePage,
		notFound,
		routes,
		defaultPageName,
		defaultComponents,
		defaultStylesheets,
		authenticationClass,
		authenticationUrl,
		httpEndpointStub,
		providers,
		loggerConfig,
		onAppReady,
	) {
		let authentication;

		if (!!App.instance) {
			throw new Error('Only one instance of App allowed');
		}

		if (!!defaultStylesheets) {
			Utils.applyCss(defaultStylesheets, document);
		}

		if (!!providers) {
			providers.forEach(provider => App.provide(...provider));
		}

		if (!!loggerConfig) {
			if (!!loggerConfig.endpoint) {
				App.loggerFactory.setEndpoint(loggerConfig.endpoint);
			}
			if (!!loggerConfig.level) {
				App.loggerFactory.setLogLevel(loggerConfig.level);
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
				if (!!defaultComponents) {
					defaultComponents.forEach((component) => {
						Component.attachObservedAttributes(component);
						customElements.define(component.tagName, component);
					});
				}

				this.router = new Router(routeRoot, homePage, notFound, routes, defaultPageName, authenticationUrl);

				if (!!authenticationClass) {
					authentication = new authenticationClass();
				} else {
					authentication = new Authentication();
				}

				this.http = new Http(httpEndpointStub, authentication);

				onAppReady.forEach(fn => fn());

				resolve();
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
