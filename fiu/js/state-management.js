import { Observable } from './reactive/observable.js';
import { filter, pluck } from './reactive/operators.js';
import { BehaviorSubject } from './reactive/subject.js';

let store = {
	// random: Math.random(),
};

class State extends BehaviorSubject {
	store;

	constructor(sliceStore, action$, persistence) {
		super(sliceStore);
		this.store = sliceStore;
		this.stateSubscription = action$.subscribe(action => {
			if (!!action.slice) {
				const actionSliceArray = action.slice.split('/');
				const key = actionSliceArray.splice(0, actionSliceArray.length - 1).join('/');
				let state = Store.getSlice(
					key,
					this.store,
				);
				action.reducer(state);
				this.next({
					slice: action.slice,
					state: this.store,
				});
				if (!!persistence) {
					persistence.setItem(Store.STORE_KEY, store);
				}
			} else {
				this.next({
					slice: 'initial',
					state: this.store,
				});
			}
		});
	}

	get [Symbol.toStringTag]() {
		return 'State';
	}

	complete() {
		this.stateSubscription.unsubscribe();
		super.complete();
	}
}

export class Store extends Observable {
	static STORE_KEY = 'fiu/store';
	persistence;
	store;
	slice;
	action$;
	source;

	constructor(slice, persistence) {
		super();

		if (!!persistence) {
			const existing = persistence.getItem(Store.STORE_KEY);
			if (!!existing) {
				store = existing;
			}
		}

		this.persistence = persistence;
		this.slice = slice;
		this.store = Store.getSlice(slice, store);
		this.action$ = new BehaviorSubject(this.store);
		this.source = new State(this.store, this.action$, persistence);
	}

	get [Symbol.toStringTag]() {
		return 'Store';
	}

	dispatch(action) {
		this.action$.next(action);
	}

	select(slice) { // Must return an Observable, so one can pipe the updated state when it is updated
		return this.pipe(
			filter(update => {
				return (update.slice === slice || update.slice === 'initial') &&
					Object.keys(update.state).length !== 0 && update.state.constructor === Object;
			}),
			pluck('state', ...slice.split('/')),
		);
	}

	clearStore() {
		store = {};
	}

	static get(slice, persist = false) {
		return new Store(slice, persist);
	}

	static getSlice(slice, storeCtx) {
		return slice.split('/').reduce((prevSlice, nextSlice) => {
			if (!prevSlice[nextSlice]) {
				prevSlice[nextSlice] = {};
			}
			return prevSlice[nextSlice];
		}, storeCtx);
	}
}


export class Persistence {
	getItem(key) {
		throw Error('Persistence.getItem(key) has to be implemented');
	}

	setItem(key, object) {
		throw Error('Persistence.setItem(key, object) has to be implemented');
	}
}
