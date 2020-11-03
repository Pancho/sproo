export class Utils {
	static cssCache = {};
	static cssQueue = [];
	static templateCache = {};
	static templateQueue = {};
	static domParser = new DOMParser();

	static applyCss(stylesheet, shadowRoot, resolve) {
		resolve = resolve || function () {};
		if (!!Utils.cssCache[stylesheet]) {
			shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, Utils.cssCache[stylesheet]];
			resolve();
		} else if (!!Utils.cssQueue[stylesheet]) {
			Utils.cssQueue[stylesheet].push({
				root: shadowRoot,
				resolve: resolve,
			});
		} else {
			if (!Utils.cssQueue[stylesheet]) {
				Utils.cssQueue[stylesheet] = [];
			}
			Utils.cssQueue[stylesheet].push({
				root: shadowRoot,
				resolve: resolve,
			});

			fetch(stylesheet.toLowerCase() + '.css', {
				method: 'GET',
			}).then((response) => {
				return response.text();
			}).then((css) => {
				const styleSheet = new CSSStyleSheet();
				styleSheet.replaceSync(css);
				Utils.cssCache[stylesheet] = styleSheet;
				Utils.cssQueue[stylesheet].forEach((conf, index) => {
					conf.root.adoptedStyleSheets = [...conf.root.adoptedStyleSheets, styleSheet];
					conf.resolve();
				});
			});
		}
	}

	static getTemplateHTML(name, resolve) {
		resolve = resolve || function () {};
		if (!!Utils.templateCache[name]) {
			resolve(Utils.templateCache[name].querySelector('template').content.cloneNode(true));
		} else if (!!Utils.templateQueue[name]) {
			Utils.templateQueue[name].push({
				resolve: resolve,
			});
		} else {
			if (!Utils.templateQueue[name]) {
				Utils.templateQueue[name] = [];
			}
			Utils.templateQueue[name].push({
				resolve: resolve,
			});

			fetch(name.toLowerCase() + '.html', {
				method: 'GET',
			}).then(response => response.text()).then((html) => {
				const doc = Utils.domParser.parseFromString(html, 'text/html');
				Utils.templateCache[name] = doc;
				let blob = Utils.templateQueue[name].pop();
				while (blob) {
					blob.resolve(doc.querySelector('template').content.cloneNode(true));
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
