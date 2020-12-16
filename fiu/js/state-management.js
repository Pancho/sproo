import {Observable} from './reactive/observable.js';
import {filter, pluck, tap} from './reactive/operators.js';
import {BehaviorSubject} from './reactive/subject.js';

let globalStore = {};

class State extends BehaviorSubject {
	[Symbol.toStringTag] = 'State';
	store;

	constructor(store, action$) {
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
	persist;
	store;
	slice;
	action$;
	source;

	constructor(slice, persist) {
		super();

		if (persist) {
			const existing = localStorage.getItem(Store.STORE_KEY);

			if (existing) {
				globalStore = JSON.parse(existing);
			}
		}

		this.persist = persist;
		this.slice = slice;
		this.store = Store.getSlice(slice, globalStore);
		this.action$ = new BehaviorSubject(this.store);
		this.source = new State(this.store, this.action$);
	}

	dispatch(action) {
		this.action$.next(action);
	}

	select(slice) { // Must return an Observable, so one can pipe the updated state when it is updated
		return this.pipe(
			filter((update) => (update.slice === slice || update.slice === 'initial') &&
				Object.keys(update.state).length !== 0 && update.state.constructor === Object),
			pluck('state', ...slice.split('/')),
			tap(() => {
				localStorage.setItem(Store.STORE_KEY, JSON.stringify(globalStore));
			}),
		);
	}

	static get(slice, persist = false) {
		return new Store(slice, persist);
	}

	static getSlice(slice, store) {
		return slice.split('/').reduce((prevSlice, nextSlice) => {
			if (!prevSlice[nextSlice]) {
				prevSlice[nextSlice] = {};
			}

			return prevSlice[nextSlice];
		}, store);
	}
}
