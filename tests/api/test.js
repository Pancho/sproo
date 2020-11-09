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
		return !!value ? this.successMessage : this.failedMessage;
	}

	assertFalse() {
		return !value ? this.successMessage : this.failedMessage;
	}

	assertGt(value, expectedValue) {
		return value > expectedValue ? this.successMessage : this.failedMessage;
	}

	assertGte(value, expectedValue) {
		return value >= expectedValue ? this.successMessage : this.failedMessage;
	}

	assertLt(value, expectedValue) {
		return value < expectedValue ? this.successMessage : this.failedMessage;
	}

	assertLte(value, expectedValue) {
		return value <= expectedValue ? this.successMessage : this.failedMessage;
	}

	assertThrowsError(fn) {
		try {
			fn();
			return this.failedMessage;
		} catch (e) {
			return this.successMessage;
		}
	}

	assertElementExists(selector) {
		return this.doc.querySelectorAll(selector).length > 0 ? this.successMessage : this.failedMessage;
	}

	assertElementsCount(selector, count) {
		return this.doc.querySelectorAll(selector).length === count ? this.successMessage : this.failedMessage;
	}

	assertElementAttributeValue(selector, attribute, expectedValue) {
		return this.doc.querySelector(selector).getAttribute(attribute) === expectedValue ? this.successMessage : this.failedMessage;
	}

	async run() {
		try {
			return await this.test();
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
