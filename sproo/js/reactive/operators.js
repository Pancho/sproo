import {EmptyObservable, Observable} from './observable.js';
import {InnerSubscriber, OuterSubscriber, Subscriber} from './subscriber.js';

function subscribeToResult(outerSubscriber, result, outerValue, outerIndex) {
	const destination = new InnerSubscriber(outerSubscriber, outerValue, outerIndex);

	if (destination.closed) {
		return null;
	}

	if (result instanceof Observable) {
		destination.syncErrorThrowable = true;

		return result.subscribe(destination);
	} else if (Boolean(result) && Array.isArray(result)) {
		for (let i = 0, len = result.length; i < len && !destination.closed; i += 1) {
			destination.next(result[i]);
		}

		if (!destination.closed) {
			destination.complete();
		}
	} else {
		destination.error(new TypeError('Must provide a stream'));
	}

	return null;
}

class SnapshotSubscriber extends Subscriber {
	[Symbol.toStringTag] = 'SnapshotSubscriber';

	constructor(destination, prefix) {
		super(destination);
		this.prefix = prefix;
	}

	innerNext(value) {
		if (this.prefix) {
			console.log(this.prefix, value);
		} else {
			console.log(value);
		}

		this.destination.next(value);
	}
}

export function snapshot(prefix) {
	return (source) => source.lift((subscriber) => source.subscribe(new SnapshotSubscriber(subscriber, prefix)));
}

class PluckSubscriber extends Subscriber {
	[Symbol.toStringTag] = 'PluckSubscriber';

	constructor(destination, path) {
		super(destination);
		this.path = path;
	}

	innerNext(value) {
		let result = null;

		try {
			result = this.path.reduce((newValue, slice) => newValue[slice], value);
		} catch (err) {
			this.destination.error(err);

			return;
		}

		this.destination.next(result);
	}
}

export function pluck(...path) {
	return (source) => source.lift((subscriber) => source.subscribe(new PluckSubscriber(subscriber, path)));
}

class MapSubscriber extends Subscriber {
	[Symbol.toStringTag] = 'MapSubscriber';

	constructor(destination, projector, thisArg) {
		super(destination);
		this.projector = projector;
		this.count = 0;
		this.thisArg = thisArg || this;
	}

	innerNext(value) {
		let result = null;

		try {
			result = this.projector.call(this.thisArg, value, this.count += 1);
		} catch (err) {
			this.destination.error(err);

			return;
		}

		this.destination.next(result);
	}
}

export function map(projector, thisArg) {
	return (source) => source.lift((subscriber) => source.subscribe(new MapSubscriber(subscriber, projector, thisArg)));
}

class MapToSubscriber extends Subscriber {
	[Symbol.toStringTag] = 'MapToSubscriber';

	constructor(destination, value) {
		super(destination);
		this.value = value;
	}


	innerNext() {
		this.destination.next(this.value);
	}
}

export function mapTo(value) {
	return (source) => source.lift((subscriber) => source.subscribe(new MapToSubscriber(subscriber, value)));
}

class FilterSubscriber extends Subscriber {
	[Symbol.toStringTag] = 'FilterSubscriber';

	constructor(destination, predicate) {
		super(destination);
		this.predicate = predicate;
		this.count = 0;
	}

	innerNext(value) {
		let result = null;

		try {
			result = this.predicate(value, this.count += 1);
		} catch (err) {
			this.destination.error(err);

			return;
		}

		if (result) {
			this.destination.next(value);
		}
	}
}

export function filter(predicate) {
	return (source) => source.lift((subscriber) => source.subscribe(new FilterSubscriber(subscriber, predicate)));
}

class TapSubscriber extends Subscriber {
	[Symbol.toStringTag] = 'TapSubscriber';

	constructor(destination, nextOrObserver, error, complete) {
		super(destination);
		const safeSubscriber = new Subscriber(nextOrObserver, error, complete);

		safeSubscriber.syncErrorThrowable = true;
		this.add(safeSubscriber);
		this.safeSubscriber = safeSubscriber;
	}

