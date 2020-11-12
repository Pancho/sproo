export class Guard {
	constructor() {}

	get [Symbol.toStringTag]() {
		return 'Guard';
	}

	/**
	 * If you override this method, you're probably in quite some trouble... leave it.
	 */
	async guard(router, route) {
		return await this.run(router, route);
	}

	/**
	 * This is the method that needs overriding.
	 */
	async run(router, route) {
		return true;
	}
}
