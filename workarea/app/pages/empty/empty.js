import Component from '../../../fiu/js/component.js';

export default class EmptyPageComponent extends Component {
	static tagName = 'empty-page';
	static template = '/app/pages/empty/empty';
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		'/app/pages/empty/empty',
	];
	static registerComponents = [];
}
