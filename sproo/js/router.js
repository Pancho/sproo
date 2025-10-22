export default class Router {
	[Symbol.toStringTag] = 'Router';
	static instance;

	routeRoot = null;
	routes = [];
	lastRouteResolved = {};
	homePageRoute = null;
	notFoundRoute = null;
	destroyed = false;
	authenticationUrl = null;

	#onPopStateBound = null;
	#navigating = false;
	#navigationQueue = [];
	#beforeNavigateCallbacks = [];
	#afterNavigateCallbacks = [];

	/**
	 * Creates a new Router instance. Only one instance is allowed.
	 * @param {string} routeRoot - Root path for all routes
	 * @param {Object} homePage - Home page configuration
	 * @param {string} homePage.component - Path to home page component
	 * @param {Object} [homePage.meta] - Home page metadata
	 * @param {Object} notFound - 404-page configuration
	 * @param {string} notFound.component - Path to 404 component
	 * @param {Object} [notFound.meta] - 404-page metadata
	 * @param {Array<Object>} routes - Route definitions
	 * @param {string} [authenticationUrl] - URL to redirect for authentication
	 * @throws {Error} If another Router instance exists
	 */
	constructor(routeRoot, homePage, notFound, routes, authenticationUrl) {
		if (Router.instance) {
			throw new Error('Only one instance of Router allowed');
		}

		Router.instance = this;

		this.routeRoot = `${window.location.protocol}//${window.location.host}${routeRoot}`;
		this.authenticationUrl = authenticationUrl;

		this.#onPopStateBound = this.#onPopState.bind(this);
		window.addEventListener('popstate', this.#onPopStateBound);

		this.#setupHomeRoute(homePage);
		this.#setupNotFoundRoute(notFound);
		this.#setupRoutes(routes);

		this.resolve();
	}

	/**
	 * Sets up the home page route
	 * @param {Object} homePage - Home page configuration
	 * @private
	 */
	#setupHomeRoute(homePage) {
		this.homePageRoute = {
			handler: async () => {
				await RouterUtils.inject(homePage.component);
			},
			meta: homePage.meta,
		};
	}

	/**
	 * Sets up the 404 not found route
	 * @param {Object} notFound - Not found page configuration
	 * @private
	 */
	#setupNotFoundRoute(notFound) {
		this.notFoundRoute = {
			handler: async () => {
				await RouterUtils.inject(notFound.component);
			},
			meta: notFound.meta,
		};
	}

	/**
	 * Sets up all application routes
	 * @param {Array<Object>} routes - Route definitions
	 * @private
	 */
	#setupRoutes(routes) {
		if (!Array.isArray(routes)) {
			return;
		}

		routes.forEach((route) => {
			this.add(
				route.path,
				async (params, queryParams) => {
					const componentParams = params || [];

					if (route.guard) {
						const guardResult = await this.#executeGuard(route, params, queryParams);

						if (guardResult.redirect) {
							await this.navigate(guardResult.redirect);

							return;
						}

						if (!guardResult.allowed) {
							await this.navigateToNotFound();

							return;
						}
					}

					await RouterUtils.inject(route.component, ...componentParams);
				},
				route.meta,
			);
		});
	}

	/**
	 * Executes a route guard
	 * @param {Object} route - Route configuration
	 * @param {Array} params - Route parameters
	 * @param {Object} queryParams - Query parameters
	 * @returns {Promise<{allowed: boolean, redirect?: string}>} Guard result
	 * @private
	 */
	async #executeGuard(route, params, queryParams) {
		try {
			const guardModule = await import(route.guard),
				guard = new guardModule.default(this, route),
				result = await guard.guard(this, route, params, queryParams);

			if (!guardModule?.default) {
				console.error(`Guard module ${route.guard} does not have a default export`);

				return {allowed: false};
			}

			// Guard can return boolean or object with redirect
			if (typeof result === 'boolean') {
				return {allowed: result};
			}

			if (typeof result === 'object' && result !== null) {
				return {
					allowed: Boolean(result.allowed),
					redirect: result.redirect,
				};
			}

			return {allowed: Boolean(result)};
		} catch (error) {
			console.error('Guard execution failed:', error);

			return {allowed: false};
		}
	}

	/**
	 * Destroys the router and cleans up resources
	 * @public
	 */
	destroy() {
		this.destroyed = true;
		this.routes = [];
		this.#navigationQueue = [];
		this.#beforeNavigateCallbacks = [];
		this.#afterNavigateCallbacks = [];

		window.removeEventListener('popstate', this.#onPopStateBound);
		this.#onPopStateBound = null;

		Router.instance = null;
	}

	/**
	 * Adds a route to the router
	 * @param {string|RegExp} route - Route pattern
	 * @param {Function} [handler=null] - Route handler function
	 * @param {Object} [meta=null] - Route metadata
	 * @public
	 */
	add(route, handler = null, meta = null) {
		let internalRoute = '';

		if (typeof route === 'string') {
			internalRoute = encodeURI(route);
		} else {
			internalRoute = route;
		}

		this.routes.push({
			path: internalRoute,
			handler: handler,
			meta: meta,
		});
	}

	/**
	 * Navigates to a new location
	 * @param {string} location - The path to navigate to
	 * @param {Object} [data={}] - Additional state data
	 * @returns {Promise<void>} Resolves when navigation is complete
	 * @public
	 */
	async navigate(location, data = {}) {
		// Queue navigation if already navigating
		if (this.#navigating) {
			return new Promise((resolve) => {
				this.#navigationQueue.push({
					location,
					data,
					resolve,
				});
			});
		}

		this.#navigating = true;

		try {
			const internalLocation = location || '',
				url = this.#buildUrl(internalLocation),
				// Get current state before navigation
				previousUrl = window.location.href.replace(window.location.origin, ''),
				// Call before navigate callbacks
				shouldContinue = await this.#callBeforeNavigate(url, previousUrl),
				internalData = {
					previousUrl,
					...data,
				};

			if (!shouldContinue) {
				return null;
			}

			window.history.pushState(internalData, '', url);
			await this.resolve();

			// Call after navigate callbacks
			await this.#callAfterNavigate(url, previousUrl);

			return null;
		} catch (error) {
			console.error('Navigation failed:', error);

			throw error;
		} finally {
			this.#navigating = false;
			this.#processNavigationQueue();
		}
	}

	/**
	 * Navigates to the 404 page
	 * @returns {Promise<void>} Resolves when navigation is complete
	 * @public
	 */
	async navigateToNotFound() {
		if (this.notFoundRoute) {
			await this.notFoundRoute.handler();
		}
	}

	/**
	 * Builds a complete URL from a location string
	 * @param {string} location - The location path
	 * @returns {string} Complete URL
	 * @private
	 */
	#buildUrl(location) {
		return `${this.routeRoot}/${location.replace(RouterUtils.CLEAN_LEADING_SLASH, '/')}`
			.replace(/([^:])(\/{2,})/gu, '$1/');
	}

	/**
	 * Processes queued navigations
	 * @private
	 */
	#processNavigationQueue() {
		if (this.#navigationQueue.length > 0) {
			const next = this.#navigationQueue.shift();

			this.navigate(next.location, next.data).then(next.resolve);
		}
	}

	/**
	 * Calls all before navigate callbacks
	 * @param {string} toUrl - Destination URL
	 * @param {string} fromUrl - Current URL
	 * @returns {Promise<boolean>} True if navigation should continue
	 * @private
	 */
	async #callBeforeNavigate(toUrl, fromUrl) {
		for (const callback of this.#beforeNavigateCallbacks) {
			try {
				const result = await callback(toUrl, fromUrl);

				if (result === false) {
					return false;
				}
			} catch (error) {
				console.error('beforeNavigate callback error:', error);
			}
		}

		return true;
	}

	/**
	 * Calls all after navigate callbacks
	 * @param {string} toUrl - Destination URL
	 * @param {string} fromUrl - Previous URL
	 * @returns {Promise<void>}
	 * @private
	 */
	async #callAfterNavigate(toUrl, fromUrl) {
		for (const callback of this.#afterNavigateCallbacks) {
			try {
				await callback(toUrl, fromUrl);
			} catch (error) {
				console.error('afterNavigate callback error:', error);
			}
		}
	}

	/**
	 * Registers a callback to be called before navigation
	 * @param {Function} callback - Callback function (toUrl, fromUrl) => boolean|Promise<boolean>
	 * @public
	 */
	beforeNavigate(callback) {
		if (typeof callback === 'function') {
			this.#beforeNavigateCallbacks.push(callback);
		}
	}

	/**
	 * Registers a callback to be called after navigation
	 * @param {Function} callback - Callback function (toUrl, fromUrl) => void|Promise<void>
	 * @public
	 */
	afterNavigate(callback) {
		if (typeof callback === 'function') {
			this.#afterNavigateCallbacks.push(callback);
		}
	}

	/**
	 * Matches a path against registered routes
	 * @param {string} path - Path to match
	 * @returns {Object|null} Match result with route, params, and query params
	 * @public
	 */
	match(path) {
		const cleanedPath = path.replace(RouterUtils.CLEAN_LEADING_SLASH, '/'),
			[pathWithoutQuery, queryString] = cleanedPath.split('?'),
			queryParams = RouterUtils.getQueryParams(queryString);

		for (let i = 0, j = this.routes.length; i < j; i += 1) {
			const route = this.routes[i],
				{
					regexp,
					paramNames,
				} = RouterUtils.replaceDynamicURLParts(
					RouterUtils.clean(route.path),
				),
				match = pathWithoutQuery.match(regexp);

			if (match) {
				const params = RouterUtils.regExpResultToParams(match, paramNames);

				return {
					match,
					route,
					params,
					queryParams,
				};
			}
		}

		return null;
	}

	/**
	 * Resolves and handles the current URL
	 * @param {string} [current] - URL to resolve (defaults to current location)
	 * @returns {Promise<void>} Resolves when route is handled
	 * @public
	 */
	async resolve(current) {
		if (this.destroyed) {
			return;
		}

		const url = current || RouterUtils.clean(window.location.href),
			path = RouterUtils.splitURL(url.replace(this.routeRoot, ''));

		// Prevent duplicate resolution
		if (this.lastRouteResolved?.path === path && !current) {
			return;
		}

		try {
			const match = this.match(path);
			let title = null;

			if (match) {
				this.lastRouteResolved = {
					path,
					params: match.params,
					queryParams: match.queryParams,
				};
				await match.route.handler(match.params, match.queryParams);
				title = match.route.meta?.title;
			} else if (RouterUtils.clean(path) === '' && this.homePageRoute) {
				this.lastRouteResolved = {path};
				await this.homePageRoute.handler();
				title = this.homePageRoute.meta?.title;
			} else if (this.notFoundRoute) {
				this.lastRouteResolved = {
					path,
					notFound: true,
				};
				await this.notFoundRoute.handler();
				title = this.notFoundRoute.meta?.title;
			}

			if (title) {
				document.title = title;
			}
		} catch (error) {
			console.error('Route resolution failed:', error);

			// Fallback to 404 if available and not already showing it
			if (this.notFoundRoute && !this.lastRouteResolved?.notFound) {
				this.lastRouteResolved = {
					path,
					notFound: true,
				};
				await this.notFoundRoute.handler();
			}
		}
	}

	/**
	 * Handles browser back/forward navigation
	 * @param {PopStateEvent} event - The popstate event
	 * @private
	 */
	#onPopState(event) {
		this.resolve(event.target.location.href);
	}
}


