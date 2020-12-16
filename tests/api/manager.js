import Mavor from '../../fiu/js/mavor.js';

export class Manager {
	[Symbol.toStringTag] = 'Manager';
	suites = {};

	addSuite(suite) {
		if (Mavor.slugify(suite.name) in this.suites) {
			throw new Error(`Cannot register two suites with the same name (${ suite.name })`);
		}

		this.suites[Mavor.slugify(suite.name)] = suite;
	}

	getSuiteBySlug(slug) {
		return this.suites[slug];
	}
}
