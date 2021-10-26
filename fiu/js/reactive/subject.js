import {Observable} from './observable.js';
import {SubjectSubscription, Subscription} from './subscriber.js';

export class Subject extends Observable {
	[Symbol.toStringTag] = 'Subject';
	observers = [];
	closed = false;
	stopped = false;
	hasError = false;
	thrownError = null;

	lift(operator) {
		const subject = new AnonymousSubject(this, this);

		subject.operator = operator;

		return subject;
	}

	next(value) {
		if (this.closed) {
			throw new Error('Unsubscribe Error');
		}

		if (!this.stopped) {
			const {observers} = this,
				len = observers.length,
				copy = observers.slice();
			let i = 0;

			for (; i < len; i += 1) {
				copy[i].next(value);
			}
		}
	}

	error(err) {
		if (this.closed) {
			throw new Error('Unsubscribe Error');
		}

		this.hasError = true;
		this.thrownError = err;
		this.stopped = true;
		const {observers} = this,
			len = observers.length,
			copy = observers.slice();
		let i = 0;

		for (; i < len; i += 1) {
			copy[i].error(err);
		}

		this.observers.length = 0;
	}

	complete() {
		if (this.closed) {
			throw new Error('Unsubscribe Error');
		}

		this.stopped = true;
		const {observers} = this,
			len = observers.length,
			copy = observers.slice();
		let i = 0;

		for (; i < len; i += 1) {
			copy[i].complete();
		}

		this.observers.length = 0;
	}

	unsubscribe() {
		this.stopped = true;
		this.closed = true;
		this.observers = null;
	}

	internalTrySubscribe(subscriber) {
		if (this.closed) {
			throw new Error('Subject closed');
		} else {
			return super.internalTrySubscribe(subscriber);
		}
	}

	internalSubscribe(subscriber) {
		if (this.closed) {
			throw new Error('Subject closed');
		} else if (this.hasError) {
			subscriber.error(this.thrownError);

			return Subscription.EMPTY;
		} else if (this.stopped) {
			subscriber.complete();

			return Subscription.EMPTY;
		} else {
			this.observers.push(subscriber);

			return new SubjectSubscription(this, subscriber);
		}
	}
}

export class AnonymousSubject extends Subject {
	[Symbol.toStringTag] = 'AnonymousSubject';

	constructor(destination, source) {
		super();
		this.destination = destination;
		this.source = source;
	}

	next(value) {
		if (this.destination && this.destination.next) {
			this.destination.next(value);
		}
	}

	error(err) {
		if (this.destination && this.destination.error) {
			this.destination.error(err);
		}
	}

	complete() {
		if (this.destination && this.destination.complete) {
			this.destination.complete();
		}
	}

	internalSubscribe(subscriber) {
		if (this.source) {
			return this.source.subscribe(subscriber);
		}

		return Subscription.EMPTY;
	}
}

export class BehaviorSubject extends Subject {
	[Symbol.toStringTag] = 'BehaviorSubject';
	innerValue;

	constructor(value) {
		super();
		this.innerValue = value;
	}

	get value() {
		return this.getValue();
	}

	internalSubscribe(subscriber) {
		const subscription = super.internalSubscribe(subscriber);

		if (subscription && !subscription.closed) {
			subscriber.next(this.innerValue);
		}

		return subscription;
	}

	getValue() {
		if (this.hasError) {
			throw this.thrownError;
		} else if (this.closed) {
			throw new Error('BehaviorSubject closed');
		} else {
			return this.innerValue;
		}
	}

	next(value) {
		super.next(this.innerValue = value);
	}
}
