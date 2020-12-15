import { CssStatic, HtmlStatic } from '../../fiu/js/utils.js';
import BazaComponent from '../baza-component.js';

const html = new HtmlStatic(`<label fiu-ref="label"></label>
<slot></slot>
<ol class="errors bg-red-50 border-red-70 white" fiu-ref="errors"></ol>`),
	css = new CssStatic(`:host {display:flex;flex-direction:column;margin:0 0 10px 0;}
label {font-weight:bold;font-size:14px;line-height:20px;margin:0 0 5px 0;}
label span.far {cursor:pointer;}
.errors {flex-direction:column;display:none;padding:10px;border-width:0 0 0 5px;border-style:solid;margin:10px 0 0 0;}
.errors.show {display:block;}
.errors li {font-size:14px;line-height:20px;}
.form-help {font-size:14px;margin:5px 0 10px 0;}
.bg-red-50 {background-color:rgba(244,67,54,1.0);}
.border-red-70 {border-color:rgba(211,47,47,1.0);}
.white {color:rgba(255,255,255,1.0);}
::slotted(*:not(select)), ::slotted(*:not(input[type="checkbox"])) {-webkit-appearance:none;-moz-appearance:none;appearance:none;}
::slotted(input), ::slotted(select), ::slotted(textarea) {border-radius:0;box-shadow:none;width:calc(100% - 26px);height:20px;padding:6px 12px;font-size:14px;border-width:1px;border-style:solid;}
::slotted(select) {width:100%;height:34px;}
::slotted(textarea) {min-height:60px;resize:vertical;font-family:inherit;}
::slotted(input:focus), ::slotted(select:focus) {border-color:inherit;}
::slotted(textarea.high) {height:100px;}
::slotted([type="search"]) {-webkit-appearance:textfield;box-sizing:content-box;}
/*Need to solve radios and checkboxes too*/`);

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
		'text': '/baza/field/lib/text.js',
		'password': '/baza/field/lib/password.js',
	};

	// Internals to mimic a form field
	internals;
	internalValue;

	label;
	help;
	errors;
	control;

	constructor() {
		super();
		this.internals = this.attachInternals();
	}

	unload() {
	}

	onTemplateLoaded() {
		this.control = this.querySelector(':scope > *');

		if (!this.control) {
			throw new Error('You need to provide the actual HTML control (input, select...) that will provide the user input interface. This is just a wrapper. Be aware, that you can and may just forgo these custom elements and just use plain ol\' forms without any special handling.');
		}

		if (!this.form) {
			throw new Error('You cannot place a baza-field into an element that\'s not a baza-form. Future is awesome, but there is always a price to be paid.');
		}

		this.control.addEventListener('keyup', function (e) {
			if (e.keyCode === 13) {
				this.form.triggerSubmit();
			}
		});
		this.label.textContent = this.attribute('label');
		// this.label.addEventListener('click', event => {
		// 	control.focus();
		// });
		this.label.setAttribute('for', this.attribute('label-for'));
	}

	get value() {
		return this.internalValue;
	}

	set value(value) {
		this.internalValue = value;
	}

	get form() { return this.internals.form; }
}
