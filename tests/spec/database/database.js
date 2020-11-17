import { Database } from '../../../fiu/js/database.js';
import { Test } from '../../api/test.js';


const INDEXES = {
	users: {
		options: {
			keyPath: 'id',
			autoIncrement: true,
		},
		indexedFields: {
			email: {
				unique: true,
			},
			firstName: {
				unique: false,
			},
			lastName: {
				unique: false,
			},
			age: {
				unique: false,
			},
			groups: {
				unique: false,
				multiEntry: true,
			},
		},
		composites: [
			{
				fields: ['firstName', 'lastName'],
				config: {
					unique: false
				}
			}
		]
	},
};
const INDEXES_UPGRADE = {
	users: {
		options: {
			keyPath: 'id',
			autoIncrement: true,
		},
		upgrade: {
			delete: [
				'age',
				'firstNameLastName',
			],
			add: {
				birthDate: {
					unique: false,
				}
			},
			addComposites: [
				{
					fields: ['email', 'firstName'],
					config: {
						unique: true
					}
				}
			]
		},
	},
};
const INITIAL_DATA = [
	{
		email: 'test1@test.com',
		firstName: 'Tester',
		lastName: 'Testoff',
		groups: ['admin', 'tester'],
	},
	{
		email: 'test2@test.com',
		firstName: 'Tester',
		lastName: 'Testoff',
		groups: ['admin', 'tester'],
	},
	{
		email: 'test3@test.com',
		firstName: 'Tester',
		lastName: 'Testoff',
		groups: ['admin', 'tester'],
	},
	{
		email: 'test4@test.com',
		firstName: 'Tester',
		lastName: 'Testoff',
		groups: ['admin', 'tester'],
	},
	{
		email: 'test5@test.com',
		firstName: 'Tester',
		lastName: 'Testoff',
		groups: ['admin', 'tester'],
	},
];


export class DatabaseSetupTest extends Test {
	database;

	constructor() {
		super('Database Setup Test', 'Database setup works fine', 'Database did not set it self up successfully');
	}

	async test() {
		this.database = new Database('DatabaseSetupTest', 1, INDEXES);
		const database = await this.database.dbReady;
		return this.assertTruthy(database);
	}

	async teardown() {
		this.database.destroy();
	}
}


export class DatabaseStoreExistsTest extends Test {
	database;

	constructor() {
		super('Database Store Exists Test', 'Database store "users" exists', 'Database does not have the store "users", but should');
	}

	async test() {
		this.database = new Database('DatabaseStoreExistsTest', 1, INDEXES);
		return this.assertTruthy(this.database.users);
	}

	async teardown() {
		this.database.destroy();
	}
}


export class DatabaseDataAddTest extends Test {
	database;

	constructor() {
		super('Database Data Add Test', 'Data added successfully to the database', 'Could not add data to the database');
	}

	async setup() {
		this.database = new Database('DatabaseDataAddTest', 1, INDEXES);
	}

	async test() {
		let result;
		let exception;
		try {
			result = await this.database.users.add({
				email: 'test@test.com',
				firstName: 'Tester',
				lastName: 'Testoff',
				groups: ['admin', 'tester'],
			});
		} catch (e) {
			exception = e;
		}

		return this.assertTrue(!!result && !exception);
	}

	async teardown() {
		this.database.destroy();
	}
}


export class DatabaseDataPutTest extends Test {
	database;

	constructor() {
		super('Database Data Put Test', 'Data put successfully to the database', 'Could not put data to the database');
	}

	async setup() {
		this.database = new Database('DatabaseDataPutTest', 1, INDEXES);
	}

	async test() {
		let result;
		let exception;
		try {
			result = await this.database.users.put({
				email: 'test@test.com',
				firstName: 'Tester',
				lastName: 'Testoff',
				groups: ['admin', 'tester'],
			});
		} catch (e) {
			console.log(e);
			exception = e;
		}

		return this.assertTrue(!!result && !exception);
	}

	async teardown() {
		this.database.destroy();
	}
}


export class DatabaseGetFirstTest extends Test {
	database;

	constructor() {
		super('Database Get First Test', 'Data successfully found in the database', 'Could not find data in the database');
	}

	async setup() {
		this.database = new Database('DatabaseGetFirstTest', 1, INDEXES);
		await Promise.all(INITIAL_DATA.map(async entry => await this.database.users.add(entry)));
	}

	async test() {
		const record = await this.database.users.where('email').equals('test1@test.com').first();
		return this.assertEquals(record.email, 'test1@test.com');
	}

	async teardown() {
		this.database.destroy();
	}
}


export class DatabaseCountTest extends Test {
	database;

	constructor() {
		super('Database Count Test', 'Data successfully counted', 'Could not count entries in the database');
	}

	async setup() {
		this.database = new Database('DatabaseCountTest', 1, INDEXES);
		await Promise.all(INITIAL_DATA.map(async entry => await this.database.users.add(entry)));
	}

	async test() {
		const count = await this.database.users.count();
		return this.assertEquals(count, INITIAL_DATA.length);
	}

	async teardown() {
		this.database.destroy();
	}
}


export class DatabaseFilterCountTest extends Test {
	database;

	constructor() {
		super('Database Filter Count Test', 'Data successfully counted', 'Could not count entries in the database');
	}

	async setup() {
		this.database = new Database('DatabaseFilterCountTest', 1, INDEXES);
		await Promise.all(INITIAL_DATA.map(async entry => await this.database.users.add(entry)));
	}

	async test() {
		const count = await this.database.users.where('id').betweenInclusive(1, 3).count();
		return this.assertEquals(count, 3);
	}

	async teardown() {
		this.database.destroy();
	}
}


export class DatabaseUpgradeTest extends Test {
	database;

