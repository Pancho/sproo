const EMPTY_OBSERVER = {
	closed: true,
	next() {
	},
	error(err) {
		throw err;
	},
	complete() {
	},
};

export class Subscription {
	[Symbol.toStringTag] = 'Subscription';
	static EMPTY = (function (empty) {
		empty.closed = true;

		return empty;
	}(new Subscription));
	closed = false;
	parents = null;
	subscriptions = null;

	constructor(unsubscribe) {
		if (unsubscribe) {
			this.innerUnsubscribe = unsubscribe;
		}
	}

	unsubscribe() {
		let hasErrors = false,
			errors = null;

		if (this.closed) {
			return;
		}

		const {parents, subscriptions} = this;

		this.closed = true;
		this.parents = null;
		this.subscriptions = null;

		if (parents) {
			parents.forEach((parent) => parent.remove(this));
		}

		if (typeof this.innerUnsubscribe === 'function') {
			try {
				this.innerUnsubscribe();
			} catch (e) {
				errors = [e];
			}
		}

		if (subscriptions) {
			subscriptions.forEach((subscription) => {
				try {
					subscription.unsubscribe();
				} catch (e) {
					hasErrors = true;
					errors = errors || [];
					errors.push(e);
				}
			});
		}

		if (hasErrors) {
			throw new Error(errors);
		}
	}

	add(teardown) {
		if (!teardown || teardown === Subscription.EMPTY) {
			return Subscription.EMPTY;
		}

		if (teardown === this) {
			return this;
		}

		let subscription = teardown;

		if (typeof teardown === 'function') {
			subscription = new Subscription(teardown);
		} else if (typeof teardown === 'object') {
			if (subscription === this || subscription.closed || typeof subscription.unsubscribe !== 'function') {
				return subscription;
			} else if (this.closed) {
				subscription.unsubscribe();

				return subscription;
			}
		} else if (this.closed) {
			subscription.unsubscribe();

			return subscription;
		}

		if (!this.subscriptions) {
			this.subscriptions = [];
		}

		this.subscriptions.push(subscription);
		subscription.addParent(this);

		return subscription;
	}

	remove(subscription) {
		if (this.subscriptions) {
			const subscriptionIndex = this.subscriptions.indexOf(subscription);

			if (subscriptionIndex !== -1) {
				this.subscriptions.splice(subscriptionIndex, 1);
			}
		}
	}

	addParent(parent) {
		if (!this.parents) {
			this.parents = [parent];
		} else if (this.parents.indexOf(parent) === -1) {
			this.parents.push(parent);
		}
	}
}

export class SubjectSubscription extends Subscription {
	[Symbol.toStringTag] = 'SubjectSubscription';

	constructor(subject, subscriber) {
		super();
		this.subject = subject;
		this.subscriber = subscriber;
		this.closed = false;
	}

	unsubscribe() {
		if (this.closed) {
			return;
		}

		this.closed = true;
		const subject = this.subject,
			observers = subject.observers,
			subscriberIndex = observers.indexOf(this.subscriber);

		this.subject = null;

		if (!observers || observers.length === 0 || subject.stopped || subject.closed) {
			return;
		}

		if (subscriberIndex !== -1) {
			observers.splice(subscriberIndex, 1);
		}
	}
}

export class Subscriber extends Subscription {
	[Symbol.toStringTag] = 'Subscriber';
	syncErrorValue = null;
	syncErrorThrown = false;
	syncErrorThrowable = false;
	stopped = false;
	destination;

	constructor(destinationOrNext, error, complete) {
		super();

		if (arguments.length === 0) {
			this.destination = EMPTY_OBSERVER;
		} else if (arguments.length === 1) {
			if (!destinationOrNext) {
				this.destination = EMPTY_OBSERVER;
			} else if (typeof destinationOrNext === 'object') {
				if (destinationOrNext instanceof Subscriber) {
					this.destination = destinationOrNext;
					this.destination.add(this);
				} else {
					this.destination = new SafeSubscriber(this, destinationOrNext);
				}
			}
		} else {
			this.destination = new SafeSubscriber(this, destinationOrNext, error, complete);
		}
	}

	next(value) {
		if (!this.stopped) {
			this.innerNext(value);
		}
	}

	error(err) {
		if (!this.stopped) {
			this.stopped = true;
			this.innerError(err);
		}
	}

	complete() {
		if (!this.stopped) {
			this.stopped = true;
			this.innerComplete();
		}
	}

	unsubscribe() {
		if (this.closed) {
			return;
		}

		this.stopped = true;
		super.unsubscribe();
	}

	innerNext(value) {
		this.destination.next(value);
	}

