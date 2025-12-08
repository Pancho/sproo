export default class ConfigValidator {
	static validate(config) {
		if (!config || typeof config !== 'object') {
			throw new Error('App requires a valid configuration object');
		}

		const required = [
				'appName',
				'homePage',
				'routes',
			],
			missing = required.filter((key) => !config[key]);

		if (missing.length > 0) {
			throw new Error(`App configuration missing required properties: ${missing.join(', ')}`);
		}

		if (!config.homePage.component) {
			throw new Error('homePage configuration must include a component path');
		}

		if (!config.notFound || !config.notFound.component) {
			throw new Error('notFound configuration must include a component path');
		}

		if (!Array.isArray(config.routes)) {
			throw new Error('routes must be an array');
		}

		return true;
	}
}
