import Component from '../../../fiu/js/component.js';


export default class DemoPageComponent extends Component {
	static tagName = 'demo-page';
	static template = '/app/pages/demo/demo';
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		'/app/pages/demo/demo',
	];

	static registerComponents = ['/app/components/child-component/child-component.js'];

	valuesUpdated = false;

	logEvent(ev) {
		this.context = {
			blah: `(${ ev.screenX }, ${ ev.screenY })`,
			coords: {
				x: ev.screenX,
				y: ev.screenY,
			},
		};
	}

	notifyValuesUpdated() {
		this.valuesUpdated = true;
	}
}
