export class Utils {
	static cssCache = {};
	static cssQueue = [];
	static templateCache = {};
	static templateQueue = {};
	static domParser = new DOMParser();
	// Common property names mapping
	static propertyNamesMap = {
		'text-content': 'textContent',
	};

	static getCSS(stylesheet, resolve) {
		resolve = resolve || function () {
		};

		if (!!Utils.cssCache[stylesheet]) {
			resolve(Utils.cssCache[stylesheet]);
		} else if (!!Utils.cssQueue[stylesheet]) {
			Utils.cssQueue[stylesheet].push(resolve);
		} else {
			if (!Utils.cssQueue[stylesheet]) {
				Utils.cssQueue[stylesheet] = [];
			}
			Utils.cssQueue[stylesheet].push(resolve);

			fetch(`${stylesheet.toLowerCase()}.css`, {
				method: 'GET',
			}).then((response) => {
				return response.text();
			}).then((css) => {
				const cssStyleSheet = new CSSStyleSheet();
				cssStyleSheet.replaceSync(css);
				Utils.cssCache[stylesheet] = cssStyleSheet;
				Utils.cssQueue[stylesheet].forEach(queuedResolve => {
					queuedResolve(cssStyleSheet);
				});
			});
		}
	}

	static getTemplateHTML(name, resolve) {
		resolve = resolve || function () {
		};
		if (!!Utils.templateCache[name]) {
				resolve(Utils.templateCache[name]);
			} else if (!!Utils.templateQueue[name]) {
				Utils.templateQueue[name].push(resolve);
			} else {
				if (!Utils.templateQueue[name]) {
					Utils.templateQueue[name] = [];
				}
				Utils.templateQueue[name].push(resolve);

				fetch(`${name.toLowerCase()}.html`, {
					method: 'GET',
				}).then(response => response.text()).then((html) => {
					Utils.templateCache[name] = html;
					Utils.templateQueue[name].forEach(queuedResolve => {
						queuedResolve(html);
					});
				});
			}
	}
}
