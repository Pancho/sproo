import Router from './router.js';
import Loader from './utils/loader.js';


export default class App {
	[Symbol.toStringTag] = 'App';
	static instance;
	static staticRoot = '';
	static loggerFactory;
    /**
     * @type {Router} The router instance
     */
	router = null;
    /**
     * @type {Http} The Http interface instance
     */
	http = null;
	ready = null;

	constructor(config) {
		let authenticationPath = '',
			authenticationPromise = null,
			httpPromise = null,
			loggingPromise = null;
		const styleSheetPromises = [];

		if (App.instance) {
			throw new Error('Only one instance of App allowed');
		}

		if (config.staticRoot) {
			App.staticRoot = config.staticRoot;
		} else {
			App.staticRoot = '';
		}

		if (config.rootStylesheets) {
			config.rootStylesheets.forEach((stylesheet) => {
				styleSheetPromises.push(new Promise(
					(resolve) => {
						Loader.getCSS(typeof stylesheet === 'string' ? `${ App.staticRoot }${ stylesheet }` : stylesheet, resolve);
					},
				));
			});
		}

		Promise.all([...styleSheetPromises]).then((stylesheets) => {
			document.adoptedStyleSheets = [...stylesheets];
		});

		if (typeof config.httpEndpointStub !== 'undefined') {
			httpPromise = import('./http.js');

			if (config.authenticationModule) {
				authenticationPath = config.authenticationModule;
			} else {
				authenticationPath = './authentication.js';
			}

			authenticationPromise = import(authenticationPath);
		}

		if (config.loggerConfig) {
			loggingPromise = import('./logging.js');
		}

		this.ready = new Promise((resolve) => {
			Promise.all([authenticationPromise, httpPromise, loggingPromise]).then(
				([authenticationModule, httpModule, loggingFactoryModule]) => {
					if (Boolean(httpModule) && Boolean(httpModule.default)) {
						if (!authenticationModule || !authenticationModule.default) {
							throw new Error('Authentication failed to initialize');
						}

						this.http = new httpModule.default(config.httpEndpointStub, new authenticationModule.default);
					}

					if (Boolean(loggingFactoryModule) && Boolean(loggingFactoryModule.default)) {
						App.loggerFactory = new loggingFactoryModule.default;

						if (config.loggerConfig.level) {
							App.loggerFactory.setLogLevel(config.loggerConfig.level);
						}

						if (config.loggerConfig.handler) {
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
						Promise.all(config.onAppReady.map((fn) => fn(this))).then(resolve);
					} else {
						resolve();
					}
				},
			);
		});

		App.instance = this; // Remove after done testing
	}
}
