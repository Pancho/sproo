import { DemoPageComponent } from '../../../app/pages/demo/demo.js';
import { EmptyPageComponent } from '../../../app/pages/empty/empty.js';
import { NotFoundComponent } from '../../../app/pages/not-found/not-found.js';
import { AppTest } from '../../api/test.js';


const BASIC_APP_CONFIG = {
	routeRoot: 'http://localhost',
	homePage: {
		component: DemoPageComponent,
	},
	notFound: {
		component: NotFoundComponent,
	},
	rootComponents: [
		DemoPageComponent,
		NotFoundComponent,
	],
}, ROUTES_APP_CONFIG = {
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
}, FULL_APP_CONFIG = {
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
	httpEndpointStub: 'http://localhost',
	onAppReady: [
		app => app.works = true,
	],
	providers: [
		DemoPageComponent.STORE_PROVIDER,
	],
};


export class BasicAppTest extends AppTest {
	constructor() {
		super('Basic App Test', 'App set itself up successfully', 'App failed to set up', BASIC_APP_CONFIG, true);
	}

	async test() {
		await this.assertTruthy(this.app);
	}
}


export class HttpGetAppTest extends AppTest {
	constructor() {
		super('HTTP GET App Test', 'Successfully got data from /app/test.json via a GET request', 'Could not perform a GET request', FULL_APP_CONFIG, true);
	}

	async test() {
		const response = await this.app.http.get('/app/test.json'),
			json = await response.json();
		await this.assertEquals(json.status, 'ok');
	}
}


export class RoutesAppTest extends AppTest {
	constructor() {
		super('Routes App Test', 'App set itself up and navigated successfully', 'App failed to set up and navigate', ROUTES_APP_CONFIG, true);
	}

	async test() {
		this.app.router.navigate('/');
		await this.assertTruthy(document.querySelector('body main router-outlet demo-page'));
	}
}


export class OnAppReadyAppTest extends AppTest {
	constructor() {
		super('On App Ready App Test', 'onAppReady successfully fired', 'onAppReady did not fire', FULL_APP_CONFIG, true);
	}

	async test() {
		await this.assertTrue(this.app.works);
	}
}


export class ProviderAppTest extends AppTest {
	constructor() {
		super('Provider App Test', 'Provided store parameter found on component', 'Store parameter not present', FULL_APP_CONFIG, true);
	}

	async test() {
		let demoPage;
		this.app.router.navigate('/');
		demoPage = document.querySelector('body main router-outlet demo-page');
		await demoPage.templateLoaded;
		await this.assertEquals(demoPage.store.toString(), '[object Store]');
	}
}
