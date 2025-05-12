export default class Router {
	[Symbol.toStringTag] = 'Router';
	static instance;
	routeRoot = null;
	routes = [];
	lastRouteResolved = {};
	homePageRoute = null;
	notFoundRoute = null;
	destroyed = false;
	#onPopStateBound = null;

	constructor(routeRoot, homePage, notFound, routes, authenticationUrl) {
		if (Router.instance) {
			throw new Error('Only one instance of Router allowed');
		}

		Router.instance = this;

		this.routeRoot = `${ window.location.protocol }//${ window.location.host }${ routeRoot }`;
		this.authenticationUrl = authenticationUrl;

		this.#onPopStateBound = this.#onPopState.bind(this);
		window.addEventListener('popstate', this.#onPopStateBound);

		this.homePageRoute = {
			handler: async () => {
				await RouterUtils.inject(homePage.component);
			},
			meta: homePage.meta,
		};
		this.notFoundRoute = {
			handler: async () => {
				await RouterUtils.inject(notFound.component);
			},
			meta: notFound.meta,
		};

		if (Array.isArray(routes)) {
			routes.forEach((route) => {
				this.add(
					route.path,
					async (params) => {
						const componentParams = params || [];

						if (route.guard) {
							const guardModule = await import(route.guard),
								guard = new guardModule.default(this, route),
								guardResult = await guard.guard(this, route);

							if (guardResult) {
								await RouterUtils.inject(route.component, ...componentParams);
							}
						} else {
							await RouterUtils.inject(route.component, ...componentParams);
						}
					},
					route.meta,
				);
			});
		}

		this.resolve();
	}

	destroy() {
		this.routes = [];
		this.destroyed = true;

		window.removeEventListener('popstate', this.#onPopStateBound);
	}

	add(route, handler = null, meta = null) {
		let internalRoute = '';

		if (typeof route === 'string') {
			internalRoute = encodeURI(route);
		}

		this.routes.push({
			path: internalRoute,
			handler: handler,
			meta: meta,
		});
	}

	async navigate(location, data) {
		const internalData = {
				previousUrl: window.location.href.replace(window.location.origin, ''),
				...data,
			},
			internalLocation = location || '';

		window.history.pushState(
			internalData,
			/* Here's the thing about this param... this would replace the title tag, so each page could have a unique
			title, but of all the browsers, only Safari uses this, and I don't want to test it, to see if this is
			even worth keeping. You can add meta.title param to your routes to set the page title (if not, it inherits the <meta><title>
			from the index.html document). */
			'',
			`${ this.routeRoot }/${ internalLocation.replace(RouterUtils.CLEAN_LEADING_SLASH, '/') }`.replace(/([^:])(\/{2,})/gu, '$1/'),
		);

		await this.resolve();
	}

	match(path) {
		const cleanedPath = path.replace(RouterUtils.CLEAN_LEADING_SLASH, '/');

		for (let i = 0, j = this.routes.length; i < j; i += 1) {
			const route = this.routes[i],
				{regexp, paramNames} = RouterUtils.replaceDynamicURLParts(RouterUtils.clean(route.path)),
				match = cleanedPath.match(regexp);

			if (match) {
				const params = RouterUtils.regExpResultToParams(match, paramNames);

				return {match, route, params};
			}
		}

		return null;
	}

	async resolve(current) {
		const url = current || RouterUtils.clean(window.location.href),
			path = RouterUtils.splitURL(url.replace(this.routeRoot, '')),
			match = this.match(path);
		let title = null;

		if (Boolean(this.lastRouteResolved) && this.lastRouteResolved.path === path) {
			return;
		}

		if (match) {
			this.lastRouteResolved = {
				path: path,
				params: match.params,
			};
			await match.route.handler(match.params);

			if (match?.route?.meta?.title) {
				title = match.route.meta.title;
			}
		} else if (Boolean(this.homePageRoute) && RouterUtils.clean(path) === '') {
			this.lastRouteResolved = {path: path};
			await this.homePageRoute.handler();

			if (this.homePageRoute.meta?.title) {
				title = this.homePageRoute.meta.title;
			}
		} else if (this.notFoundRoute) {
			this.lastRouteResolved = {path: path};
			await this.notFoundRoute.handler();

			if (this.notFoundRoute.meta?.title) {
				title = this.notFoundRoute.meta.title;
			}
		}

		if (title) {
			document.title = title;
		}
	}

	#onPopState(event) {
		this.resolve(event.target.location.href);
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
		return url.replace(RouterUtils.CLEAN_TRAILING_SLASH, '').replace(RouterUtils.CLEAN_LEADING_SLASH, '/').split('#')[0];
	}

	static splitURL(url) {
		return url.split(RouterUtils.SPLIT_GET_PARAMETERS)[0];
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
					.replace(RouterUtils.WILDCARD_REGEXP, RouterUtils.REPLACE_WILDCARD) + RouterUtils.FOLLOWED_BY_SLASH_REGEXP,
				'u',
			);
		}

		return {
			regexp,
			paramNames,
		};
	}

	static regExpResultToParams(match, names) {
		if (names.length === 0) {
			return null;
		}

		if (!match) {
			return null;
		}

		return match
			.slice(1, match.length)
			.reduce((params, value) => {
				const result = params ? params : [];

				result.push(decodeURIComponent(value));

				return result;
			}, null);
	}

	static async inject(component, ...params) {
		const outlet = document.querySelector('router-outlet');

		if (!outlet) {
			throw new Error('Page must contain <router-outlet> element');
		}

		let module = null,
			element = outlet.firstChild;

		try {
			module = await import(component);
		} catch (error) {
			console.error(`Failed to load module ${ component }:`, error);

			throw error;
		}

		if (!module?.default) {
			throw new Error(`Module ${ component } does not have a valid default export.`);
		}

		if (!customElements.get(module.default.tagName)) {
			customElements.define(module.default.tagName, module.default);
		}

		while (element) {
			if (element.unloadComponent) {
				element.unloadComponent();
			}

			outlet.removeChild(outlet.firstChild);
			element = outlet.firstChild;
		}

		try {
			outlet.appendChild(new module.default(...params));
		} catch (error) {
			console.error('Error rendering component:', error);
		}
	}
}
