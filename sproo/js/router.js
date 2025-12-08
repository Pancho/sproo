import {camelToKebab} from './utils/text.js';
import services from './services.js';


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
	#onPageShowBound = null;
	#onPageHideBound = null;
	#navigating = false;
	#navigationQueue = [];
	#beforeNavigateCallbacks = [];
	#afterNavigateCallbacks = [];

	constructor(routeRoot, homePage, notFound, routes, authenticationUrl) {
		if (Router.instance) {
			throw new Error('Only one instance of Router allowed');
		}

		Router.instance = this;

		this.routeRoot = `${window.location.protocol}//${window.location.host}${routeRoot}`;
		this.authenticationUrl = authenticationUrl;

		this.#onPopStateBound = this.#onPopState.bind(this);
		window.addEventListener('popstate', this.#onPopStateBound);

		this.#onPageShowBound = this.#onPageShow.bind(this);
		window.addEventListener('pageshow', this.#onPageShowBound);

		this.#onPageHideBound = this.#onPageHide.bind(this);
		window.addEventListener('pagehide', this.#onPageHideBound);

		this.#setupHomeRoute(homePage);
		this.#setupNotFoundRoute(notFound);
		this.#setupRoutes(routes);

		this.resolve();
	}

	#setupHomeRoute(homePage) {
		this.homePageRoute = {
			handler: async () => {
				await RouterUtils.inject(homePage.component);
			},
			meta: homePage.meta,
		};
	}

	#setupNotFoundRoute(notFound) {
		this.notFoundRoute = {
			handler: async () => {
				await RouterUtils.inject(notFound.component);
			},
			meta: notFound.meta,
		};
	}

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

	async #executeGuard(route, params, queryParams) {
		try {
			const guardModule = await import(route.guard),
				guard = new guardModule.default(this, route),
				result = await guard.guard(this, route, params, queryParams);

			if (!guardModule?.default) {
				console.error(`Guard module ${route.guard} does not have a default export`);

				return {allowed: false};
			}

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

	destroy() {
		this.destroyed = true;
		this.routes = [];
		this.#navigationQueue = [];
		this.#beforeNavigateCallbacks = [];
		this.#afterNavigateCallbacks = [];

		window.removeEventListener('popstate', this.#onPopStateBound);
		window.removeEventListener('pageshow', this.#onPageShowBound);
		window.removeEventListener('pagehide', this.#onPageHideBound);

		this.#onPopStateBound = null;
		this.#onPageShowBound = null;
		this.#onPageHideBound = null;

		Router.instance = null;
	}

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

	async navigate(location, data = {}) {
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
				previousUrl = window.location.href.replace(window.location.origin, ''),
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

	async navigateToNotFound() {
		if (this.notFoundRoute) {
			await this.notFoundRoute.handler();
		}
	}

	#buildUrl(location) {
		return `${this.routeRoot}/${location.replace(RouterUtils.CLEAN_LEADING_SLASH, '/')}`
			.replace(/([^:])(\/{2,})/gu, '$1/');
	}

	#processNavigationQueue() {
		if (this.#navigationQueue.length > 0) {
			const next = this.#navigationQueue.shift();

			this.navigate(next.location, next.data).then(next.resolve);
		}
	}

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

	async #callAfterNavigate(toUrl, fromUrl) {
		for (const callback of this.#afterNavigateCallbacks) {
			try {
				await callback(toUrl, fromUrl);
			} catch (error) {
				console.error('afterNavigate callback error:', error);
			}
		}
	}

	beforeNavigate(callback) {
		if (typeof callback === 'function') {
			this.#beforeNavigateCallbacks.push(callback);
		}
	}

	afterNavigate(callback) {
		if (typeof callback === 'function') {
			this.#afterNavigateCallbacks.push(callback);
		}
	}

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

	async resolve(current) {
		if (this.destroyed) {
			return;
		}

		const url = current || RouterUtils.clean(window.location.href),
			path = RouterUtils.splitURL(url.replace(this.routeRoot, ''));

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

				if (this.destroyed) {
					return;
				}

				title = match.route.meta?.title;
			} else if (RouterUtils.clean(path) === '' && this.homePageRoute) {
				this.lastRouteResolved = {path};
				await this.homePageRoute.handler();

				if (this.destroyed) {
					return;
				}

				title = this.homePageRoute.meta?.title;
			} else if (this.notFoundRoute) {
				this.lastRouteResolved = {
					path,
					notFound: true,
				};
				await this.notFoundRoute.handler();

				if (this.destroyed) {
					return;
				}

				title = this.notFoundRoute.meta?.title;
			}

			if (title) {
				document.title = title;
			}
		} catch (error) {
			if (this.destroyed) {
				return;
			}

			console.error('Route resolution failed:', error);

			if (this.notFoundRoute && !this.lastRouteResolved?.notFound) {
				this.lastRouteResolved = {
					path,
					notFound: true,
				};
				await this.notFoundRoute.handler();
			}
		}
	}

	#onPopState(event) {
		this.resolve(event.target.location.href);
	}

	#onPageShow(event) {
		if (event.persisted) {
			this.resolve();

			window.dispatchEvent(new CustomEvent('bfcache-restore', {
				detail: {
					route: this.lastRouteResolved,
					timestamp: Date.now(),
				},
			}));
		}
	}

	// eslint-disable-next-line class-methods-use-this
	#onPageHide(event) {
		if (event.persisted) {
			// Page is about to enter bfcache
		}
	}
}


class RouterUtils {
	static CLEAN_TRAILING_SLASH = /\/+$/u;
	static CLEAN_LEADING_SLASH = /^\/+/u;
	static PARAMETER_REGEXP = /([:*])(\w+)/gu;
	static WILDCARD_REGEXP = /\*/gu;
	static SPLIT_GET_PARAMETERS = /\?(.*)?$/u;
	static REPLACE_VARIABLE_REGEXP = '([^/]+)';
	static REPLACE_WILDCARD = '(?:.*)';
	static FOLLOWED_BY_SLASH_REGEXP = '(?:/$|$)';

	static clean(url) {
		return url
			.replace(RouterUtils.CLEAN_TRAILING_SLASH, '')
			.replace(RouterUtils.CLEAN_LEADING_SLASH, '/')
			.split('#')[0];
	}

	static splitURL(url) {
		return url.split(RouterUtils.SPLIT_GET_PARAMETERS)[0];
	}

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

	static async inject(componentOrLoader, ...params) {
		const outlet = document.querySelector('router-outlet');
		let children = null;

		if (!outlet) {
			throw new Error('Page must contain <router-outlet> element');
		}

		children = Array.from(outlet.children);

		for (const child of children) {
			if (child instanceof HTMLElement) {
				if (typeof child.disconnectedCallback === 'function') {
					child.disconnectedCallback();
				}

				child.remove();
			}
		}

		try {
			let module = null,
				newComponent = null,
				tagName = '';

			if (typeof componentOrLoader === 'function') {
				module = await componentOrLoader();
			} else {
				module = await import(componentOrLoader);
			}

			if (!module?.default) {
				throw new Error(`Module ${componentOrLoader} does not have a valid default export`);
			}

			if (!services.appName) {
				// App has been destroyed during async operation - silently abort
				return null;
			}

			tagName = `${services.appName}-${camelToKebab(module.default.name.replace('Component', ''))}`;

			if (!customElements.get(tagName)) {
				customElements.define(tagName, module.default);
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
