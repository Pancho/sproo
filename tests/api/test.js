export class Test {
	name;
	successMessage;
	failedMessage;
	resultMessage;
	resultReport;
	succeeded = false;
	failed = false;
	exception = false;
	doc;

	constructor(name, successMessage, failedMessage, doc) {
		this.name = name;
		if (successMessage === failedMessage) {
			throw new Error('Test cannot have same message for success and fail.');
		}
		this.successMessage = successMessage;
		this.failedMessage = failedMessage;
		this.doc = doc;
	}

	get [Symbol.toStringTag]() {
		return 'Test';
	}

	async assertEquals(value, expectedValue) {
		return new Promise((resolve, reject) => {
			if (value === expectedValue) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `[Assert Equals] Value <span class="value">"${value}"</span> equals <span class="expected-value">"${expectedValue}"</span>`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `[Assert Equals] Value <span class="value">"${value}"</span> does not equal <span class="expected-value">"${expectedValue}"</span>`;
			}
			resolve();
		});
	}

	async assertNotEquals(value, expectedValue) {
		return new Promise((resolve, reject) => {
			if (value !== expectedValue) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `[Assert Not Equals] Value <span class="value">"${value}"</span> does not equals <span class="expected-value">"${expectedValue}"</span>`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `[Assert Not Equals] Value <span class="value">"${value}"</span> equals <span class="expected-value">"${expectedValue}"</span>`;
			}
			resolve();
		});
	}

	assertTrue(value) {
		return new Promise((resolve, reject) => {
			if (value === true) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `[Assert True] Value <span class="value">"${value}"</span> equals <span class="expected-value">"true"</span>`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `[Assert True] Value <span class="value">"${value}"</span> does not equal <span class="expected-value">"true"</span>`;
			}
			resolve();
		});
	}

	assertFalse() {
		return new Promise((resolve, reject) => {
			if (value === false) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `[Assert False] Value <span class="value">"${value}"</span> equals <span class="expected-value">"false"</span>`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `[Assert False] Value <span class="value">"${value}"</span> does not equal <span class="expected-value">"false"</span>`;
			}
			resolve();
		});
	}

	assertTruthy(value) {
		return new Promise((resolve, reject) => {
			if (!!value) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `[Assert Truthy] Value <span class="value">"${value}"</span> is a truthy value`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `[Assert Truthy] Value <span class="value">"${value}"</span> is not a truthy value`;
			}
			resolve();
		});
	}

	assertFalsy() {
		return new Promise((resolve, reject) => {
			if (!value) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `[Assert Falsy] Value <span class="value">"${value}"</span> is a falsy value`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `[Assert Falsy] Value <span class="value">"${value}"</span> is not a falsy value`;
			}
			resolve();
		});
	}

	assertGt(value, expectedValue) {
		return new Promise((resolve, reject) => {
			if (value > expectedValue) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `[Assert Greater Than] Value <span class="value">"${value}"</span> is greater than <span class="expected-value">"${expectedValue}"</span>`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `[Assert Greater Than] Value <span class="value">"${value}"</span> is not greater than <span class="expected-value">"${expectedValue}"</span>`;
			}
			resolve();
		});
	}

	assertGte(value, expectedValue) {
		return new Promise((resolve, reject) => {
			if (value >= expectedValue) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `[Assert Greater Than Or Equal] Value <span class="value">"${value}"</span> is greater than or equal <span class="expected-value">"${expectedValue}"</span>`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `[Assert Greater Than Or Equal] Value <span class="value">"${value}"</span> is not greater than or equal <span class="expected-value">"${expectedValue}"</span>`;
			}
			resolve();
		});
	}

	assertLt(value, expectedValue) {
		return new Promise((resolve, reject) => {
			if (value < expectedValue) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `[Assert Less Than] Value <span class="value">"${value}"</span> is less than <span class="expected-value">"${expectedValue}"</span>`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `[Assert Less Than] Value <span class="value">"${value}"</span> is not less than <span class="expected-value">"${expectedValue}"</span>`;
			}
			resolve();
		});
	}

	assertLte(value, expectedValue) {
		return new Promise((resolve, reject) => {
			if (value <= expectedValue) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `[Assert Less Than Or Equal] Value <span class="value">"${value}"</span> is lower than or equal <span class="expected-value">"${expectedValue}"</span>`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `[Assert Less Than Or Equal] Value <span class="value">"${value}"</span> is not lower than or equal <span class="expected-value">"${expectedValue}"</span>`;
			}
			resolve();
		});
	}

	assertThrowsError(fn) {
		return new Promise((resolve, reject) => {
			try {
				fn();
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `[Assert Throws Error] Function <span class="value">"${fn.name}"</span> does not throw an error, but should`;
			} catch (e) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `[Assert Throws Error] Function <span class="value">"${fn.name}"</span> did throw an error`;
			}
			resolve();
		});
	}

	async run() {
		await this.setup();
		try {
			await this.test();
		} catch (e) {
			this.exception = true;
			this.resultMessage = 'Unhandled and unexpected exception happened during test run';
			console.error(e);
		}
		await this.teardown();
	}

	isExecuted() {
		return this.succeeded || this.failed || this.exception;
	}

	async setup() {
	}

	async test() {
		throw new Error('You must implement the actual test');
	}

	async teardown() {
	}
}
