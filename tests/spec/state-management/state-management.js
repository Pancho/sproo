import { tap } from '../../../fiu/js/reactive/operators.js';
import { Persistence, Store } from '../../../fiu/js/state-management.js';
import { Test } from '../../api/test.js';

export class StateManagementSetupTest extends Test {
	constructor() {
		super('State Management Setup Test', 'State Management set up successfully', 'State Management failed to set up');
	}

	async test() {
		const store = Store.get('StateManagementSetupTest');
		await this.assertTruthy(store);
	}
}

export class StateManagementDispatchTest extends Test {
	store;

	constructor() {
		super('State Management Dispatch Test', 'Dispatch processed successfully', 'Dispatch failed to process');
	}

	async setup() {
		this.store = Store.get('StateManagementSetupTest');
	}

	async test() {
		this.store.dispatch(new class TestAction {
			slice = 'test/value';

			constructor() {
			}

			reducer(currentState) {
				currentState.value = 1234567890;
			}
		}());
		let subscription;
		const result = await new Promise(resolve => {
			subscription = this.store.select('test/value').pipe(
				tap(storeResult => {
					resolve(storeResult);
				}),
			).subscribe();
		});
		subscription.unsubscribe();
		await this.assertEquals(result, 1234567890);
	}

	async teardown() {
		this.store.clearStore();
	}
}

export class StateManagementPersistenceLocalStorageTest extends Test {
	store;

	constructor() {
		super('State Management Persistence Local Storage Test', 'Persistence to localStorage processed successfully', 'Persistence to localStorage failed to process');
	}

	async setup() {
		this.store = Store.get('StateManagementPersistenceLocalStorageTest', new class LocalStoragePersistence extends Persistence {
			getItem(key) {
				return JSON.parse(localStorage.getItem(key));
			}

			setItem(key, object) {
				localStorage.setItem(key, JSON.stringify(object));
			}
		}());
	}

	async test() {
		const number = Math.random();
		this.store.dispatch(new class TestAction {
			slice = 'test/value';

			reducer(currentState) {
				currentState.value = number;
			}
		}());
		await this.assertEquals(JSON.stringify(JSON.parse(localStorage.getItem('fiu/store'))['StateManagementPersistenceLocalStorageTest']), `{"test":{"value":${number}}}`);
	}

	async teardown() {
		this.store.clearStore();
		localStorage.removeItem(Store.STORE_KEY);
	}
}
