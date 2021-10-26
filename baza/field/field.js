import utils from '../../fiu/js/utils/index.js';
import BazaComponent from '../baza-component.js';

const html = new utils.HtmlStatic(`<label fiu-ref="label"></label>
<slot></slot>
<ol fiu-ref="errors"></ol>`),
	css = new utils.CssStatic(`:host {display:flex;flex-direction:column;}`);

/*
* TODO: We still need file upload field, radio group, checkboxes(?); others (simple ones) can be covered by this one
* */
export default class BazaFieldComponent extends BazaComponent {
	static tagName = 'baza-field';
	static template = html;
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		css,
	];
	static registerComponents = [];
	static implementations = {
		'email': '/baza/field/lib/email.js',
		'text': '/baza/field/lib/text.js',
		'password': '/baza/field/lib/password.js',
	};
	// Internals to mimic a form field
	internals;
	internalValue;
	label;
	help;
	errors;

	constructor() {
		super();
		this.internals = this.attachInternals();
	}

	unload() {
		this.eslintPlaceholder = 0;
	}

	onTemplateLoaded() {
		this.eslintPlaceholder = 0;
	}

	get value() {
		return this.internalValue;
	}

	set value(value) {
		this.internalValue = value;
	}

	get form() {
		return this.internals.form;
	}
}
