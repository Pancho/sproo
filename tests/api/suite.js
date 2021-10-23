import utils from '../../fiu/js/utils/index.js';

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
		if (utils.slugify(test.name) in this.tests) {
			throw new Error(`Cannot register two suites with the same name (${ test.name })`);
		}

		this.tests[utils.slugify(test.name)] = test;
	}
}
