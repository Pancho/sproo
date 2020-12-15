/*
* Modelled after Navigo, no shame. For inspiration, see https://github.com/krasimir/navigo
*
* I chose Navigo as an inspiration because it is simple. Really simple; one file, JS code (and it's pretty at that), no complications.
* I did however rewrite good chunks of code, removed what I don't want to use, made it something I would like to use (renamed properties),
* but in no way will I deny credits to the original author even if may be hard to tell at this point.
*
* Usage of router requires you to specify a couple of things, and it's not self evident which and how.
*
* ---routeRoot---
* This is the leading part of the urls that should be ignored when handling urls with this router. Let's suppose we have our page hosted on
* a domain www.example.com and we are building our app from /admin forward. In this case routeRoot would be set to
* https://www.example.com/admin (no trailing slash). You would have to configure your web server (nginx or apache) to serve the same html
* file for all urls with /admin as the leading part (this is very important) as some users will certainly not start their navigation at
* that exact root. Root is then subtracted from any url to get only the part that this router handler will handle.
* Difference from Navigo is that in no way do I want to be guessing the root - set it OR hack this file.
*
* ---homePage--- and ---notFound---
* I'm grouping these two parameters together, because they are somewhat related. The homePage is the handler blob for the exact root url (/)
* and notFound for those that you did not specify (think 404, and 500 is not really needed as each component can take care of that on its
* own). Each of those provides only two other properties, like so:
*
* specialBlob = {
*   component: MyGreatComponent
* }
*
* should you want to add some guards for these two, just add the invocation to the before hook (for others it's automatic, should a guard
* be specified).
* I diverged from Navigo here in a way where I don't want to have the same code handling the home, regular and not found routes. Home and
* not found are special cases and most frameworks agree, so I separated them. Navigo separates not found too, but I wanted to have all of
* the special cases handled in a similar way, not a mix of both worlds.
*
* ---routes---
* This is the meat of this class even though we already touched this with homePage and notFound. In essence, it's a list of blobs, but these
* blobs must have a certain structure for router to work (duh), so let's start with a full example and we'll dissect it like a frog in a
* biology class:
*
* ...
* },
* {
*   path: '/main',
*	component: MainComponent
* },
* {
* ...
*
* --params--
* Parameters are the urls variables, since we don't want to rely only on GET parameters (but you still totally can if you please), so we'll
* take time to explain how to craft url patterns here as well. In the example we set path to '/main', but if we want to use parts of the
* path to carry parameter data, we simply do it with colons, like so:
*
* path: '/main/:param1/something/:param2/also-something'
*
* With such url, your component will receive two parameters, called param1 and param2, both of which will be strings, so you will have to
* parse and cast to desired types. Why not do some casting automatically? We could, but that would truly make this a package worthy of its
* own name, and this is not our goal. Mostly you pass params that are meant to be either strings or numbers, so no casting should pose any
* problems.
*
* I also wanted to prevent the router from working with urls that use underscores or some other inferior convention, but hell, I will not
* forsake simplicity to prevent sloppiness. Same goes for param naming convention. Please try to use hyphens for urls (drastically
* increases url readability, even google recommends this: https://support.google.com/webmasters/answer/76329?hl=en) and camelCase
* convention for naming your parameters (you're writing JS not Python)
*
* Do not try to make a path like '' or '/', because those (or that) are a special case called homePage and are reserved for that.
*/
export default class Router {
	routeRoot = null;
	routes = [];
	lastRouteResolved = {};
	homePageRoute = null;
	notFoundRoute = null;
	destroyed = false;

	static instance;

	constructor(routeRoot, homePage, notFound, routes, authenticationUrl) {
		if (!!Router.instance) {
			throw new Error('Only one instance of Router allowed');
		}

		Router.instance = this;

		this.routeRoot = routeRoot;
		this.authenticationUrl = authenticationUrl;

		window.addEventListener('popstate', this.resolve);

		this.homePageRoute = {
			handler: async () => {
				return RouterUtils.inject(homePage.component);
			},
		};
		this.notFoundRoute = {
			handler: async () => {
				return RouterUtils.inject(notFound.component);
			},
		};

		if (Array.isArray(routes)) {
			routes.forEach((route, index) => {
				this.add(
					route.path,
					async params => {
						params = params || [];
						if (!!route.guard) {
							return import(route.guard).then(guardModule => {
								const guard = new guardModule.default();
								return guard.guard(this, route).then(async result => {
									return RouterUtils.inject(route.component, ...params);
								});
							});
						} else {
							return RouterUtils.inject(route.component, ...params);
						}
					},
				);
			});
		}

		this.resolve();
	}

