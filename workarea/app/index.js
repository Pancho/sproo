import App from '../fiu/js/app.js';

new App({
	routeRoot: 'http://localhost',
	staticRoot: '',
	homePage: {component: '/app/pages/demo/demo.js'},
	notFound: {component: '/app/pages/not-found/not-found.js'},
	routes: [
		{
			path: '/baza-test-range',
			component: '/app/pages/baza/baza.js',
		},
		{
			path: '/empty',
			component: '/app/pages/empty/empty.js',
		},
		{
			path: '/empty/:paramTest',
			component: '/app/pages/empty/empty.js',
		},
		{
			path: '/login',
			component: '/app/pages/login/login.js',
		},
	],
	rootStylesheets: [
		'/fiu/css/meta',
		'/fiu/css/normalize',
	],
	authenticationModule: null,
	httpEndpointStub: 'http://localhost',
	onAppReady: [],
	loggerConfig: {level: 'trace'},
});
