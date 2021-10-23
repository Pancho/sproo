import utils from '../../fiu/js/utils/index.js';

export class Manager {
	[Symbol.toStringTag] = 'Manager';
	suites = {};

	addSuite(suite) {
		if (utils.slugify(suite.name) in this.suites) {
			throw new Error(`Cannot register two suites with the same name (${ suite.name })`);
		}

		this.suites[utils.slugify(suite.name)] = suite;
	}

	getSuiteBySlug(slug) {
		return this.suites[slug];
	}
}
