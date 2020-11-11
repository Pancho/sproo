// This is an IndexedDB wrapper with a more friendly interface
// TODO: docs
export class Database {
	name;
	dbReady;
	version = 1;

	constructor(name, version, indexesConfig) {
		this.name = name;

		if (!!version) {
			if (typeof version === 'number') {
				this.version = version;
			} else {
				throw new Error('IndexedDB version must be a number!');
			}
		}

		this.dbReady = new Promise((resolve, reject) => {
			const openRequest = window.indexedDB.open(this.name, this.version);

			openRequest.onupgradeneeded = ev => {
				try {
					const database = ev.target.result;

					Object.entries(indexesConfig).forEach(([storeName, storeConfig]) => {
						if (!database.objectStoreNames.contains(`${storeName}Store`)) {
							const objectStore = database.createObjectStore(`${storeName}Store`, storeConfig.options);
							objectStore.createIndex(`${storeConfig.options.keyPath}Index`, storeConfig.options.keyPath, {unique: true});
							Object.entries(storeConfig.indexedFields).forEach(([index, indexConfig]) => {
								objectStore.createIndex(`${index}Index`, index, indexConfig);
							});
						}
					});
				} catch (e) {
					reject(e);
				}
			};

			openRequest.onsuccess = ev => {
				resolve(ev.target.result, ev);
			};

			openRequest.onerror = ev => {
				reject(ev);
			};
		});

		Object.entries(indexesConfig).forEach(([storeName, storeConfig]) => {
			this[storeName] = new Store(storeName, storeConfig, this.dbReady);
		});
	}

	destroy() {
		this.dbReady.then(database => {
			database.close();
			window.indexedDB.deleteDatabase(this.name);
		});
	}
}

export class Direction {
	static ASC = 'next';
	static DESC = 'prev';
}


class Store {
	name;
	config;
	dbReady;

	constructor(name, config, dbReady) {
		this.name = name;
		this.storeName = `${name}Store`;
		this.config = config;
		this.dbReady = dbReady;
	}

	async add(obj) {
		return new Promise(async (resolve, reject) => {
			const database = await this.dbReady,
				transaction = database.transaction([this.storeName], 'readwrite'),
				objectStore = transaction.objectStore(this.storeName),
				request = objectStore.add(obj);
			request.onsuccess = ev => {
				resolve(ev);
			};
			request.onerror = ev => {
				reject(ev);
			};
		});
	}

	async put(obj) {
		return new Promise(async (resolve, reject) => {
			const database = await this.dbReady,
				transaction = database.transaction([this.storeName], 'readwrite'),
				objectStore = transaction.objectStore(this.storeName),
				request = objectStore.put(obj);
			request.onerror = ev => {
				reject(ev);
			};
			request.onsuccess = ev => {
				resolve(ev);
			};
		});
	}

	async count() {
		const cursor = new Cursor(this.dbReady, this.storeName, this.config.options.keyPath);
		return await cursor.count();
	}

	async all() {
		const cursor = new Cursor(this.dbReady, this.storeName, this.config.options.keyPath);
		return await cursor.all();
	}

	where(field) {
		return new Cursor(this.dbReady, this.storeName, field);
	}
}


class Cursor {
	dbReady;
	storeName;
	field;
	exact;
	upperBounds;
	upperBoundsInclusive = false;
	lowerBounds;
	lowerBoundsInclusive = false;
	direction = 'next';

	constructor(dbReady, storeName, field) {
		this.dbReady = dbReady;
		this.storeName = storeName;
		this.field = field;
	}

	getKeyRange() {
		let keyRange = null;
		if (!!this.exact) {
			keyRange = IDBKeyRange.only(this.exact);
		} else if (!!this.upperBounds && !this.lowerBounds) {
			keyRange = IDBKeyRange.upperBound(this.upperBounds, !this.upperBoundsInclusive);
		} else if (!this.upperBounds && !!this.lowerBounds) {
			keyRange = IDBKeyRange.lowerBound(this.lowerBounds, !this.lowerBoundsInclusive);
		} else if (!!this.upperBounds && !!this.lowerBounds) {
			keyRange = IDBKeyRange.bound(this.lowerBounds, this.upperBounds, !this.upperBoundsInclusive, !this.lowerBoundsInclusive);
		}
		return keyRange;
	}

