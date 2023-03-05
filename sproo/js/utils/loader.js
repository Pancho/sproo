import HtmlStatic from './html.js';
import CssStatic from './css.js';


export default class Loader {
	static cssCache = {};
	static cssQueue = [];
	static templateCache = {};
	static templateQueue = {};
	static domParser = (new DOMParser);

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

			fetch(`${ stylesheetPath.toLowerCase() }.css`, {method: 'GET'}).then((response) => response.text()).then((css) => {
				const styleSheet = new CSSStyleSheet;

				styleSheet.replaceSync(css);
				Loader.cssCache[stylesheetPath] = styleSheet;
				Loader.cssQueue[stylesheetPath].forEach((queuedResolve) => {
					queuedResolve(styleSheet);
				});
			});
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

			fetch(`${ templatePath.toLowerCase() }.html`, {method: 'GET'}).then((response) => response.text()).then((html) => {
				const node = Loader.domParser.parseFromString(`<template>${ html }</template>`, 'text/html');

				Loader.templateCache[templatePath] = node;
				Loader.templateQueue[templatePath].forEach((queuedResolve) => {
					queuedResolve(node.querySelector('template').content.cloneNode(true));
				});
			});
		}
	}
}
