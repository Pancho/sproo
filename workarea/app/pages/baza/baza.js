import Component from '../../../fiu/js/component.js';

export default class BazaPageComponent extends Component {
	static tagName = 'baza-page';
	static template = '/app/pages/baza/baza';
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		'/app/pages/baza/baza',
	];

	static registerComponents = [
		'/baza/row/row.js',
		'/baza/card/card.js',
	];
}
