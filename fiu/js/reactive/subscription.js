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