	innerNext(value) {
		this.safeSubscriber.next(value);

		if (this.safeSubscriber.syncErrorThrown) {
			this.destination.error(this.safeSubscriber.syncErrorValue);
		} else {
			this.destination.next(value);
		}
	}

	innerError(err) {
		this.safeSubscriber.error(err);

		if (this.safeSubscriber.syncErrorThrown) {
			this.destination.error(this.safeSubscriber.syncErrorValue);
		} else {
			this.destination.error(err);
		}
	}

	innerComplete() {
		this.safeSubscriber.complete();

		if (this.safeSubscriber.syncErrorThrown) {
			this.destination.error(this.safeSubscriber.syncErrorValue);
		} else {
			this.destination.complete();
		}
	}
}

export function tap(nextOrObserver, error, complete) {
	return (source) => source.lift((subscriber) => source.subscribe(new TapSubscriber(subscriber, nextOrObserver, error, complete)));
}

class CatchErrorOuterSubscriber extends OuterSubscriber {
	[Symbol.toStringTag] = 'CatchErrorOuterSubscriber';

	constructor(destination, selector, caught) {
		super(destination);
		this.selector = selector;
		this.caught = caught;
	}

	error(err) {
		if (!this.stopped) {
			let result = null;

			try {
				result = this.selector(err, this.caught);
			} catch (innerError) {
				super.error(innerError);

				return;
			}

			this.unsubscribeAndRecycle();
			this.add(subscribeToResult(this, result));
		}
	}
}

export function catchError(selector) {
	return (source) => {
		const caught = source.lift((subscriber) => {
			source.subscribe(new CatchErrorOuterSubscriber(subscriber, selector, caught));
		});

		return caught;
	};
}

class TakeSubscriber extends Subscriber {
	[Symbol.toStringTag] = 'TakeSubscriber';

	constructor(destination, total) {
		super(destination);
		this.total = total;
		this.count = 0;
	}

	innerNext(value) {
		this.count += 1;

		if (this.count <= this.total) {
			this.destination.next(value);

			if (this.count === this.total) {
				this.destination.complete();
				this.unsubscribe();
			}
		}
	}
}

export function take(count) {
	return (source) => {
		if (count === 0) {
			return new EmptyObservable;
		}

		return source.lift((subscriber) => {
			if (count < 0) {
				throw new Error('Take "count" parameter must be less or greater than zero (0).');
			}

			return source.subscribe(new TakeSubscriber(subscriber, count));
		});
	};
}

class SkipSubscriber extends Subscriber {
	[Symbol.toStringTag] = 'SkipSubscriber';

	constructor(destination, total) {
		super(destination);
		this.total = total;
		this.count = 0;
	}

	innerNext(value) {
		this.count += 1;

		if (this.count > this.total) {
			this.destination.next(value);
		}
	}
}

export function skip(count) {
	return (source) => source.lift((subscriber) => source.subscribe(new SkipSubscriber(subscriber, count)));
}

class TakeUntilOuterSubscriber extends OuterSubscriber {
	[Symbol.toStringTag] = 'TakeUntilOuterSubscriber';

	constructor(destination, notifier) {
		super(destination);
		this.notifier = notifier;
		this.add(subscribeToResult(this, notifier));
	}

	notifyNext() {
		this.complete();
	}

	notifyComplete() {
		// Noop
	}
}

export function takeUntil(notifier) {
	return (source) => source.lift((subscriber) => source.subscribe(new TakeUntilOuterSubscriber(subscriber, notifier)));
}

class SwitchMapOuterSubscriber extends OuterSubscriber {
	[Symbol.toStringTag] = 'SwitchMapOuterSubscriber';
	projector;
	innerSubscription;

	constructor(destination, projector) {
		super(destination);
		this.projector = projector;
	}

