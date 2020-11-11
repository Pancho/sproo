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
	DatabaseStoreAllTest
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
	}
}
