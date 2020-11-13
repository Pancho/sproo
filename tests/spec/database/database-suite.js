import { Suite } from '../../api/suite.js';
import {
	DatabaseSetupTest,
	DatabaseStoreExistsTest,
	DatabaseDataAddTest,
	DatabaseDataPutTest,
	DatabaseGetFirstTest,
	DatabaseCountTest,
	DatabaseFilterCountTest,
	DatabaseUpgradeTest,
	DatabaseStoreAllTest,
	DatabaseOrderAscTest,
	DatabaseOrderDescTest,
	DatabaseSkipTest,
	DatabaseLimitTest,
	DatabaseSkipLimitTest,
	DatabaseDeleteTest,
} from './database.js';

export class DatabaseSuite extends Suite {
	constructor() {
		super('Database Suite');
		this.registerTest(new DatabaseSetupTest());
		this.registerTest(new DatabaseStoreExistsTest());
		this.registerTest(new DatabaseDataAddTest());
		this.registerTest(new DatabaseDataPutTest());
		this.registerTest(new DatabaseGetFirstTest());
		this.registerTest(new DatabaseCountTest());
		this.registerTest(new DatabaseFilterCountTest());
		this.registerTest(new DatabaseUpgradeTest());
		this.registerTest(new DatabaseStoreAllTest());
		this.registerTest(new DatabaseOrderAscTest());
		this.registerTest(new DatabaseOrderDescTest());
		this.registerTest(new DatabaseSkipTest());
		this.registerTest(new DatabaseLimitTest());
		this.registerTest(new DatabaseSkipLimitTest());
		this.registerTest(new DatabaseDeleteTest());
	}
}
