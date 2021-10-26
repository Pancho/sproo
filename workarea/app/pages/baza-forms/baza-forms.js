import Component from '../../../fiu/js/component.js';

export default class BazaFormComponent extends Component {
	static tagName = 'baza-forms';
	static template = '/app/pages/baza-forms/baza-forms';
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		'/app/pages/baza-forms/baza-forms',
	];
	static registerComponents = [
		'/baza/form/form.js',
		'/baza/field/field.js',
		'/baza/row/row.js',
		'/baza/card/card.js',
	];

	form;

	onTemplateLoaded() {
		// This.form.setSuccessHandler((response) => {
		// 	Console.log(response);
		// });
	}
}
