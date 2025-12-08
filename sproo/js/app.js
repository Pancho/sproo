import Router from './router.js';
import services from './services.js';
import ConfigValidator from './utils/config-validator.js';
import StylesheetLoader from './utils/stylesheet-loader.js';


export default class App {
	[Symbol.toStringTag] = 'App';
	static instance;

	router = null;
	http = null;
	ready = null;

	#destroyed = false;

	constructor(config) {
		if (App.instance) {
			throw new Error('Only one instance of App allowed');
		}

		ConfigValidator.validate(config);

		services.appName = config.appName;
		services.staticRoot = config.staticRoot || '';

		const styleSheetPromises = StylesheetLoader.load(config.rootStylesheets, services.staticRoot),
			authenticationPromise = this.#setupAuthentication(config),
			httpPromise = this.#setupHttp(config),
			loggingPromise = this.#setupLogging(config);

		this.ready = this.#initialize(
			config,
			styleSheetPromises,
			authenticationPromise,
			httpPromise,
			loggingPromise,
		);

		App.instance = this;
		services.app = this;
	}

	// eslint-disable-next-line class-methods-use-this
	#setupAuthentication(config) {
		if (typeof config.httpEndpointStub === 'undefined') {
			return null;
		}

		const authPath = config.authenticationModule || './authentication.js';

		return import(authPath).catch((error) => {
			console.error('Failed to load authentication module:', error);

			throw new Error('Authentication module is required when httpEndpointStub is configured');
		});
	}

	// eslint-disable-next-line class-methods-use-this
	#setupHttp(config) {
		if (typeof config.httpEndpointStub === 'undefined') {
			return null;
		}

		return import('./http.js').catch((error) => {
			console.error('Failed to load HTTP module:', error);

			throw error;
		});
	}

	// eslint-disable-next-line class-methods-use-this
	#setupLogging(config) {
		if (!config.loggerConfig) {
			return null;
		}

		return import('./logging.js').catch((error) => {
			console.error('Failed to load logging module:', error);

			throw error;
		});
	}

	async #initialize(config, styleSheetPromises, authenticationPromise, httpPromise, loggingPromise) {
		try {
			const stylesheetResults = await Promise.all(styleSheetPromises),
				stylesheets = stylesheetResults.filter((s) => s !== null),
				[authenticationModule, httpModule, loggingFactoryModule] = await Promise.all([
					authenticationPromise,
					httpPromise,
					loggingPromise,
				]);

			if (stylesheets.length > 0) {
				document.adoptedStyleSheets = [...stylesheets];
			}

			if (httpModule?.default) {
				if (!authenticationModule?.default) {
					throw new Error('Authentication module failed to initialize');
				}

				this.http = new httpModule.default(
					config.httpEndpointStub,
					new authenticationModule.default,
				);
				services.http = this.http;
			}

			if (loggingFactoryModule?.default) {
				services.loggerFactory = new loggingFactoryModule.default;

				if (config.loggerConfig.level) {
					services.loggerFactory.setLogLevel(config.loggerConfig.level);
				}

				if (config.loggerConfig.handler) {
					services.loggerFactory.setEndpoint(config.loggerConfig.handler);
				}
			}

			this.router = new Router(
				config.routeRoot,
				config.homePage,
				config.notFound,
				config.routes,
				config.authenticationUrl,
			);
			services.router = this.router;

			if (Array.isArray(config.onAppReady)) {
				await Promise.all(config.onAppReady.map((fn) => fn(this)));
			}
		} catch (error) {
			console.error('App initialization failed:', error);

			throw error;
		}
	}

	destroy() {
		if (this.#destroyed) {
			return;
		}

		this.#destroyed = true;

		if (this.router && !this.router.destroyed) {
			this.router.destroy();
		}

		if (this.http?.destroy) {
			this.http.destroy();
		}

		if (services.loggerFactory?.shutdown) {
			services.loggerFactory.shutdown();
		}

		this.router = null;
		this.http = null;
		this.ready = null;

		services.reset();

		App.instance = null;
	}

	get isDestroyed() {
		return this.#destroyed;
	}
}
