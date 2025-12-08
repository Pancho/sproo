import Loader from './loader.js';


export default class StylesheetLoader {
	static load(stylesheets, staticRoot = '') {
		if (!stylesheets || !Array.isArray(stylesheets)) {
			return [];
		}

		return stylesheets.map((stylesheet) => new Promise((resolve, reject) => {
			try {
				const path = typeof stylesheet === 'string'
					? `${staticRoot}${stylesheet}`
					: stylesheet;

				Loader.getCSS(path, resolve);
			} catch (error) {
				console.error(`Failed to load stylesheet ${stylesheet}:`, error);
				reject(error);
			}
		}));
	}

	static async apply(stylesheets, staticRoot = '') {
		const promises = StylesheetLoader.load(stylesheets, staticRoot);

		if (promises.length === 0) {
			return [];
		}

		const loaded = await Promise.all(promises);

		document.adoptedStyleSheets = [...loaded];

		return loaded;
	}
}