/**
 * Utility class for router operations
 * @private
 */
class RouterUtils {
	static CLEAN_TRAILING_SLASH = /\/+$/u;
	static CLEAN_LEADING_SLASH = /^\/+/u;
	static PARAMETER_REGEXP = /([:*])(\w+)/gu;
	static WILDCARD_REGEXP = /\*/gu;
	static SPLIT_GET_PARAMETERS = /\?(.*)?$/u;
	static REPLACE_VARIABLE_REGEXP = '([^/]+)';
	static REPLACE_WILDCARD = '(?:.*)';
	static FOLLOWED_BY_SLASH_REGEXP = '(?:/$|$)';

	/**
	 * Cleans a URL by removing trailing slashes and hash
	 * @param {string} url - URL to clean
	 * @returns {string} Cleaned URL
	 * @static
	 */
	static clean(url) {
		return url
			.replace(RouterUtils.CLEAN_TRAILING_SLASH, '')
			.replace(RouterUtils.CLEAN_LEADING_SLASH, '/')
			.split('#')[0];
	}

	/**
	 * Splits URL to remove query parameters
	 * @param {string} url - URL to split
	 * @returns {string} URL without query parameters
	 * @static
	 */
	static splitURL(url) {
		return url.split(RouterUtils.SPLIT_GET_PARAMETERS)[0];
	}

