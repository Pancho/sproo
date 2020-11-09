import { Suite } from '../../api/suite.js';
import { DatabaseSetupTest } from './database-setup.js';

export class DatabaseSuite extends Suite {
	constructor() {
		super('Database Suite');
		this.registerTest(new DatabaseSetupTest());
	}
}
