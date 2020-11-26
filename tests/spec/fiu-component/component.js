import { DemoPageComponent } from '../../../app/pages/demo/demo.js';
import { EmptyPageComponent } from '../../../app/pages/empty/empty.js';
import { NotFoundComponent } from '../../../app/pages/not-found/not-found.js';
import { AppTest } from '../../api/test.js';


const ROUTES_APP_CONFIG = {
	routeRoot: 'http://localhost',
	homePage: {
		component: DemoPageComponent,
	},
	notFound: {
		component: NotFoundComponent,
	},
	routes: [
		{
			path: '/empty',
			component: EmptyPageComponent,
		},
		{
			path: '/empty/:paramTest',
			component: EmptyPageComponent,
		},
	],
	rootComponents: [
		DemoPageComponent,
		NotFoundComponent,
		EmptyPageComponent,
	],
};


export class ClickAppTest extends AppTest {
	x = 200;
	y = 10;

	constructor() {
		super('Click App Test', 'Successfully clicked on the DemoPageComponent', 'Could not click on the DemoPageComponent', ROUTES_APP_CONFIG, true);
	}

	async test() {
		let demoPage;
		this.app.router.navigate('/');
		demoPage = document.querySelector('body main router-outlet demo-page');
		await demoPage.templateLoaded;
		this.click(demoPage.shadowRoot, this.x, this.y);
		await this.assertEquals(demoPage.paragraphContainer.querySelector('p').textContent, `(${this.x}, ${this.y})`);
	}
}


export class CustomEventAppTest extends AppTest {
	x = 200;
	y = 10;

	constructor() {
		super('Custom Event App Test', 'Successfully received echo signal from child component', 'Did not receive signal back from child component', ROUTES_APP_CONFIG, true);
	}

	async test() {
		let demoPage;
		this.app.router.navigate('/');
		demoPage = document.querySelector('body main router-outlet demo-page');
		await demoPage.templateLoaded;
		this.click(demoPage.shadowRoot, this.x, this.y);
		await new Promise(resolve => setTimeout(_ => {
			resolve();
		}, 100));
		await this.assertTrue(demoPage.valuesUpdated);
	}
}
