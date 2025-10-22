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

	/**
	 * @type {Promise<void>} Resolves when app is fully initialized
	 */
	ready = null;

	/**
	 * @type {boolean} Tracks if app has been destroyed
	 */
	#destroyed = false;

	/**
	 * Creates a new App instance. Only one instance is allowed.
	 * @param {Object} config - Application configuration
	 * @param {string} [config.staticRoot=''] - Root path for static assets
	 * @param {Array<string>} [config.rootStylesheets] - Global stylesheets to load
	 * @param {string} [config.httpEndpointStub] - HTTP endpoint configuration
	 * @param {string} [config.authenticationModule] - Path to authentication module
	 * @param {Object} [config.loggerConfig] - Logger configuration
	 * @param {string} [config.loggerConfig.level] - Log level (debug, info, warn, error)
	 * @param {string} [config.loggerConfig.handler] - Log handler endpoint
	 * @param {string} config.routeRoot - Root path for routing
	 * @param {Object} config.homePage - Home page configuration
	 * @param {string} config.homePage.component - Home page component path
	 * @param {Object} [config.homePage.meta] - Home page metadata
	 * @param {Object} config.notFound - 404-page configuration
	 * @param {string} config.notFound.component - 404 page component path
	 * @param {Object} [config.notFound.meta] - 404-page metadata
	 * @param {Array<Object>} config.routes - Route definitions
	 * @param {string} [config.authenticationUrl] - Authentication redirect URL
	 * @param {Array<Function>} [config.onAppReady] - Functions to call when app is ready
	 * @throws {Error} If another App instance exists or config is invalid
	 */
	constructor(config) {
		if (App.instance) {
			throw new Error('Only one instance of App allowed');
		}

		this.#validateConfig(config);

		if (config.staticRoot) {
			App.staticRoot = config.staticRoot;
		} else {
			App.staticRoot = '';
		}

		const styleSheetPromises = this.#loadStylesheets(config.rootStylesheets),
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
	}

	/**
	 * Validates the configuration object
	 * @param {Object} config - Configuration to validate
	 * @throws {Error} If configuration is invalid
	 * @private
	 */
	// eslint-disable-next-line class-methods-use-this
	#validateConfig(config) {
		if (!config || typeof config !== 'object') {
			throw new Error('App requires a valid configuration object');
		}

		const required = [
				'routeRoot',
				'homePage',
				'routes',
			],
			missing = required.filter((key) => !config[key]);

		if (missing.length > 0) {
			throw new Error(`App configuration missing required properties: ${ missing.join(', ') }`);
		}

		if (!config.homePage.component) {
			throw new Error('homePage configuration must include a component path');
		}

		if (!config.notFound || !config.notFound.component) {
			throw new Error('notFound configuration must include a component path');
		}

		if (!Array.isArray(config.routes)) {
			throw new Error('routes must be an array');
		}
	}

	/**
	 * Loads global stylesheets
	 * @param {Array<string>} stylesheets - Stylesheet paths
	 * @returns {Array<Promise>} Array of stylesheet loading promises
	 * @private
	 */
	// eslint-disable-next-line class-methods-use-this
	#loadStylesheets(stylesheets) {
		if (!stylesheets || !Array.isArray(stylesheets)) {
			return [];
		}

		return stylesheets.map((stylesheet) => new Promise((resolve, reject) => {
			try {
				const path = typeof stylesheet === 'string'
					? `${ App.staticRoot }${ stylesheet }`
					: stylesheet;

				Loader.getCSS(path, resolve);
			} catch (error) {
				console.error(`Failed to load stylesheet ${ stylesheet }:`, error);
				reject(error);
			}
		}));
	}

	/**
	 * Sets up authentication module if configured
	 * @param {Object} config - Application configuration
	 * @returns {Promise|null} Authentication module promise or null
	 * @private
	 */
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

	/**
	 * Sets up HTTP module if configured
	 * @param {Object} config - Application configuration
	 * @returns {Promise|null} HTTP module promise or null
	 * @private
	 */
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

	/**
	 * Sets up logging if configured
	 * @param {Object} config - Application configuration
	 * @returns {Promise|null} Logging module promise or null
	 * @private
	 */
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

	/**
	 * Initializes the application
	 * @param {Object} config - Application configuration
	 * @param {Array<Promise>} styleSheetPromises - Stylesheet loading promises
	 * @param {Promise|null} authenticationPromise - Authentication module promise
	 * @param {Promise|null} httpPromise - HTTP module promise
	 * @param {Promise|null} loggingPromise - Logging module promise
	 * @returns {Promise<void>} Resolves when initialization is complete
	 * @private
	 */
	async #initialize(config, styleSheetPromises, authenticationPromise, httpPromise, loggingPromise) {
		try {
			// Load stylesheets
			const stylesheets = await Promise.all(styleSheetPromises),
				[authenticationModule, httpModule, loggingFactoryModule] = await Promise.all([
					authenticationPromise,
					httpPromise,
					loggingPromise,
				]);

			if (stylesheets.length > 0) {
				document.adoptedStyleSheets = [...stylesheets];
			}

			// Setup HTTP if configured
			if (httpModule?.default) {
				if (!authenticationModule?.default) {
					throw new Error('Authentication module failed to initialize');
				}

				this.http = new httpModule.default(
					config.httpEndpointStub,
					new authenticationModule.default,
				);
			}

			// Setup logging if configured
			if (loggingFactoryModule?.default) {
				App.loggerFactory = new loggingFactoryModule.default;

				if (config.loggerConfig.level) {
					App.loggerFactory.setLogLevel(config.loggerConfig.level);
				}

				if (config.loggerConfig.handler) {
					App.loggerFactory.setEndpoint(config.loggerConfig.handler);
				}
			}

			// Initialize router
			this.router = new Router(
				config.routeRoot,
				config.homePage,
				config.notFound,
				config.routes,
				config.authenticationUrl,
			);

			// Call onAppReady callbacks
			if (Array.isArray(config.onAppReady)) {
				await Promise.all(config.onAppReady.map((fn) => fn(this)));
			}
		} catch (error) {
			console.error('App initialization failed:', error);

			throw error;
		}
	}

	/**
	 * Destroys the app instance and cleans up resources
	 * @public
	 */
	destroy() {
		if (this.#destroyed) {
			return;
		}

		this.#destroyed = true;

		// Destroy router
		if (this.router && !this.router.destroyed) {
			this.router.destroy();
		}

		// Clean up HTTP
		if (this.http?.destroy) {
			this.http.destroy();
		}

		// Clean up logger factory
		if (App.loggerFactory?.shutdown) {
			App.loggerFactory.shutdown();
		}

		// Clear references
		this.router = null;
		this.http = null;
		this.ready = null;
		App.loggerFactory = null;
		App.staticRoot = '';
		App.instance = null;
	}

	/**
	 * Checks if the app has been destroyed
	 * @returns {boolean} True if destroyed
	 * @public
	 */
	get isDestroyed() {
		return this.#destroyed;
	}
}
