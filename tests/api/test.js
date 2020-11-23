import { App } from '../../fiu/js/app.js';
import { Authentication } from '../../fiu/js/authentication.js';
import { Http } from '../../fiu/js/http.js';
import { Mavor } from '../../fiu/js/mavor.js';
import { Router } from '../../fiu/js/router.js';


export class Test {
	name;
	successMessage;
	failedMessage;
	resultMessage;
	resultReport;
	succeeded = false;
	failed = false;
	exception = false;

	constructor(name, successMessage, failedMessage) {
		this.name = name;
		if (successMessage === failedMessage) {
			throw new Error('Test cannot have same message for success and fail.');
		}
		this.successMessage = successMessage;
		this.failedMessage = failedMessage;
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

	async assertArraysEquals(value, expectedValue) {
		return new Promise((resolve, reject) => {
			if (
				Array.isArray(value) &&
				Array.isArray(expectedValue) &&
				value.length === expectedValue.length &&
				value.every((val, index) => val === expectedValue[index])
			) {
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

	async assertArraysContentEquals(value, expectedValue) {
		// The only difference between this method and the assertArraysEquals is that we don't care for the original order of elements
		// and just check whether both have the same. So to use the same logic as in the assertArraysEquals, we just need to sort both
		// arrays first, and the rest is the same.
		value.sort();
		expectedValue.sort();
		return this.assertArraysEquals(value, expectedValue);
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
		return true;
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


export class AppTest extends Test {
	config;
	awaitApp;
	url;
	app;
	routerOutlet;

	constructor(name, successMessage, failedMessage, config, awaitApp) {
		super(name, successMessage, failedMessage);
		this.config = config;
		this.awaitApp = !!awaitApp;
	}

	async setup() {
		this.url = window.location.href;
		this.routerOutlet = Mavor.createElement('<router-outlet></router-outlet>');
		document.querySelector('body main').appendChild(this.routerOutlet);
		this.app = new App(this.config);
		if (this.awaitApp) {
			await App.appReady;
		}
	}

	async teardown() {
		window.history.pushState(
			{},
			'',
			this.url,
		);
		document.querySelector('body main').removeChild(this.routerOutlet);
		App.instance = null;
		App.injectionRegistry = {};
		Router.instance.destroy();
		Router.instance = null;
		Authentication.instance = null;
		Http.instance = null;
	}

	click(doc, x, y) {
		const mouseClickEvent = document.createEvent('MouseEvents');
		mouseClickEvent.initMouseEvent(
			'click',
			true,
			true,
			window,
			0,
			x,
			y,
			x,
			y,
			false,
			false,
			false,
			false,
			0,
			null,
		);
		doc.elementFromPoint(x, y).dispatchEvent(mouseClickEvent);
	}
}