	innerError(err) {
		this.destination.error(err);
		this.unsubscribe();
	}

	innerComplete() {
		this.destination.complete();
		this.unsubscribe();
	}

	unsubscribeAndRecycle() {
		const {parents} = this;

		this.parents = null;
		this.unsubscribe();
		this.closed = false;
		this.stopped = false;
		this.parents = parents;

		return this;
	}

	static toSubscriber(observerOrNext, error, complete) {
		if (Boolean(observerOrNext) && observerOrNext instanceof Subscriber) {
			return observerOrNext;
		}

		if (!observerOrNext && !error && !complete) {
			return new Subscriber(EMPTY_OBSERVER);
		}

		return new Subscriber(observerOrNext, error, complete);
	}
}


class SafeSubscriber extends Subscriber {
	[Symbol.toStringTag] = 'SafeSubscriber';
	parentSubscriber;

	constructor(parentSubscriber, observerOrNext) {
		super();

		let internalNext = null,
			internalError = null,
			internalComplete = null,
			context = this;

		this.parentSubscriber = parentSubscriber;

		if (typeof observerOrNext === 'function') {
			internalNext = observerOrNext;
		} else if (observerOrNext) {
			internalNext = observerOrNext.next;
			internalError = observerOrNext.error;
			internalComplete = observerOrNext.complete;

			if (observerOrNext !== EMPTY_OBSERVER) {
				context = Object.create(observerOrNext);

				if (typeof context.unsubscribe === 'function') {
					this.add(context.unsubscribe.bind(context));
				}

				context.unsubscribe = this.unsubscribe.bind(this);
			}
		}

		this.context = context;
		this.innerNext = internalNext;
		this.innerError = internalError;
		this.innerComplete = internalComplete;
	}

	next(value) {
		if (!this.stopped && this.innerNext) {
			if (!this.parentSubscriber.syncErrorThrowable) {
				this.tryOrUnsub(this.innerNext, value);
			} else if (this.tryOrSetError(this.parentSubscriber, this.innerNext, value)) {
				this.unsubscribe();
			}
		}
	}

	error(err) {
		if (!this.stopped) {
			if (this.innerError) {
				if (this.parentSubscriber.syncErrorThrowable) {
					this.tryOrSetError(this.parentSubscriber, this.innerError, err);
					this.unsubscribe();
				} else {
					this.tryOrUnsub(this.innerError, err);
					this.unsubscribe();
				}
			} else if (this.parentSubscriber.syncErrorThrowable) {
				this.parentSubscriber.syncErrorValue = err;
				this.parentSubscriber.syncErrorThrown = true;
				this.unsubscribe();
			} else {
				this.unsubscribe();

				throw err;
			}
		}
	}

	complete() {
		if (!this.stopped) {
			if (this.innerComplete) {
				const wrappedComplete = () => this.context.innerComplete();

				if (this.parentSubscriber.syncErrorThrowable) {
					this.tryOrSetError(this.parentSubscriber, wrappedComplete);
					this.unsubscribe();
				} else {
					this.tryOrUnsub(wrappedComplete);
					this.unsubscribe();
				}
			} else {
				this.unsubscribe();
			}
		}
	}

	tryOrUnsub(fn, value) {
		try {
			fn.call(this.context, value);
		} catch (err) {
			this.unsubscribe();

			throw err;
		}
	}

	tryOrSetError(parent, fn, value) {
		try {
			fn.call(this.context, value);
		} catch (err) {
			parent.syncErrorValue = err;
			parent.syncErrorThrown = true;

			return true;
		}

		return false;
	}

	internalUnsubscribe() {
		const {parentSubscriber} = this;

		this.context = null;
		this.parentSubscriber = null;
		parentSubscriber.unsubscribe();
	}
}

export class OuterSubscriber extends Subscriber {
	[Symbol.toStringTag] = 'OuterSubscriber';

	notifyNext(outerValue, innerValue) {
		this.destination.next(innerValue);
	}

	notifyError(error) {
		this.destination.error(error);
	}

	notifyComplete() {
		this.destination.complete();
	}
}

export class InnerSubscriber extends Subscriber {
	[Symbol.toStringTag] = 'InnerSubscriber';

	constructor(parent, outerValue, outerIndex) {
		super();
		this.parent = parent;
		this.outerValue = outerValue;
		this.outerIndex = outerIndex;
		this.index = 0;
	}

	innerNext(value) {
		this.parent.notifyNext(this.outerValue, value, this.outerIndex, this.index += 1, this);
	}

	innerError(error) {
		this.parent.notifyError(error, this);
		this.unsubscribe();
	}

	innerComplete() {
		this.parent.notifyComplete(this);
		this.unsubscribe();
	}
}