	async all() {
		const result = [];

		return new Promise(async (resolve, reject) => {
			const database = await this.dbReady,
				transaction = database.transaction([this.storeName], 'readwrite'),
				objectStore = transaction.objectStore(this.storeName),
				index = objectStore.index(`${this.field}Index`),
				cursorRequest = index.openCursor(this.getKeyRange(), this.direction);

			cursorRequest.onsuccess = ev => {
				const cursor = ev.target.result;
				if (!!cursor) {
					result.push(cursor.value);
					cursor.continue();
				} else {
					resolve(result);
				}
			};
		});
	}

	async first() {
		return new Promise(async (resolve, reject) => {
			const database = await this.dbReady,
				transaction = database.transaction([this.storeName], 'readwrite'),
				objectStore = transaction.objectStore(this.storeName),
				index = objectStore.index(`${this.field}Index`),
				cursorRequest = index.openCursor(this.getKeyRange(), this.direction);

			cursorRequest.onsuccess = ev => {
				const cursor = ev.target.result;
				if (!!cursor) {
					resolve(cursor.value);
				} else {
					reject(ev);
				}
			};
		});
	}

	async count() {
		return new Promise(async (resolve, reject) => {
			const database = await this.dbReady,
				transaction = database.transaction([this.storeName], 'readwrite'),
				objectStore = transaction.objectStore(this.storeName),
				index = objectStore.index(`${this.field}Index`),
				cursorRequest = index.count(this.getKeyRange());

			cursorRequest.onsuccess = ev => {
				resolve(ev.target.result);
			};
		});
	}

	async delete() {
		return new Promise(async (resolve, reject) => {
			const database = await this.dbReady,
				transaction = database.transaction([this.storeName], 'readwrite'),
				objectStore = transaction.objectStore(this.storeName),
				index = objectStore.index(`${this.field}Index`),
				cursorRequest = index.openCursor(this.getKeyRange(), this.direction);

			cursorRequest.onsuccess = ev => {
				const cursor = ev.target.result;
				if (!!cursor) {
					cursor.delete();
					cursor.continue();
				} else {
					resolve(true);
				}
			};
		});
	}

	equals(value) {
		this.exact = value;
		return this;
	}

	gt(value) {
		this.upperBounds = value;
		this.upperBoundsInclusive = false;
		return this;
	}

	gte(value) {
		this.upperBounds = value;
		this.upperBoundsInclusive = true;
		return this;
	}

	lt(value) {
		this.lowerBounds = value;
		this.lowerBoundsInclusive = false;
		return this;
	}

	lte(value) {
		this.lowerBounds = value;
		this.lowerBoundsInclusive = true;
		return this;
	}

	between(lower, upper) {
		this.lowerBounds = lower;
		this.lowerBoundsInclusive = false;
		this.upperBounds = upper;
		this.upperBoundsInclusive = false;
		return this;
	}

	betweenInclusive(lower, upper) {
		this.lowerBounds = lower;
		this.lowerBoundsInclusive = true;
		this.upperBounds = upper;
		this.upperBoundsInclusive = true;
		return this;
	}

	betweenInclusiveLower(lower, upper) {
		this.lowerBounds = lower;
		this.lowerBoundsInclusive = true;
		this.upperBounds = upper;
		this.upperBoundsInclusive = false;
		return this;
	}

	betweenInclusiveUpper(lower, upper) {
		this.lowerBounds = lower;
		this.lowerBoundsInclusive = false;
		this.upperBounds = upper;
		this.upperBoundsInclusive = true;
		return this;
	}

	// skip(count) {
	// }
	//
	// limit(count) {
	// }

	order(direction) {
		this.direction = direction;
		return this;
	}
}
