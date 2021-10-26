import Component from '../../../fiu/js/component.js';

export default class BazaCardsComponent extends Component {
	static tagName = 'baza-cards';
	static template = '/app/pages/baza-cards/baza-cards';
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		'/app/pages/baza-cards/baza-cards',
	];
	static registerComponents = [
		'/baza/card/card.js',
		'/baza/row/row.js',
	];

	form;

	onTemplateLoaded() {
	}
}
