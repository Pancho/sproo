/*
 * You are supposed to extend this class, not just use it (even though it should be fine if you do, but if you don't use it, app will, so
 * don't worry). Such as it is, this implementation will not do a damn thing, just pass everything through.
 */
export class Authentication {
	constructor() {
		if (!!Authentication.instance) {
			throw new Error('Only one instance of Authentication allowed');
		}

		Authentication.instance = this;
	}

	get [Symbol.toStringTag]() {
		return 'Authentication';
	}

	/**
	 * This method MUST return options whether you modified it or not or a new dict, just make sure you populate it with right params.
	 * @param options
	 * @returns {*}
	 */
	addAuthentication(options) {
		return options;
	}
}