	/**
	 * Parses query parameters from a query string
	 * @param {string} queryString - Query string to parse
	 * @returns {Object<string, string>} Parsed query parameters
	 * @static
	 */
	static getQueryParams(queryString) {
		if (!queryString) {
			return {};
		}

		return queryString.split('&').reduce((params, param) => {
			const [key, value] = param.split('=');

			if (key) {
				params[decodeURIComponent(key)] = value
					? decodeURIComponent(value.replace(/\+/gu, ' '))
					: '';
			}

			return params;
		}, {});
	}

	/**
	 * Converts a route pattern to a RegExp and extracts parameter names
	 * @param {string|RegExp} route - Route pattern
	 * @returns {{regexp: RegExp, paramNames: Array<string>}} RegExp and parameter names
	 * @static
	 */
	static replaceDynamicURLParts(route) {
		const paramNames = [];
		let regexp = null;

		if (route instanceof RegExp) {
			regexp = route;
		} else {
			regexp = new RegExp(
				route
					.replace(RouterUtils.PARAMETER_REGEXP, function (full, dots, name) {
						paramNames.push(name);

						return RouterUtils.REPLACE_VARIABLE_REGEXP;
					})
					.replace(RouterUtils.WILDCARD_REGEXP, RouterUtils.REPLACE_WILDCARD) +
				RouterUtils.FOLLOWED_BY_SLASH_REGEXP,
				'u',
			);
		}

		return {
			regexp,
			paramNames,
		};
	}

