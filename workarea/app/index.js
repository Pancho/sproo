import { App } from '../fiu/js/app.js';
import { LogLevels } from '../fiu/js/logging.js';
import { DemoPageComponent } from './pages/demo/demo.js';
import { EmptyPageComponent } from './pages/empty/empty.js';
import { NotFoundComponent } from './pages/not-found/not-found.js';

class Demo extends App {
	constructor(config) {
		super(
			config,
		);
	}
}

new Demo({
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
		EmptyPageComponent,
		NotFoundComponent,
	],
	rootStylesheets: [
		'/fiu/css/meta',
		'/fiu/css/normalize',
	],
	authenticationClass: null,
	httpEndpointStub: 'http://localhost',
	onAppReady: [],
	providers: [
		DemoPageComponent.STORE_PROVIDER,
	],
	loggerConfig: {
		level: LogLevels.TRACE,
		// handler: (message) => {
		// 	const formData = new FormData();
		//
		// 	formData.append('source', message.data.source);
		// 	formData.append('arguments', message.data.arguments);
		// 	formData.append('level', message.data.level);
		// 	const headers = {
		// 		'Accept': 'application/json, text/plain, */*',
		// 		'X-Requested-With': 'XMLHttpRequest',
		// 	}, options = {
		// 		method: 'POST',
		// 		headers: headers,
		// 		body: formData,
		// 	};
		//
		// 	return fetch('http://localhost/logging', options);
		// },
	},
});
