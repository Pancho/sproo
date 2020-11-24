// This is an IndexedDB wrapper with a more friendly interface
// TODO: docs
export class Database {
	name;
	dbReady;
	version = 1;

	static ORDER_ASC = 'next';
	static ORDER_DESC = 'prev';

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
						const fullStoreName = `${storeName}Store`;
						if (!database.objectStoreNames.contains(fullStoreName)) {
							const objectStore = database.createObjectStore(fullStoreName, storeConfig.options);
							// Default or rather pk index (not implicit, as one might think...)
							objectStore.createIndex(`${storeConfig.options.keyPath}Index`, storeConfig.options.keyPath, {unique: true});
							Object.entries(storeConfig.indexedFields).forEach(([index, indexConfig]) => {
								objectStore.createIndex(`${index}Index`, index, indexConfig);
							});
							storeConfig.composites.forEach(composite => {
								const compositeIndexName = [composite.fields[0], ...composite.fields.slice(1)
									.reduce((acc, cur) => `${acc}${cur.charAt(0).toUpperCase() + cur.slice(1)}`, '')].join('');
								objectStore.createIndex(`${compositeIndexName}Index`, composite.fields, composite.config);
							});
						} else {
							if (!!storeConfig.upgrade) {
								const objectStore = openRequest.transaction.objectStore(fullStoreName);
								if (!!storeConfig.upgrade.delete) {
									storeConfig.upgrade.delete.forEach(deleteIndex => objectStore.deleteIndex(`${deleteIndex}Index`));
								}
								if (!!storeConfig.upgrade.add) {
									Object.entries(storeConfig.upgrade.add).forEach(
										([index, indexConfig]) => objectStore.createIndex(`${index}Index`, index, indexConfig),
									);
								}
								if (!!storeConfig.upgrade.addComposites) {
									storeConfig.upgrade.addComposites.forEach(
										composite => {
											const compositeIndexName = [composite.fields[0], ...composite.fields.slice(1)
												.reduce((acc, cur) => `${acc}${cur.charAt(0).toUpperCase() + cur.slice(1)}`, '')].join('');
											objectStore.createIndex(`${compositeIndexName}Index`, composite.fields, composite.config);
										},
									);
								}
							}
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

	get [Symbol.toStringTag]() {
		return 'Database';
	}


	destroy() {
		this.dbReady.then(database => {
			database.close();
			window.indexedDB.deleteDatabase(this.name);
		});
	}

	close() {
		this.dbReady.then(database => {
			database.close();
		});
	}
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

	get [Symbol.toStringTag]() {
		return 'Store';
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

	async getIndexNames() {
		return new Promise(async (resolve, reject) => {
			const database = await this.dbReady,
				transaction = database.transaction([this.storeName], 'readwrite'),
				objectStore = transaction.objectStore(this.storeName);
			resolve(objectStore.indexNames);
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
	skipCount = 0;
	limitCount = 0;
	useDistinct = false;

	constructor(dbReady, storeName, field) {
		this.dbReady = dbReady;
		this.storeName = storeName;
		this.field = field;
	}

	get [Symbol.toStringTag]() {
		return 'Cursor';
	}

	getKeyRange() {
		let keyRange = undefined;
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

	getDirectionParameter() {
		if (!!this.useDistinct) {
			return `${this.direction}unique`;
		} else {
			return this.direction;
		}
	}

	async all() {
		const result = [];

		return new Promise(async (resolve, reject) => {
			const database = await this.dbReady,
				transaction = database.transaction([this.storeName], 'readwrite'),
				objectStore = transaction.objectStore(this.storeName);

			let cursorRequest = null;

			if (objectStore.keyPath === this.field) {
				cursorRequest = objectStore.openCursor(this.getKeyRange(), this.getDirectionParameter());
			} else {
				cursorRequest = objectStore.index(`${this.field}Index`).openCursor(this.getKeyRange(), this.getDirectionParameter());
			}

			cursorRequest.onsuccess = ev => {
				const cursor = ev.target.result;
				if (!!cursor && !(this.limitCount > 0 && result.length === this.limitCount)) {
					if (this.skipCount > 0) {
						try {
							cursor.advance(this.skipCount);
						} catch (e) {
							reject(ev);
						}
						this.skipCount = 0;
					} else {
						result.push(cursor.value);
						cursor.continue();
					}
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
				cursorRequest = index.openCursor(this.getKeyRange(), this.getDirectionParameter());

			cursorRequest.onsuccess = ev => {
				const cursor = ev.target.result;
				if (!!cursor) {
					if (this.skipCount > 0) {
						try {
							cursor.advance(this.skipCount);
						} catch (e) {
							reject(e);
						}
					} else {
						resolve(cursor.value);
					}
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
				objectStore = transaction.objectStore(this.storeName);

			let cursorRequest = null;

			if (objectStore.keyPath === this.field) {
				cursorRequest = objectStore.count(this.getKeyRange());
			} else {
				cursorRequest = objectStore.index(`${this.field}Index`).count(this.getKeyRange());
			}
			cursorRequest.onsuccess = ev => {
				resolve(ev.target.result);
			};
		});
	}


	/**
	 * This method will delete all records that your query has picked from the store.
	 *
	 * Delete ignores skip and limit. If you want to delete records, please make sure manually that the ones you want gone, are carefully
	 * picked
	 *
	 * Once the deletion is done, you will get a boolean value if it was successful.
	 *
	 * @returns {Promise<boolean>}
	 */
	async delete() {
		return new Promise(async (resolve, reject) => {
			const database = await this.dbReady,
				transaction = database.transaction([this.storeName], 'readwrite'),
				objectStore = transaction.objectStore(this.storeName),
				index = objectStore.index(`${this.field}Index`),
				cursorRequest = index.openCursor(this.getKeyRange(), this.getDirectionParameter());

			cursorRequest.onsuccess = ev => {
				try {
					const cursor = ev.target.result;
					if (!!cursor) {
						cursor.delete();
						cursor.continue();
					} else {
						resolve(true);
					}
				} catch (e) {
					reject(false);
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

	skip(count) {
		this.skipCount = count;
		return this;
	}

	limit(count) {
		this.limitCount = count;
		return this;
	}

	order(direction) {
		this.direction = direction;
		return this;
	}

	distinct() {
		this.useDistinct = true;
		return this;
	}
}