	/**
	 * Converts RegExp match results to parameter object
	 * @param {Array} match - RegExp match results
	 * @param {Array<string>} names - Parameter names
	 * @returns {Array<string>|null} Parameter values
	 * @static
	 */
	static regExpResultToParams(match, names) {
		if (names.length === 0 || !match) {
			return null;
		}

		return match.slice(1, match.length).reduce((params, value) => {
			const result = params || [];

			result.push(decodeURIComponent(value));

			return result;
		}, null);
	}

	/**
	 * Injects a component into the router outlet
	 * @param {string | Function} componentOrLoader - Path to component module
	 * @param {...any} params - Parameters to pass to component constructor
	 * @returns {Promise<HTMLElement>} The created component instance
	 * @throws {Error} If outlet not found or component fails to load
	 * @static
	 */
	static async inject(componentOrLoader, ...params) {
		const outlet = document.querySelector('router-outlet');
		let children = null;

		if (!outlet) {
			throw new Error('Page must contain <router-outlet> element');
		}

		// Clean up existing components
		children = Array.from(outlet.children);

		for (const child of children) {
			if (child instanceof HTMLElement) {
				// Trigger proper cleanup if it's a Component
				if (typeof child.disconnectedCallback === 'function') {
					child.disconnectedCallback();
				}

				child.remove();
			}
		}

		try {
			let module;
			if (typeof componentOrLoader === 'function') {
				module = await componentOrLoader(); // Lazy load
			} else {
				module = await import(componentOrLoader); // Eager load
			}
			let newComponent = null;

			if (!module?.default) {
				throw new Error(`Module ${componentOrLoader} does not have a valid default export`);
			}

			// Register custom element if not already registered
			if (!customElements.get(module.default.tagName)) {
				customElements.define(module.default.tagName, module.default);
			}

			newComponent = new module.default(...params);

			outlet.appendChild(newComponent);

			return newComponent;
		} catch (error) {
			console.error(`Failed to inject component ${componentOrLoader}:`, error);

			throw error;
		}
	}
}
