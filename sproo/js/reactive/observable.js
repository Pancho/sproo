import {Subscriber} from './subscriber.js';

export class Observable {
	[Symbol.toStringTag] = 'Observable';
	source;
	operator;

	constructor(subscribe) {
		if (subscribe) {
			this.internalSubscribe = subscribe;
		}
	}

	lift(operator) {
		const observable = new Observable;

		observable.source = this;
		observable.operator = operator;

		return observable;
	}

	subscribe(
		observerOrNext,
		error,
		complete,
	) {
		const sink = Subscriber.toSubscriber(observerOrNext, error, complete);

		if (this.operator) {
			sink.add(this.operator(sink));
		} else {
			sink.add(this.source || !sink.syncErrorThrowable ? this.internalSubscribe(sink) : this.internalTrySubscribe(sink));
		}

		if (sink.syncErrorThrowable) {
			sink.syncErrorThrowable = false;

			if (sink.syncErrorThrown) {
				throw sink.syncErrorValue;
			}
		}

		return sink;
	}

	internalTrySubscribe(sink) {
		try {
			return this.internalSubscribe(sink);
		} catch (err) {
			sink.syncErrorThrown = true;
			sink.syncErrorValue = err;
			sink.error(err);

			return null;
		}
	}

	internalSubscribe(subscriber) {
		return this.source && this.source.subscribe(subscriber);
	}

	pipe(...functionChain) {
		if (functionChain.length === 0) {
			return this;
		}

		if (functionChain.length === 1) {
			return functionChain[0](this);
		}

		return functionChain.reduce((previousValue, nextFunction) => nextFunction(previousValue), this);
	}
}

export class EmptyObservable extends Observable {
	[Symbol.toStringTag] = 'EmptyObservable';

	internalSubscribe(subscriber) {
		subscriber.complete();
	}
}

export function never() {
	return new Observable((observer) => observer);
}

export function of(...args) {
	return new Observable((observer) => {
		args.forEach((val) => observer.next(val));
		observer.complete();

		return observer;
	});
}

export function range(start, count) {
	return new Observable((observer) => {
		Array.from(Array(count).keys()).map((i) => i + start).forEach((val) => observer.next(val));

		observer.complete();

		return observer;
	});
}

export function fromIterable(iterable) {
	return new Observable((observer) => {
		for (const item of iterable) {
			observer.next(item);
		}

		observer.complete();

		return observer;
	});
}

export function fromEvent(source, event) {
	return new Observable((observer) => {
		const callbackFn = (e) => observer.next(e);
		let innerSource = source;

		if (typeof source === 'string') {
			innerSource = document.querySelector(source);
		}

		innerSource.addEventListener(event, callbackFn);
		observer.add(() => innerSource.removeEventListener(event, callbackFn));

		return observer;
	});
}
