import { Component } from '../../../fiu/js/component.js';
import { Subject } from '../../../fiu/js/reactive/subject.js';
import { Store } from '../../../fiu/js/state-management.js';
import { ChildComponent } from '../../components/child-component/child-component.js';

export class DemoPageComponent extends Component {
	static tagName = 'demo-page';
	static template = '/app/pages/demo/demo';
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/palette',
		'/fiu/css/normalize',
		'/app/pages/demo/demo',
	];
	static registerComponents = [
		ChildComponent,
	];
	static STORE_PROVIDER = [
		DemoPageComponent,
		'store',
		{
			useFactory: Store.get,
			params: ['pages/demo', true],
		},
	];

	unsubscribe = new Subject();
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

	unload() {
		this.unsubscribe.next();
		this.unsubscribe.complete();
	}

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
