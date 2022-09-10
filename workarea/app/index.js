import App from '../fiu/js/app.js';


new App({
	routeRoot: '',
	staticRoot: '',
	homePage: {component: '/app/pages/demo/demo.js'},
	notFound: {component: '/app/pages/not-found/not-found.js'},
	routes: [
		{
			path: '/baza-test-range',
			component: '/app/pages/baza/baza.js',
		},
		{
			path: '/baza-test-range/charts',
			component: '/app/pages/baza-charts/baza-charts.js',
		},
		{
			path: '/baza-test-range/cards',
			component: '/app/pages/baza-cards/baza-cards.js',
		},
		{
			path: '/baza-test-range/tables',
			component: '/app/pages/baza-tables/baza-tables.js',
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
			path: '/baza-forms',
			component: '/app/pages/baza-forms/baza-forms.js',
		},
	],
	rootStylesheets: [
		'/fiu/css/meta',
		'/fiu/css/normalize',
	],
	authenticationModule: null,
	httpEndpointStub: '',
	onAppReady: [],
	loggerConfig: {level: 'trace'},
});
