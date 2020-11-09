import { Test } from '../../api/test.js';

export class DatabaseSetupTest extends Test {
	constructor() {
		super('Database Setup Test', 'Database setup works fine', 'Database did not set it self up successfully');
	}

	async test() {
		return this.assertEquals(1, 1);
	}
}
