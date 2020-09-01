import { Observable } from './observable.js';
import { SubjectSubscription, Subscription } from './subscription.js';

export class Subject extends Observable {
	observers = [];
    closed = false;
    stopped = false;
    hasError = false;
    thrownError = null;

	constructor() {
        super();
    }

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
            const { observers } = this;
            const len = observers.length;
            const copy = observers.slice();
            for (let i = 0; i < len; i++) {
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
        const { observers } = this;
        const len = observers.length;
        const copy = observers.slice();
        for (let i = 0; i < len; i += 1) {
            copy[i].error(err);
        }
        this.observers.length = 0;
    }

    complete() {
        if (this.closed) {
            throw new Error('Unsubscribe Error');
        }
        this.stopped = true;
        const { observers } = this;
        const len = observers.length;
        const copy = observers.slice();
        for (let i = 0; i < len; i += 1) {
            copy[i].complete();
        }
        this.observers.length = 0;
    }

    unsubscribe() {
        this.stopped = true;
        this.closed = true;
        this.observers = null;
    }

    _trySubscribe(subscriber) {
        if (this.closed) {
            throw new Error('Subject closed');
        }
        else {
            return super._trySubscribe(subscriber);
        }
    }

    _subscribe(subscriber) {
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

    _subscribe(subscriber) {
        if (this.source) {
            return this.source.subscribe(subscriber);
        } else {
            return Subscription.EMPTY;
        }
    }
}

export class BehaviorSubject extends Subject {
    _value;

    constructor(value) {
        super();
        this._value = value;
    }

    get value() {
        return this.getValue();
    }

    _subscribe(subscriber) {
        const subscription = super._subscribe(subscriber);
        if (subscription && !subscription.closed) {
            subscriber.next(this._value);
        }
        return subscription;
    }

    getValue() {
        if (this.hasError) {
            throw this.thrownError;
        } else if (this.closed) {
            throw new Error('BehaviorSubject closed');
        } else {
            return this._value;
        }
    }

    next(value) {
        super.next(this._value = value);
    }
}