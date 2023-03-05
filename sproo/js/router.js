export default class Router {
	[Symbol.toStringTag] = 'Router';
	static instance;
	routeRoot = null;
	routes = [];
	lastRouteResolved = {};
	homePageRoute = null;
	notFoundRoute = null;
	destroyed = false;

	constructor(routeRoot, homePage, notFound, routes, authenticationUrl) {
		if (Router.instance) {
			throw new Error('Only one instance of Router allowed');
		}

		Router.instance = this;

		this.routeRoot = `${ window.location.protocol }//${ window.location.host }${ routeRoot }`;
		this.authenticationUrl = authenticationUrl;

		window.addEventListener('popstate', (state) => this.resolve(state.target.location.href));

		this.homePageRoute = {
			handler: async () => {
				await RouterUtils.inject(homePage.component);
			},
		};
		this.notFoundRoute = {
			handler: async () => {
				await RouterUtils.inject(notFound.component);
			},
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
						}

						await RouterUtils.inject(route.component, ...componentParams);
					},
				);
			});
		}

		this.resolve();
	}

	destroy() {
		this.routes = [];
		this.destroyed = true;

		window.removeEventListener('popstate', (state) => this.resolve(state.target.location.href));
	}

	add(route, handler = null) {
		let internalRoute = '';

		if (typeof route === 'string') {
			internalRoute = encodeURI(route);
		}

		this.routes.push({
			path: internalRoute,
			handler: handler,
		});
	}

	async navigate(location, data) {
		const internalData = data || {},
			internalLocation = location || '';

		window.history.pushState(
			internalData,
			/* Here's the thing about this param... this would replace the title tag, so each page could have a unique
			title, but of all the browsers, only Safari uses this, and I don't want to test it, to see if this is
			even worth keeping. Just give your page a decent name in the title tag, because this is poorly optimized
			for the SEO anyway. */
			'',
			`${ this.routeRoot }/${ internalLocation.replace(RouterUtils.CLEAN_LEADING_SLASH, '/') }`.replace(/([^:])(\/{2,})/gu, '$1/'),
		);

		await this.resolve();
	}

	match(path) {
		return this.routes
			.map((route) => {
				const {
						regexp,
						paramNames,
					} = RouterUtils.replaceDynamicURLParts(RouterUtils.clean(route.path)),
					match = path.replace(RouterUtils.CLEAN_LEADING_SLASH, '/').match(regexp),
					params = RouterUtils.regExpResultToParams(match, paramNames);

				return match ? {
					match: match,
					route: route,
					params: params,
				} : false;
			}).filter(Boolean)[0];
	}

	async resolve(current) {
		const url = current || RouterUtils.clean(window.location.href),
			path = RouterUtils.splitURL(url.replace(this.routeRoot, '')),
			match = this.match(path);

		if (Boolean(this.lastRouteResolved) && this.lastRouteResolved.path === path) {
			return;
		}

		if (match) {
			this.lastRouteResolved = {
				path: path,
				params: match.params,
			};
			await match.route.handler(match.params);
		} else if (Boolean(this.homePageRoute) && (path === '' || path === '/')) {
			this.lastRouteResolved = {path: path};

			await this.homePageRoute.handler();
		} else if (this.notFoundRoute) {
			this.lastRouteResolved = {path: path};

			await this.notFoundRoute.handler();
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
		return url.replace(RouterUtils.CLEAN_TRAILING_SLASH, '').replace(RouterUtils.CLEAN_LEADING_SLASH, '^/').split('#')[0];
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
		const outlet = document.querySelector('router-outlet'),
			module = await import(component);

		if (!outlet) {
			throw new Error('Page must contain <router-outlet> element');
		}

		while (outlet.firstChild) {
			if (outlet.firstChild.unload) {
				outlet.firstChild.unload();
			}

			outlet.removeChild(outlet.firstChild);
		}

		if (!module || !module.default) {
			throw new Error(`We cannot render a component from module ${ module }`);
		}

		if (!customElements.get(module.default.tagName)) {
			customElements.define(module.default.tagName, module.default);
		}

		outlet.appendChild(new module.default(...params));
	}
}
