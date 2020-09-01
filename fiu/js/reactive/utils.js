import { Observable } from './observable.js';
import { InnerSubscriber } from './subscriber.js';

export function subscribeToResult(outerSubscriber, result, outerValue, outerIndex) {
	let destination = new InnerSubscriber(outerSubscriber, outerValue, outerIndex);
	if (destination.closed) {
		return null;
	}
	if (result instanceof Observable) {
		destination.syncErrorThrowable = true;
		return result.subscribe(destination);
	} else if (!!result && Array.isArray(result)) {
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