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

	async assertEquals(value, expectedValue) {
		return new Promise((resolve, reject) => {
			if (value === expectedValue) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> equals <span class="expected-value">"${expectedValue}"</span>`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> does not equal <span class="expected-value">"${expectedValue}"</span>`;
			}
			resolve();
		});
	}

	assertTrue(value) {
		return new Promise((resolve, reject) => {
			if (value === true) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> equals <span class="expected-value">"true"</span>`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> does not equal <span class="expected-value">"true"</span>`;
			}
			resolve();
		});
	}

	assertFalse() {
		return new Promise((resolve, reject) => {
			if (value === false) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> equals <span class="expected-value">"false"</span>`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> does not equal <span class="expected-value">"false"</span>`;
			}
			resolve();
		});
	}

	assertTruthy(value) {
		return new Promise((resolve, reject) => {
			if (!!value) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> is a truthy value`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> is not a truthy value`;
			}
			resolve();
		});
	}

	assertFalsy() {
		return new Promise((resolve, reject) => {
			if (!value) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> is a falsy value`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> is not a falsy value`;
			}
			resolve();
		});
	}

	assertGt(value, expectedValue) {
		return new Promise((resolve, reject) => {
			if (value > expectedValue) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> is greater than <span class="expected-value">"${expectedValue}"</span>`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> is not greater than <span class="expected-value">"${expectedValue}"</span>`;
			}
			resolve();
		});
	}

	assertGte(value, expectedValue) {
		return new Promise((resolve, reject) => {
			if (value >= expectedValue) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> is greater than or equal <span class="expected-value">"${expectedValue}"</span>`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> is not greater than or equal <span class="expected-value">"${expectedValue}"</span>`;
			}
			resolve();
		});
	}

	assertLt(value, expectedValue) {
		return new Promise((resolve, reject) => {
			if (value < expectedValue) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> is lower than <span class="expected-value">"${expectedValue}"</span>`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> is not lower than <span class="expected-value">"${expectedValue}"</span>`;
			}
			resolve();
		});
	}

	assertLte(value, expectedValue) {
		return new Promise((resolve, reject) => {
			if (value <= expectedValue) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> is lower than or equal <span class="expected-value">"${expectedValue}"</span>`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `Value <span class="value">"${value}"</span> is not lower than or equal <span class="expected-value">"${expectedValue}"</span>`;
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
				this.resultReport = `Function <span class="value">"${fn.name}"</span> does not throw an error, but should`;
			} catch (e) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `Function <span class="value">"${fn.name}"</span> did throw an error`;
			}
			resolve();
		});
	}

	assertElementExists(selector) {
		return new Promise((resolve, reject) => {
			if (this.doc.querySelectorAll(selector).length > 0) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `Element with selector <span class="value">"${selector}"</span> found`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `Element with selector <span class="value">"${selector}"</span> not found`;
			}
			resolve();
		});
	}

	assertElementsCount(selector, count) {
		return new Promise((resolve, reject) => {
			if (this.doc.querySelectorAll(selector).length === count) {
				this.succeeded = true;
				this.resultMessage = this.successMessage;
				this.resultReport = `Element with selector <span class="value">"${selector}"</span> found`;
			} else {
				this.failed = true;
				this.resultMessage = this.failedMessage;
				this.resultReport = `Element with selector <span class="value">"${selector}"</span> not found`;
			}
			resolve();
		});

		return this.doc.querySelectorAll(selector).length === count ? this.successMessage : this.failedMessage;
	}

	assertElementAttributeValue(selector, attribute, expectedValue) {
		return this.doc.querySelector(selector).getAttribute(attribute) === expectedValue ? this.successMessage : this.failedMessage;
	}

	async run() {
		try {
			await this.test();
		} catch (e) {
			this.resultMessage = 'Unhandled and unexpected exception happened during test run';
		}
	}

	isExecuted() {
		return this.succeeded || this.failed || this.exception;
	}

	async test() {
		throw new Error('You must implement the actual test');
	}
}
