import Mavor from '../../fiu/js/mavor.js';

export class Suite {
	[Symbol.toStringTag] = 'Suite';
	name;
	tests = {};

	constructor(name, ...modules) {
		this.name = name;
		modules.forEach((module) => {
			Object.values(module)
				.sort()
				.filter((clazz) => clazz.name.endsWith('Test'))
				.forEach((clazz) => {
					this.registerTest(new clazz);
				});
		});
	}

	registerTest(test) {
		if (Mavor.slugify(test.name) in this.tests) {
			throw new Error(`Cannot register two suites with the same name (${ test.name })`);
		}

		this.tests[Mavor.slugify(test.name)] = test;
	}
}
