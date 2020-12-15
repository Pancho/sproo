import { AppTest } from '../../api/test.js';


const BASIC_APP_CONFIG = {
	routeRoot: 'http://localhost',
	homePage: {
		component: '/app/pages/demo/demo.js',
	},
	notFound: {
		component: '/app/pages/not-found/not-found.js',
	},
}, ROUTES_APP_CONFIG = {
	routeRoot: 'http://localhost',
	homePage: {
		component: '/app/pages/demo/demo.js',
	},
	notFound: {
		component: '/app/pages/not-found/not-found.js',
	},
	routes: [
		{
			path: '/empty',
			component: './pages/empty/empty.js',
		},
		{
			path: '/empty/:paramTest',
			component: './pages/empty/empty.js',
		},
	],
}, FULL_APP_CONFIG = {
	routeRoot: 'http://localhost',
	homePage: {
		component: '/app/pages/demo/demo.js',
	},
	notFound: {
		component: '/app/pages/not-found/not-found.js',
	},
	routes: [
		{
			path: '/empty',
			component: './pages/empty/empty.js',
		},
		{
			path: '/empty/:paramTest',
			component: './pages/empty/empty.js',
		},
	],
	httpEndpointStub: 'http://localhost',
	onAppReady: [
		app => app.works = true,
	],
};


export class BasicAppTest extends AppTest {
	constructor() {
		super('Basic App Test', 'App set itself up successfully', 'App failed to set up', BASIC_APP_CONFIG);
	}

	async test() {
		await this.assertTruthy(this.app);
	}
}


export class HttpGetAppTest extends AppTest {
	constructor() {
		super('HTTP GET App Test', 'Successfully got data from /app/test.json via a GET request', 'Could not perform a GET request', FULL_APP_CONFIG);
	}

	async test() {
		const response = await this.app.http.get('/app/test.json'),
			json = await response.json();
		await this.assertEquals(json.status, 'ok');
	}
}


export class RoutesAppTest extends AppTest {
	constructor() {
		super('Routes App Test', 'App set itself up and navigated successfully', 'App failed to set up and navigate', ROUTES_APP_CONFIG);
	}

	async test() {
		await this.app.router.navigate('/');
		await this.assertTruthy(document.querySelector('body main router-outlet demo-page'));
	}
}


export class OnAppReadyAppTest extends AppTest {
	constructor() {
		super('On App Ready App Test', 'onAppReady successfully fired', 'onAppReady did not fire', FULL_APP_CONFIG);
	}

	async test() {
		await this.assertTrue(this.app.works);
	}
}
