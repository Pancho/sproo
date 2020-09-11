export class Utils {
	static cssCache = {};
	static cssQueue = [];
	static templateCache = {};
	static templateQueue = {};
	static domParser = new DOMParser();

	/* Approach to "caching" found in this file probably works only because JS in the browser is single-threaded... */

	static applyCss(stylesheets, shadowRoot) {
		stylesheets.forEach((name, index) => {
			if (!!Utils.cssCache[name]) {
				shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, Utils.cssCache[name]];
			} else if (!!Utils.cssQueue[name]) {
				Utils.cssQueue[name].push(shadowRoot);
			} else {
				if (!Utils.cssQueue[name]) {
					Utils.cssQueue[name] = [];
				}
				Utils.cssQueue[name].push(shadowRoot);

				fetch(name.toLowerCase() + '.css', {
					method: 'GET',
				}).then((response) => {
					return response.text();
				}).then((css) => {
					const styleSheet = new CSSStyleSheet();
					styleSheet.replaceSync(css);
					Utils.cssCache[name] = styleSheet;
					Utils.cssQueue[name].forEach((root, index) => {
						root.adoptedStyleSheets = [...root.adoptedStyleSheets, styleSheet];
					});
				});
			}
		});
	}

	static getTemplateHTML(name, shadowRoot, resolve) {
		resolve = resolve || function () {};
		if (!!Utils.templateCache[name]) {
			shadowRoot.append(Utils.templateCache[name].querySelector('template').content.cloneNode(true));
			resolve();
		} else if (!!Utils.templateQueue[name]) {
			Utils.templateQueue[name].push({
				shadowRoot: shadowRoot,
				resolve: resolve,
			});
		} else {
			if (!Utils.templateQueue[name]) {
				Utils.templateQueue[name] = [];
			}
			Utils.templateQueue[name].push({
				shadowRoot: shadowRoot,
				resolve: resolve,
			});

			fetch(name.toLowerCase() + '.html', {
				method: 'GET',
			}).then(response => response.text()).then((html) => {
				const doc = Utils.domParser.parseFromString(html, 'text/html');
				Utils.templateCache[name] = doc;
				let blob = Utils.templateQueue[name].pop();
				while (blob) {
					blob.shadowRoot.append(doc.querySelector('template').content.cloneNode(true));
					blob.resolve();
					blob = Utils.templateQueue[name].pop();
				}
			});
		}
	}

	static uuid() {
		return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function (c) {
			return (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16);
		});
	}
}
