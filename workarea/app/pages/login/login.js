import Component from '../../../fiu/js/component.js';

export default class EmptyPageComponent extends Component {
	static tagName = 'empty-page';

	static template = '/app/pages/login/login';

	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		'/app/pages/login/login',
	];

	static registerComponents = [
		'/baza/form/form.js',
		'/baza/field/field.js',
	];

	form;

	onTemplateLoaded() {
		this.form.setSuccessHandler((response) => {
			console.log(response);
		});
	}
}