	innerNext(value) {
		let result = null;

		try {
			result = this.projector(value);
		} catch (error) {
			this.destination.error(error);

			return;
		}

		this.innerSubscribe(result, value);
	}

	innerSubscribe(result, value) {
		const innerSubscription = this.innerSubscription;
		let innerSubscriber = null,
			destination = null;

		if (innerSubscription) {
			innerSubscription.unsubscribe();
		}

		innerSubscriber = new InnerSubscriber(this, value);
		destination = this.destination;

		destination.add(innerSubscriber);
		this.innerSubscription = subscribeToResult(this, result);

		if (this.innerSubscription !== innerSubscriber) {
			destination.add(this.innerSubscription);
		}
	}

	innerComplete() {
		if (!this.innerSubscription || this.innerSubscription.closed) {
			super.innerComplete();
		}
	}

	internalUnsubscribe() {
		this.innerSubscription = null;
	}

	notifyComplete(innerSub) {
		this.remove(innerSub);
		this.innerSubscription = null;

		if (this.stopped) {
			super.innerComplete();
		}
	}

	notifyNext(outerValue, innerValue) {
		this.destination.next(innerValue);
	}
}

export function switchMap(projector) {
	return (source) => source.lift((subscriber) => source.subscribe(new SwitchMapOuterSubscriber(subscriber, projector)));
}

class DistinctUntilChangedSubscriber extends Subscriber {
	[Symbol.toStringTag] = 'DistinctUntilChangedSubscriber';

	constructor(destination, compare, keySelector) {
		super(destination);
		this.keySelector = keySelector;
		this.hasKey = false;

		if (typeof compare === 'function') {
			this.compare = compare;
		}
	}

	compare(x, y) {
		return x === y;
	}

	innerNext(value) {
		let key = value,
			result = false;

		if (this.keySelector) {
			try {
				key = this.keySelector(value);
			} catch (err) {
				this.destination.error(err);
			}
		}

		if (this.hasKey) {
			try {
				result = this.compare(this.key, key);
			} catch (err) {
				this.destination.error(err);
			}
		} else {
			this.hasKey = true;
		}

		if (!result) {
			this.key = key;
			this.destination.next(value);
		}
	}
}

export function distinctUntilChanged(compare, keySelector) {
	return (source) => source.lift((subscriber) => source.subscribe(new DistinctUntilChangedSubscriber(subscriber, compare, keySelector)));
}

class ScanSubscriber extends Subscriber {
	[Symbol.toStringTag] = 'ScanSubscriber';

	constructor(destination, accumulator, _seed, hasSeed) {
		super(destination);
		this.accumulator = accumulator;
		this.internalSeed = _seed;
		this.hasSeed = hasSeed;
		this.index = 0;
	}

	get seed() {
		return this.internalSeed;
	}

	set seed(value) {
		this.hasSeed = true;
		this.internalSeed = value;
	}

	innerNext(value) {
		if (this.hasSeed) {
			this.internalTryNext(value);
		}

		this.seed = value;
		this.destination.next(value);
	}

	internalTryNext(value) {
		let result = null;

		try {
			result = this.accumulator(this.seed, value, this.index);
		} catch (err) {
			this.destination.error(err);
		}

		this.index += 1;
		this.seed = result;
		this.destination.next(result);
	}
}

export function scan(accumulator, seed) {
	return (source) => source.lift((subscriber) => source.subscribe(new ScanSubscriber(subscriber, accumulator, seed, Boolean(seed))));
}

class WithLatestFromSubscriber extends OuterSubscriber {
	[Symbol.toStringTag] = 'WithLatestFromSubscriber';

	constructor(destination, observables, project) {
		super(destination);
		this.project = project;
		this.toRespond = [];
		const len = observables.length;

		this.values = new Array(len);

		for (let i = 0; i < len; i += 1) {
			this.toRespond.push(i);
		}

		for (let i = 0; i < len; i += 1) {
			const observable = observables[i];

			this.add(subscribeToResult(this, observable, observable, i));
		}
	}

