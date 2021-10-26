import {AppTest} from '../../api/test.js';

const ROUTES_APP_CONFIG = {
	routeRoot: 'http://localhost',
	homePage: {component: '/app/pages/demo/demo.js'},
	notFound: {component: '/app/pages/not-found/not-found.js'},
	routes: [
		{
			path: '/empty',
			component: '/app/pages/empty/empty.js',
		},
		{
			path: '/empty/:paramTest',
			component: '/app/pages/empty/empty.js',
		},
		{
			path: '/guarded',
			component: '/app/pages/empty/empty.js',
			guard: '/app/guard/workarea-guard.js',
		},
	],
};


export class ClickAppTest extends AppTest {
	x = 200;
	y = 10;

	constructor() {
		super(
			'Click App Test',
			'Successfully clicked on the DemoPageComponent',
			'Could not click on the DemoPageComponent',
			ROUTES_APP_CONFIG
		);
	}

	async test() {
		await this.app.router.navigate('/');
		const demoPage = document.querySelector('body main router-outlet demo-page');

		await demoPage.templateLoaded;
		AppTest.click(demoPage.shadowRoot, this.x, this.y);
		await this.assertEquals(demoPage.paragraphContainer.querySelector('p').textContent, `(${ this.x }, ${ this.y })`);
	}
}


export class CustomEventAppTest extends AppTest {
	x = 200;
	y = 10;

	constructor() {
		super(
			'Custom Event App Test',
			'Successfully received echo signal from child component',
			'Did not receive signal back from child component',
			ROUTES_APP_CONFIG
		);
	}

	async test() {
		await this.app.router.navigate('/');
		const demoPage = document.querySelector('body main router-outlet demo-page');

		await demoPage.templateLoaded;
		AppTest.click(demoPage.shadowRoot, this.x, this.y);
		await new Promise((resolve) => {
			setTimeout(async () => {
				await this.assertTrue(demoPage.valuesUpdated);
				resolve();
			}, 100);
		});
	}
}


export class GuardAppTest extends AppTest {
	x = 200;
	y = 10;

	constructor() {
		super(
			'Guard App Test',
			'Successfully detected guard doing its job',
			'Guard did not do what it was supposed to do',
			ROUTES_APP_CONFIG
		);
	}

	async test() {
		await this.app.router.navigate('/guarded');
		await this.assertEquals(this.app.router.testSuccessful, 'befefeae-765a-4987-a676-21b8eafa59a9');
	}
}