	constructor() {
		super('Database Upgrade Test', 'Database successfully upgraded', 'Could not upgrade the database');
	}

	async setup() {
	}

	async test() {
		this.database = new Database('DatabaseUpgradeTest', 1, INDEXES);
		const oldIndexes = [...await this.database.users.getIndexNames()];
		await this.database.close();
		this.database = new Database('DatabaseUpgradeTest', 2, INDEXES_UPGRADE);
		const newIndexes = [...await this.database.users.getIndexNames()];
		await this.assertTrue(
			oldIndexes.includes('ageIndex') && oldIndexes.includes('firstNameLastNameIndex') &&
				!oldIndexes.includes('birthDateIndex')  && !oldIndexes.includes('emailFirstNameIndex') &&
			!newIndexes.includes('ageIndex') && !newIndexes.includes('firstNameLastNameIndex') &&
				newIndexes.includes('birthDateIndex') && newIndexes.includes('emailFirstNameIndex')
		);

	}

	async teardown() {
		this.database.destroy();
	}
}


export class DatabaseStoreAllTest extends Test {
	database;

	constructor() {
		super('Database Store All Test', 'All data successfully found', 'Could not find the data in the database');
	}

	async setup() {
		this.database = new Database('DatabaseStoreAllTest', 1, INDEXES);
		await Promise.all(INITIAL_DATA.map(async entry => await this.database.users.add(entry)));
	}

	async test() {
		const all = await this.database.users.all();
		return this.assertEquals(all.length, INITIAL_DATA.length);
	}

	async teardown() {
		this.database.destroy();
	}
}


export class DatabaseOrderAscTest extends Test {
	database;

	constructor() {
		super('Database Order Ascending Test', 'Data arrived in the correct order', 'Data did not arrive in the correct order');
	}

	async setup() {
		this.database = new Database('DatabaseOrderAscTest', 1, INDEXES);
		await Promise.all(INITIAL_DATA.map(async entry => await this.database.users.add(entry)));
	}

	async test() {
		const all = await this.database.users.where('id').order(Database.ORDER_ASC).all(),
			emails = all.map(entry => entry.email);
		return this.assertArraysEquals(emails, INITIAL_DATA.map(entry => entry.email));
	}

	async teardown() {
		this.database.destroy();
	}
}


export class DatabaseOrderDescTest extends Test {
	database;

	constructor() {
		super('Database Order Descending Test', 'Data arrived in the correct order', 'Data did not arrive in the correct order');
	}

	async setup() {
		this.database = new Database('DatabaseOrderDescTest', 1, INDEXES);
		await Promise.all(INITIAL_DATA.map(async entry => await this.database.users.add(entry)));
	}

	async test() {
		const all = await this.database.users.where('id').order(Database.ORDER_DESC).all(),
			emails = all.map(entry => entry.email);
		return this.assertArraysEquals(emails, INITIAL_DATA.map(entry => entry.email).reverse());
	}

	async teardown() {
		this.database.destroy();
	}
}


export class DatabaseSkipTest extends Test {
	database;

	constructor() {
		super('Database Skip Test', 'Data arrived in the correct order', 'Data did not arrive in the correct order');
	}

	async setup() {
		this.database = new Database('DatabaseSkipTest', 1, INDEXES);
		await Promise.all(INITIAL_DATA.map(async entry => await this.database.users.add(entry)));
	}

	async test() {
		const all = await this.database.users.where('email').order(Database.ORDER_ASC).skip(2).all();
		return this.assertArraysContentEquals(all.map(entry => entry.email), ['test3@test.com', 'test4@test.com', 'test5@test.com']);
	}

	async teardown() {
		this.database.destroy();
	}
}


export class DatabaseLimitTest extends Test {
	database;

	constructor() {
		super('Database Limit Test', 'Data arrived in the correct order', 'Data did not arrive in the correct order');
	}

	async setup() {
		this.database = new Database('DatabaseLimitTest', 1, INDEXES);
		await Promise.all(INITIAL_DATA.map(async entry => await this.database.users.add(entry)));
	}

	async test() {
		const all = await this.database.users.where('email').order(Database.ORDER_ASC).limit(2).all();
		return this.assertArraysContentEquals(all.map(entry => entry.email), ['test1@test.com', 'test2@test.com']);
	}

	async teardown() {
		this.database.destroy();
	}
}


export class DatabaseSkipLimitTest extends Test {
	database;

	constructor() {
		super('Database Skip Limit Test', 'Data arrived in the correct order', 'Data did not arrive in the correct order');
	}

	async setup() {
		this.database = new Database('DatabaseSkipLimitTest', 1, INDEXES);
		await Promise.all(INITIAL_DATA.map(async entry => await this.database.users.add(entry)));
	}

	async test() {
		const all = await this.database.users.where('email').order(Database.ORDER_ASC).skip(2).limit(2).all();
		return this.assertArraysContentEquals(all.map(entry => entry.email), ['test3@test.com', 'test4@test.com']);
	}

	async teardown() {
		this.database.destroy();
	}
}


export class DatabaseDeleteTest extends Test {
	database;

	constructor() {
		super('Database Delete Test', 'Data successfully deleted', 'Data remains in the database');
	}

	async setup() {
		this.database = new Database('DatabaseDeleteTest', 1, INDEXES);
		await Promise.all(INITIAL_DATA.map(async entry => await this.database.users.add(entry)));
	}

	async test() {
		await this.database.users.where('email').equals('test1@test.com').delete();
		const all = await this.database.users.all();
		return this.assertArraysContentEquals(all.map(entry => entry.email), ['test2@test.com', 'test3@test.com', 'test4@test.com', 'test5@test.com']);
	}

	async teardown() {
		this.database.destroy();
	}
}
