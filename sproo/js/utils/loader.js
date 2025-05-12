import HtmlStatic from './html.js';
import CssStatic from './css.js';


export default class Loader {
	static cssCache = {};
	static cssQueue = [];
	static templateCache = {};
	static templateQueue = {};
	static domParser = (new DOMParser);
	static maxConcurrentFetches = 4;
	static currentFetches = 0;
	static fetchQueue = [];

	static #queueFetch(fn) {
		return new Promise((resolve, reject) => {
			const run = () => {
				Loader.currentFetches += 1;

				fn()
					.then(resolve)
					.catch(reject)
					.finally(() => {
						Loader.currentFetches -= 1;

						if (Loader.fetchQueue.length > 0) {
							const next = Loader.fetchQueue.shift();

							next();
						}
					});
			};

			if (Loader.currentFetches < Loader.maxConcurrentFetches) {
				run();
			} else {
				Loader.fetchQueue.push(run);
			}
		});
	}

	static getCSS(stylesheetPath, resolve) {
		const promiseResolve = resolve || function () {
		};

		if (stylesheetPath instanceof CssStatic) {
			promiseResolve(stylesheetPath.getContent());
		}

		if (Loader.cssCache[stylesheetPath]) {
			promiseResolve(Loader.cssCache[stylesheetPath]);
		} else if (Loader.cssQueue[stylesheetPath]) {
			Loader.cssQueue[stylesheetPath].push(promiseResolve);
		} else {
			if (!Loader.cssQueue[stylesheetPath]) {
				Loader.cssQueue[stylesheetPath] = [];
			}

			Loader.cssQueue[stylesheetPath].push(promiseResolve);

			Loader.#queueFetch(() => fetch(`${ stylesheetPath.toLowerCase() }.css`, {method: 'GET'}).then((response) => {
				if (!response.ok) {
					throw new Error(`Failed to load CSS from ${ stylesheetPath }: ${ response.status } ${ response.statusText }`);
				}

				return response.text();
			}).then((css) => {
				const styleSheet = new CSSStyleSheet;

				styleSheet.replaceSync(css);
				Loader.cssCache[stylesheetPath] = styleSheet;
				Loader.cssQueue[stylesheetPath].forEach((queuedResolve) => {
					try {
						queuedResolve(styleSheet);
					} catch (error) {
						console.error('Error in queued CSS resolve callback:', error);
					}
				});
			}).catch((error) => {
				console.error(`Loader.getCSS error: ${ error.message }`);
			}));
		}
	}

	static getTemplateHTML(templatePath, resolve) {
		const promiseResolve = resolve || function () {
		};

		if (templatePath instanceof HtmlStatic) {
			promiseResolve(templatePath.getContent());
		}

		if (Loader.templateCache[templatePath]) {
			promiseResolve(Loader.templateCache[templatePath].querySelector('template').content.cloneNode(true));
		} else if (Loader.templateQueue[templatePath]) {
			Loader.templateQueue[templatePath].push(promiseResolve);
		} else {
			if (!Loader.templateQueue[templatePath]) {
				Loader.templateQueue[templatePath] = [];
			}

			Loader.templateQueue[templatePath].push(promiseResolve);

			Loader.#queueFetch(() => fetch(`${ templatePath.toLowerCase() }.html`, {method: 'GET'}).then((response) => {
				if (!response.ok) {
					throw new Error(`Failed to load template from ${ templatePath }: ${ response.status } ${ response.statusText }`);
				}

				return response.text();
			}).then((html) => {
				const node = Loader.domParser.parseFromString(`<template>${ html }</template>`, 'text/html'),
					template = node.querySelector('template');

				Loader.templateCache[templatePath] = node;
				Loader.templateQueue[templatePath].forEach((queuedResolve) => {
					try {
						queuedResolve(template.content.cloneNode(true));
					} catch (error) {
						console.error('Error in queued template resolve callback:', error);
					}
				});
			}).catch((error) => {
				console.error(`Loader.getTemplateHTML error: ${ error.message }`);
			}));
		}
	}
}
