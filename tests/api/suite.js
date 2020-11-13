import { Mavor } from '../../fiu/js/mavor.js';

export class Suite {
	name;
	tests = {};

	constructor(name) {
		this.name = name;
	}

	get [Symbol.toStringTag]() {
		return 'Suite';
	}

	registerTest(test) {
		if (Mavor.slugify(test.name) in this.tests) {
			throw new Error(`Cannot register two suites with the same name (${test.name})`);
		}
		this.tests[Mavor.slugify(test.name)] = test;
	}

	executeSuite() {
		Object.values(this.tests).forEach(test => test.run());
	}

	teardown() {

	}
}