	notifyNext(outerValue, innerValue, outerIndex) {
		this.values[outerIndex] = innerValue;

		if (this.toRespond.length > 0) {
			const found = this.toRespond.indexOf(outerIndex);

			if (found !== -1) {
				this.toRespond.splice(found, 1);
			}
		}
	}

	notifyComplete() {
		// Noop
	}

	innerNext(value) {
		if (this.toRespond.length === 0) {
			const args = [value, ...this.values];

			if (this.project) {
				let result = null;

				try {
					result = this.project(args);
				} catch (err) {
					this.destination.error(err);

					return;
				}

				this.destination.next(result);
			} else {
				this.destination.next(args);
			}
		}
	}
}

export function withLatestFrom(...args) {
	return (source) => {
		let project = null;

		if (typeof args[args.length - 1] === 'function') {
			project = args.pop();
		}

		const observables = args;

		return source.lift((subscriber) => source.subscribe(new WithLatestFromSubscriber(subscriber, observables, project)));
	};
}

class SwitchFirstMapSubscriber extends OuterSubscriber {
	[Symbol.toStringTag] = 'SwitchFirstMapSubscriber';

	constructor(destination, project, resultSelector) {
		super(destination);
		this.project = project;
		this.resultSelector = resultSelector;
		this.hasSubscription = false;
		this.hasCompleted = false;
		this.index = 0;
	}

	innerNext(value) {
		if (!this.hasSubscription) {
			this.tryNext(value);
		}
	}

	tryNext(value) {
		try {
			const result = this.project(value, this.index);

			this.hasSubscription = true;
			this.add(subscribeToResult(this, result, value, this.index));
		} catch (err) {
			this.destination.error(err);
		}

		this.index += 1;
	}

	innerComplete() {
		this.hasCompleted = true;

		if (!this.hasSubscription) {
			this.destination.complete();
		}
	}

	notifyNext(outerValue, innerValue, outerIndex, innerIndex) {
		if (this.resultSelector) {
			this.trySelectResult(outerValue, innerValue, outerIndex, innerIndex);
		} else {
			this.destination.next(innerValue);
		}
	}

	trySelectResult(outerValue, innerValue, outerIndex, innerIndex) {
		try {
			const result = this.resultSelector(outerValue, innerValue, outerIndex, innerIndex);

			this.destination.next(result);
		} catch (err) {
			this.destination.error(err);
		}
	}

	notifyError(err) {
		this.destination.error(err);
	}

	notifyComplete(innerSub) {
		this.remove(innerSub);
		this.hasSubscription = false;

		if (this.hasCompleted) {
			this.destination.complete();
		}
	}
}

export function exhaustMap(project, resultSelector) {
	return (source) => source.lift((subscriber) => source.subscribe(new SwitchFirstMapSubscriber(subscriber, project, resultSelector)));
}

class HandlePromiseSubscriber extends Subscriber {
	[Symbol.toStringTag] = 'HandlePromiseSubscriber';

	constructor(destination, thenHandler, catchHandler) {
		super(destination);
		this.thenHandler = thenHandler;
		this.catchHandler = catchHandler;
		this.count = 0;
	}

	innerNext(promise) {
		try {
			if (this.thenHandler) {
				promise.then((...args) => {
					this.destination.next(this.thenHandler(...args));
				});
			} else {
				promise.then((...args) => {
					this.destination.next(...args);
				});
			}

			if (this.catchHandler) {
				promise.catch((err) => {
					this.destination.next(this.catchHandler(err));
				});
			} else {
				promise.catch((err) => {
					this.destination.error(err);
				});
			}
		} catch (err) {
			this.destination.error(err);
		}
	}
}

export function handlePromise(thenHandler, catchHandler) {
	return (source) => source.lift((subscriber) => source.subscribe(new HandlePromiseSubscriber(subscriber, thenHandler, catchHandler)));
}