	get [Symbol.toStringTag]() {
		return 'Router';
	}

	destroy() {
		this.routes = [];
		this.destroyed = true;

		window.removeEventListener('popstate', this.resolve);
	}

	add(route, handler = null) {
		if (typeof route === 'string') {
			route = encodeURI(route);
		}
		this.routes.push({
			path: route,
			handler: handler,
		});
	}

	async navigate(location, data) {
		data = data || {};
		location = location || '';
		window.history.pushState(
			data,
			// Here's the thing about this param... this would replace the title tag, so each page could have a unique
			// title, but of all the browsers, only Safari uses this, and I don't want to test it, to see if this is
			// even worth keeping. Just give your page a decent name in the title tag, because this is poorly optimized
			// for the SEO anyway.
			'',
			(`${this.routeRoot}/${location.replace(RouterUtils.CLEAN_LEADING_SLASH, '/')}`).replace(/([^:])(\/{2,})/g, '$1/'),
		);
		return this.resolve();
	}

	match(path) {
		return this.routes
			.map(route => {
				const {regexp, paramNames} = RouterUtils.replaceDynamicURLParts(RouterUtils.clean(route.path)),
					match = path.replace(RouterUtils.CLEAN_LEADING_SLASH, '/').match(regexp),
					params = RouterUtils.regExpResultToParams(match, paramNames);

				return match ? {
					match: match,
					route: route,
					params: params,
				} : false;
			}).filter(match => match)[0];
	}

	async resolve(current) {
		const url = current || RouterUtils.clean(window.location.href),
			path = RouterUtils.splitURL(url.replace(this.routeRoot, ''));

		if (!!this.lastRouteResolved && this.lastRouteResolved.path === path) {
			return false;
		}

		const match = this.match(path);

		if (!!match) {
			this.lastRouteResolved = {
				path: path,
				params: match.params,
			};

			return match.route.handler(match.params);
		} else if (!!this.homePageRoute && (path === '' || path === '/')) {
			this.lastRouteResolved = {
				path: path,
			};
			return this.homePageRoute.handler();
		} else if (!!this.notFoundRoute) {
			this.lastRouteResolved = {
				path: path,
			};
			return this.notFoundRoute.handler();
		}
		return false;
	}
}

class RouterUtils {
	static DEPTH_TRAILING_SLASH = new RegExp(/\/$/);
	static CLEAN_TRAILING_SLASH = new RegExp(/\/+$/);
	static CLEAN_LEADING_SLASH = new RegExp(/^\/+/);
	static PARAMETER_REGEXP = new RegExp(/([:*])(\w+)/g);
	static WILDCARD_REGEXP = new RegExp(/\*/g);
	static SPLIT_GET_PARAMETERS = new RegExp(/\?(.*)?$/);
	static REPLACE_VARIABLE_REGEXP = '([^\/]+)';
	static REPLACE_WILDCARD = '(?:.*)';
	static FOLLOWED_BY_SLASH_REGEXP = '(?:\/$|$)';

	static clean(url) {
		return url.replace(RouterUtils.CLEAN_TRAILING_SLASH, '').replace(RouterUtils.CLEAN_LEADING_SLASH, '^/').split('#')[0];
	}

	static splitURL(url) {
		return url.split(RouterUtils.SPLIT_GET_PARAMETERS)[0];
	}

	static replaceDynamicURLParts(route) {
		const paramNames = [];
		let regexp;

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
			.reduce((params, value, index) => {
				if (params === null) {
					params = [];
				}
				params.push(decodeURIComponent(value));
				return params;
			}, null);
	}

	static getUrlDepth(url) {
		return url.replace(RouterUtils.DEPTH_TRAILING_SLASH, '').split('/').length;
	}

	static compareUrlDepth(urlA, urlB) {
		return RouterUtils.getUrlDepth(urlB) - RouterUtils.getUrlDepth(urlA);
	}

	static async inject(component, ...params) {
		const outlet = document.querySelector('router-outlet');

		if (!outlet) {
			throw new Error('Page must contain <router-outlet> element');
		}

		while (outlet.firstChild) {
			if (outlet.firstChild.unload) {
				outlet.firstChild.unload();
			}
			outlet.removeChild(outlet.firstChild);
		}
		return new Promise(resolve => {
			import(component).then(module => {
				if (!module || !module.default) {
					throw new Error(`We cannot render a component from module ${module}`);
				}
				if (!customElements.get(module.default.tagName)) {
					customElements.define(module.default.tagName, module.default);
				}
				outlet.appendChild(new module.default(...params));
				resolve();
			}).catch(error => {
				throw new Error(error);
			});
		});
	}
}
