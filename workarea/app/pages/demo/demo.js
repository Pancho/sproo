import Component from '../../../fiu/js/component.js';


export default class DemoPageComponent extends Component {
	static tagName = 'demo-page';
	static template = '/app/pages/demo/demo';
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		'/app/pages/demo/demo',
	];
	static registerComponents = [
		'/app/components/child-component/child-component.js',
	];

	// unsubscribe = new Subject();
	valuesUpdated = false;

	constructor() {
		super();
		// fromEvent(document, 'click').pipe(
		// 	tap((ev) => {
		// 		this.context = {
		// 			coords: {
		// 				x: ev.screenX,
		// 				y: ev.screenY,
		// 			},
		// 		};
		// 	}),
		// 	takeUntil(this.unsubscribe),
		// ).subscribe();
	}

	// unload() {
	// 	this.unsubscribe.next();
	// 	this.unsubscribe.complete();
	// }

	onTemplateLoaded() {
		// this.context = {
		// 	blah: 'Some text',
		// 	// showParagraph: false,
		// 	showParagraph: true,
		// 	inner: {
		// 		value: {
		// 			more: 'ok',
		// 		},
		// 	},
		// };
		// setInterval(() => {
		// 	this.context = {
		// 		blah: new Date(),
		// 	};
		// }, 1000);
	}

	logEvent(ev) {
		this.context = {
			blah: `(${ev.screenX}, ${ev.screenY})`,
			coords: {
				x: ev.screenX,
				y: ev.screenY,
			},
		};
	}

	notifyValuesUpdated(ev) {
		this.valuesUpdated = true;
	}
}
