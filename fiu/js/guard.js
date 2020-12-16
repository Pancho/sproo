export default class Guard {
	[Symbol.toStringTag] = 'Guard'

	constructor(router, route) {
		this.router = router;
		this.route = route;
	}

	/**
	 * This is the method that needs overriding.
	 */
	async guard() {
	}
}
