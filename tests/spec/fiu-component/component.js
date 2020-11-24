import { DemoPageComponent } from '../../../app/pages/demo/demo.js';
import { EmptyPageComponent } from '../../../app/pages/empty/empty.js';
import { NotFoundComponent } from '../../../app/pages/not-found/not-found.js';
import { CSSTemplate, HTMLTemplate } from '../../../../fiu/js/component.js';
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


export class HTMLTemplateAppTest extends AppTest {
	constructor() {
		super('HTML Template App Test', 'Static HTML template found', 'Static HTML template could not be found', ROUTES_APP_CONFIG, true);
	}

	async test() {
		const template = EmptyPageComponent.template;
		const passes = template instanceof HTMLTemplate && template.asString().length === 166 && !!template.asDocument().querySelector('template');
		await this.assertTrue(passes);
	}
}


export class CSSTemplateAppTest extends AppTest {
	constructor() {
		super('CSS Template App Test', 'Static CSS templates found', 'Static CSS templates could not be found', ROUTES_APP_CONFIG, true);
	}

	async test() {
		const templates = EmptyPageComponent.stylesheets;

		const passes = [];

		templates.forEach(template => {
			if (template instanceof CSSTemplate) {
				passes.push(template.asString().length === 351 && template.asStyleSheet().rules.length === 7);
			} else {
				passes.push(true);
			}
		});

		await this.assertTrue(passes.every(elm => elm === true));
	}
}
