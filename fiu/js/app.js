import Router from './router.js';
import { Utils } from './utils.js';


export default class App {
	static instance;
	static staticRoot = '';
	static loggerFactory;
	router = null;
	http = null;
	ready = null;

	constructor(config) {
		let authenticationPath,
			authenticationPromise,
			httpPromise,
			loggingPromise,
			styleSheetPromises = [];

		if (!!App.instance) {
			throw new Error('Only one instance of App allowed');
		}

		if (!!config.staticRoot) {
			App.staticRoot = config.staticRoot;
		} else {
			App.staticRoot = '';
		}

		if (!!config.rootStylesheets) {
			config.rootStylesheets.forEach(stylesheet => {
				styleSheetPromises.push(new Promise(
					resolve => Utils.getCSS(typeof stylesheet === 'string' ? `${App.staticRoot}${stylesheet}` : stylesheet, resolve),
				));
			});
		}

		Promise.all([
			...styleSheetPromises,
		]).then(stylesheets => {
			document.adoptedStyleSheets = [...stylesheets];
		});

		if (!!config.httpEndpointStub) {
			httpPromise = import('./http.js');

			if (!!config.authenticationModule) {
				authenticationPath = config.authenticationModule;
			} else {
				authenticationPath = './authentication.js';
			}
			authenticationPromise = import(authenticationPath);
		}

		if (!!config.loggerConfig) {
			loggingPromise = import('./logging.js');
		}

		this.ready = new Promise(resolve => {
			Promise.all([authenticationPromise, httpPromise, loggingPromise]).then(
				([authenticationModule, httpModule, loggingFactoryModule]) => {

					if (!!httpModule && !!httpModule.default) {
						if (!authenticationModule || !authenticationModule.default) {
							throw new Error('Authentication failed to initialize');
						}
						this.http = new httpModule.default(config.httpEndpointStub, new authenticationModule.default());
					}

					if (!!loggingFactoryModule && !!loggingFactoryModule.default) {
						App.loggerFactory = new loggingFactoryModule.default();
						if (!!config.loggerConfig.level) {
							App.loggerFactory.setLogLevel(config.loggerConfig.level);
						}
						if (!!config.loggerConfig.handler) {
							App.loggerFactory.setEndpoint(config.loggerConfig.handler);
						}
					}
					this.router = new Router(
						config.routeRoot,
						config.homePage,
						config.notFound,
						config.routes,
						config.authenticationUrl,
					);

					if (Array.isArray(config.onAppReady)) {
						config.onAppReady.forEach(fn => fn(this));
					}
					resolve();
				},
			);
		});

		App.instance = this;  // Remove after done testing
	}

	get [Symbol.toStringTag]() {
		return 'App';
	}
}
