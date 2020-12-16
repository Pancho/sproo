export class Utils {
	static cssCache = {};
	static cssQueue = [];
	static templateCache = {};
	static templateQueue = {};
	static domParser = (new DOMParser);
	// Common property names mapping
	static propertyNamesMap = {'text-content': 'textContent'};

	static getCSS(stylesheetPath, resolve) {
		const promiseResolve = resolve || function () {
		};

		if (stylesheetPath instanceof CssStatic) {
			promiseResolve(stylesheetPath.getContent());
		}

		if (Utils.cssCache[stylesheetPath]) {
			promiseResolve(Utils.cssCache[stylesheetPath]);
		} else if (Utils.cssQueue[stylesheetPath]) {
			Utils.cssQueue[stylesheetPath].push(promiseResolve);
		} else {
			if (!Utils.cssQueue[stylesheetPath]) {
				Utils.cssQueue[stylesheetPath] = [];
			}

			Utils.cssQueue[stylesheetPath].push(promiseResolve);

			fetch(`${ stylesheetPath.toLowerCase() }.css`, {method: 'GET'}).then((response) => response.text()).then((css) => {
				const styleSheet = new CSSStyleSheet;

				styleSheet.replaceSync(css);
				Utils.cssCache[stylesheetPath] = styleSheet;
				Utils.cssQueue[stylesheetPath].forEach((queuedResolve) => {
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

		if (Utils.templateCache[templatePath]) {
			promiseResolve(Utils.templateCache[templatePath].querySelector('template').content.cloneNode(true));
		} else if (Utils.templateQueue[templatePath]) {
			Utils.templateQueue[templatePath].push(promiseResolve);
		} else {
			if (!Utils.templateQueue[templatePath]) {
				Utils.templateQueue[templatePath] = [];
			}

			Utils.templateQueue[templatePath].push(promiseResolve);

			fetch(`${ templatePath.toLowerCase() }.html`, {method: 'GET'}).then((response) => response.text()).then((html) => {
				const node = Utils.domParser.parseFromString(`<template>${ html }</template>`, 'text/html');

				Utils.templateCache[templatePath] = node;
				Utils.templateQueue[templatePath].forEach((queuedResolve) => {
					queuedResolve(node.querySelector('template').content.cloneNode(true));
				});
			});
		}
	}
}

export class HtmlStatic {
	content;

	constructor(htmlString) {
		this.content = Utils.domParser.parseFromString(`<template>${ htmlString }</template>`, 'text/html');
	}

	getContent() {
		return this.content.querySelector('template').content.cloneNode(true);
	}
}

export class CssStatic {
	content;

	constructor(cssString) {
		const styleSheet = new CSSStyleSheet;

		styleSheet.replaceSync(cssString);
		this.content = styleSheet;
	}

	getContent() {
		return this.content;
	}
}
