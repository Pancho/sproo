import utils from '../../../fiu/js/utils/index.js';
import BazaComponent from '../../baza-component.js';

const html = new utils.HtmlStatic(`<input type="text" name="field" id="field" />`),
	css = new utils.CssStatic(`:host {display:flex;flex-direction:column;}`);

export default class TextInputFieldComponent extends BazaComponent {
	static tagName = 'baza-field-text';
	static template = html;
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		css,
	];
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
