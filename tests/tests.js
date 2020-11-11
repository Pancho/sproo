import { Mavor } from '../fiu/js/mavor.js';
import { Manager } from './api/manager.js';
import { DatabaseSuite } from './spec/database/database-suite.js';
import { MavorSuite } from './spec/mavor/mavor-suite.js';

class Tests {
	manager = new Manager();
	nav = document.querySelector('nav');
	main = document.querySelector('main');

	constructor() {
		this.manager.addSuite(new MavorSuite());
		this.manager.addSuite(new DatabaseSuite());
		this.initNavigation();
	}

	initNavigation() {
		Object.entries(this.manager.suites).forEach(([slug, suite]) => {
			this.nav.append(Mavor.createElement(`<a href="#${slug}">${suite.name}</a>`));
		});

		this.nav.addEventListener('click', ev => {
			const target = ev.target.getAttribute('href');
			if (ev.target.tagName.toLowerCase() !== 'a') {
				return;
			}
			ev.preventDefault();
			window.location.hash = target;
			this.setupContent(target);
		});

		if (!!window.location.hash) {
			this.setupContent(window.location.hash);
		}
	}

	removeExistingContent() {
		document.querySelectorAll('.content').forEach(content => content.parentElement.removeChild(content));
	}

	getNewContent(suite) {
		const content = Mavor.createElement(`<div class="content">
				<h2>${suite.name}</h2>
			</div>`),
			control = Mavor.createElement(`<div class="control">
				<p>Tests in suite: ${Object.entries(suite.tests).length}</p>
				<p class="result-count">
					<span class="successful"></span>
					<span class="failed"></span>
					<span class="exception"></span>
				</p>
				<div class="progress">
					<div class="progress-bar"></div>
				</div>
				<a class="button run-suite">Run All Tests</a>
			</div>`),
			testList = Mavor.createElement(`<ol class="test-list"></ol>`);

		content.append(control);
		content.append(testList);
		this.main.append(content);

		Object.entries(suite.tests).forEach(([slug, test]) => {
			const listItem = Mavor.createElement(`<li>
					<div>
						<h3>${test.name}</h3>
						<p class="result"></p>
						<p class="report"></p>
					</div>
					<div>
						<span class="button run-test">Run Test</span>
					</div>
				</li>`);

			listItem.querySelector('.run-test').addEventListener('click', ev => {
				const selectedTest = suite.tests[slug],
					resultPlaceholder = ev.target.closest('li').querySelector('.result'),
					reportPlaceholder = ev.target.closest('li').querySelector('.report');

				selectedTest.run().then(() => {
					reportPlaceholder.innerHTML = selectedTest.resultReport;
					resultPlaceholder.textContent = selectedTest.resultMessage;
					if (selectedTest.succeeded) {
						resultPlaceholder.classList.add('success');
					} else if (selectedTest.failed) {
						resultPlaceholder.classList.add('failed');
					} else if (selectedTest.exception) {
						resultPlaceholder.classList.add('exception');
					}
				});
			});
			listItem.dataset.slug = slug;

			testList.append(listItem);
		});

		control.querySelector('.run-suite').addEventListener('click', ev => {
			const listItems = testList.querySelectorAll('li'),
				step = 100 / listItems.length;
			let percentage = 0,
				successful = 0,
				failed = 0,
				exception = 0;

			ev.preventDefault();
			control.querySelector('.result-count').style.display = 'none';
			testList.querySelectorAll('li').forEach(listItem => {
				const selectedTest = suite.tests[listItem.dataset.slug],
					resultPlaceholder = listItem.querySelector('.result'),
					reportPlaceholder = listItem.querySelector('.report');

				selectedTest.run().then(() => {
					reportPlaceholder.innerHTML = selectedTest.resultReport;
					resultPlaceholder.textContent = selectedTest.resultMessage;
					if (selectedTest.succeeded) {
						resultPlaceholder.classList.add('success');
						successful += 1;
					} else if (selectedTest.failed) {
						resultPlaceholder.classList.add('failed');
						failed += 1;
					} else if (selectedTest.exception) {
						resultPlaceholder.classList.add('exception');
						exception += 1;
					}
					percentage += step;
					control.querySelector('.progress .progress-bar').style.width = `${percentage.toFixed(8)}%`;
					control.querySelector('.successful').textContent = `Successful: ${successful}`;
					control.querySelector('.failed').textContent = `Failed: ${failed}`;
					control.querySelector('.exception').textContent = `Exception: ${exception}`;
					control.querySelector('.result-count').style.display = 'block';
				});
			});
		});
	}

	setupContent(hash) {
		this.removeExistingContent();
		this.getNewContent(this.manager.getSuiteBySlug(hash.replace('#', '')));
	}
}

new Tests();