const EMPTY_OBSERVER = {
	closed: true,
	next(value) {
	},
	error(err) {
		throw err;
	},
	complete() {
	},
};

export class Subscription {
	closed = false;
	parents = null;
	subscriptions = null;

	static EMPTY = (function (empty) {
		empty.closed = true;
		return empty;
	}(new Subscription()));

	constructor(unsubscribe) {
		if (unsubscribe) {
			this._unsubscribe = unsubscribe;
		}
	}

	unsubscribe() {
		let hasErrors = false;
		let errors;
		if (this.closed) {
			return;
		}
		let {parents, subscriptions} = this;
		this.closed = true;
		this.parents = null;
		this.subscriptions = null;

		if (!!parents) {
			parents.forEach(parent => parent.remove(this));
		}

		if (typeof this._unsubscribe === 'function') {
			try {
				this._unsubscribe();
			} catch (e) {
				errors = [e];
			}
		}

		if (!!subscriptions) {
			subscriptions.forEach(subscription => {
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
		if (!teardown || (teardown === Subscription.EMPTY)) {
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
		const subject = this.subject;
		const observers = subject.observers;
		this.subject = null;
		if (!observers || observers.length === 0 || subject.stopped || subject.closed) {
			return;
		}
		const subscriberIndex = observers.indexOf(this.subscriber);
		if (subscriberIndex !== -1) {
			observers.splice(subscriberIndex, 1);
		}
	}
}

export class Subscriber extends Subscription {
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
			this._next(value);
		}
	}

	error(err) {
		if (!this.stopped) {
			this.stopped = true;
			this._error(err);
		}
	}

	complete() {
		if (!this.stopped) {
			this.stopped = true;
			this._complete();
		}
	}

	unsubscribe() {
		if (this.closed) {
			return;
		}
		this.stopped = true;
		super.unsubscribe();
	}

	_next(value) {
		this.destination.next(value);
	}

	_error(err) {
		this.destination.error(err);
		this.unsubscribe();
	}

	_complete() {
		this.destination.complete();
		this.unsubscribe();
	}

	unsubscribeAndRecycle() {
        const { parents } = this;
        this.parents = null;
        this.unsubscribe();
        this.closed = false;
        this.stopped = false;
        this.parents = parents;
        return this;
    }

	static toSubscriber(observerOrNext, error, complete) {
		if (!!observerOrNext && observerOrNext instanceof Subscriber) {
			return observerOrNext;
		}

		if (!observerOrNext && !error && !complete) {
			return new Subscriber(EMPTY_OBSERVER);
		}

		return new Subscriber(observerOrNext, error, complete);
	}
}


class SafeSubscriber extends Subscriber {
	parentSubscriber;

	constructor(parentSubscriber, observerOrNext, error, complete) {
		super();
		this.parentSubscriber = parentSubscriber;
		let next;
		let context = this;
		if (typeof observerOrNext === 'function') {
			next = observerOrNext;
		} else if (observerOrNext) {
			next = observerOrNext.next;
			error = observerOrNext.error;
			complete = observerOrNext.complete;
			if (observerOrNext !== EMPTY_OBSERVER) {
				context = Object.create(observerOrNext);
				if (typeof context.unsubscribe === 'function') {
					this.add(context.unsubscribe.bind(context));
				}
				context.unsubscribe = this.unsubscribe.bind(this);
			}
		}
		this.context = context;
		this._next = next;
		this._error = error;
		this._complete = complete;
	}

	next(value) {
		if (!this.stopped && this._next) {
			if (!this.parentSubscriber.syncErrorThrowable) {
				this.tryOrUnsub(this._next, value);
			} else if (this.tryOrSetError(this.parentSubscriber, this._next, value)) {
				this.unsubscribe();
			}
		}
	}

	error(err) {
		if (!this.stopped) {
			if (this._error) {
				if (!this.parentSubscriber.syncErrorThrowable) {
					this.tryOrUnsub(this._error, err);
					this.unsubscribe();
				} else {
					this.tryOrSetError(this.parentSubscriber, this._error, err);
					this.unsubscribe();
				}
			} else if (!this.parentSubscriber.syncErrorThrowable) {
				this.unsubscribe();
				throw err;
			} else {
				this.parentSubscriber.syncErrorValue = err;
				this.parentSubscriber.syncErrorThrown = true;
				this.unsubscribe();
			}
		}
	}

	complete() {
		if (!this.stopped) {
			if (this._complete) {
				const wrappedComplete = () => this.context._complete();
				if (!this.parentSubscriber.syncErrorThrowable) {
					this.tryOrUnsub(wrappedComplete);
					this.unsubscribe();
				} else {
					this.tryOrSetError(this.parentSubscriber, wrappedComplete);
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

	_unsubscribe() {
		const {parentSubscriber} = this;
		this.context = null;
		this.parentSubscriber = null;
		parentSubscriber.unsubscribe();
	}
}

export class OuterSubscriber extends Subscriber {
    notifyNext(outerValue, innerValue) {
        this.destination.next(innerValue);
    }
    notifyError(error, innerSub) {
        this.destination.error(error);
    }
    notifyComplete(innerSub) {
        this.destination.complete();
    }
}

export class InnerSubscriber extends Subscriber {
    constructor(parent, outerValue, outerIndex) {
        super();
        this.parent = parent;
        this.outerValue = outerValue;
        this.outerIndex = outerIndex;
        this.index = 0;
    }
    _next(value) {
        this.parent.notifyNext(this.outerValue, value, this.outerIndex, this.index++, this);
    }
    _error(error) {
        this.parent.notifyError(error, this);
        this.unsubscribe();
    }
    _complete() {
        this.parent.notifyComplete(this);
        this.unsubscribe();
    }
}