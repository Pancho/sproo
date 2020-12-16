import {Observable} from './reactive/observable.js';
import {filter, pluck} from './reactive/operators.js';
import {BehaviorSubject} from './reactive/subject.js';

let globalStore = {};

class State extends BehaviorSubject {
	[Symbol.toStringTag] = 'State';
	store;

	constructor(store, action$, persistence) {
		super(store);
		this.store = store;
		this.stateSubscription = action$.subscribe((action) => {
			if (action.slice) {
				const actionSliceArray = action.slice.split('/'),
					key = actionSliceArray.splice(0, actionSliceArray.length - 1).join('/'),
					state = Store.getSlice(
						key,
						this.store,
					);

				action.reducer(state);
				this.next({
					slice: action.slice,
					state: this.store,
				});

				if (persistence) {
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

	complete() {
		this.stateSubscription.unsubscribe();
		super.complete();
	}
}

export default class Store extends Observable {
	[Symbol.toStringTag] = 'Store';
	static STORE_KEY = 'fiu/store';
	persistence;
	store;
	slice;
	action$;
	source;

	constructor(slice, persistence) {
		super();

		if (persistence) {
			const existing = persistence.getItem(Store.STORE_KEY);

			if (existing) {
				globalStore = existing;
			}
		}

		this.persistence = persistence;
		this.slice = slice;
		this.store = Store.getSlice(slice, globalStore);
		this.action$ = new BehaviorSubject(this.store);
		this.source = new State(this.store, this.action$, persistence);
	}

	dispatch(action) {
		this.action$.next(action);
	}

	select(slice) { // Must return an Observable, so one can pipe the updated state when it is updated
		return this.pipe(
			filter((update) => (update.slice === slice || update.slice === 'initial') &&
					Object.keys(update.state).length !== 0 && update.state.constructor === Object
			),
			pluck('state', ...slice.split('/')),
		);
	}

	clearStore() {
		globalStore = {};
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
	getItem() {
		throw Error('Persistence.getItem(key) has to be implemented');
	}

	setItem() {
		throw Error('Persistence.setItem(key, object) has to be implemented');
	}
}
