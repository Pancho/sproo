import { CssStatic, HtmlStatic } from '../../fiu/js/utils.js';
import BazaComponent from '../baza-component.js';

const html = new HtmlStatic(`<form fiu-ref="form">
	<fieldset>
		<ol class="errors bg-red-50 border-red-70 white" fiu-ref="errors"></ol>
		<slot></slot>
		<div class="control" fiu-ref="control">
			<input type="submit" class="button bg-blue-50 bg-blue-60-hover" name="submit" id="submit" fiu-ref="button" />
		</div>
	</fieldset>
</form>`),
	css = new CssStatic(`:host {display:flex;}
form {width:100%;}
form *:not(select, input[type="checkbox"]) {-webkiest-appearance:none;-moz-appearance:none;appearance:none;}
form fieldset {}
form fieldset .errors {display:none;padding:5px 10px;border-width:0 0 0 5px;border-style:solid;margin:15px 15px 0 15px;}
form fieldset .errors.show {display:block;}
form fieldset .errors li {font-size:14px;line-height:20px;}
form fieldset slot {padding:15px;}
form fieldset .control {display:none;padding:15px;border-top:1px solid rgba(245, 245, 245, 1.0);}
form fieldset .control.show {display:block;}
form fieldset .control .button {text-decoration:none;display:inline-block;margin:0 15px 0 0;transition:.3s all ease;color:rgba(255, 255, 255, 1);font-size:14px;line-height:20px;font-weight:bold;padding:6px 12px;border:none;cursor:pointer;border-radius:2px;}
form fieldset ::slotted(.hidden-fields) {display:none;}
.form-help {font-size:14px;margin:5px 0 10px 0;}
.bg-red-50 {background-color:rgba(244,67,54,1.0);}
.border-red-70 {border-color:rgba(211,47,47,1.0);}
.bg-blue-50 {background-color:rgba(33,150,243,1.0);}
.bg-blue-60-hover:hover {background-color:rgba(30,136,229,1.0);}`);

export default class BazaFormComponent extends BazaComponent {
	static tagName = 'baza-form';
	static template = html;
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		css,
	];
	static registerComponents = [];

	form;
	control;
	button;
	errors;

	headers = {};
	requestOptions = {};
	successHandler = response => response;
	parser = response => response.json();

	fieldTranslations;

	constructor() {
		super();
	}

	unload() {
	}

	onTemplateLoaded() {
		const submitValue = this.attribute('submit-value'),
			skipAuthentication = this.attribute('skip-authentication');

		if (!!submitValue) {
			this.control.classList.add('show');
			this.button.setAttribute('value', submitValue);
		}

		this.form.addEventListener('submit', (event) => {
			event.preventDefault();

			const formData = new FormData();
			Object.entries(this.compileValues()).forEach(entry => {
				formData.append(...entry);
			});

			if (this.validate()) {
				this.app.http[this.attribute('method')](
					this.attribute('action'),
					formData,
					this.requestOptions,
					this.headers,
					skipAuthentication !== 'true',
				).then(this.parser).then(this.successHandler);
			}
		});
	}

	validate() {
		const fields = this.querySelectorAll('baza-field');
		let valid = true;
		fields.forEach(field => {
			valid = valid && field.validate();
		});

		return valid;
	}

	compileValues() {
		const result = {},
			fields = this.querySelectorAll('baza-field');

		fields.forEach((field, index) => {
			Object.assign(result, field.compileValues(this.fieldTranslations));
		});

		return result;
	}

	setHeaders(headers) {
		this.headers = headers;
	}

	setRequestOptions(requestOptions) {
		this.requestOptions = requestOptions;
	}

	setSuccessHandler(successHandler) {
		this.successHandler = successHandler;
	}

	setParser(parser) {
		this.parser = parser;
	}

	triggerSubmit() {
		this.shadowRoot.querySelector('form').dispatchEvent(new Event('submit'));
	}

	setErrors(errors) {
		const formErrors = errors.__all__;

		this.removeErrors(); // First we'll just clean any previous errors

		if (!!formErrors) {
			this.errors.classList.add('show');
			formErrors.forEach((error, index) => {
				const item = this.newElement('li');

				item.textContent = error.message;
				this.errors.appendChild(item);
			});
		}

		Object.entries(errors).forEach((entry, index) => {
			const selector = this.fieldTranslations && this.fieldTranslations[entry[0]] || entry[0],
				field = this.querySelector(`#${selector}`);
			if (!!field) {
				field.setErrors(entry[1]);
			}
		});
	}

	removeErrors() {
		this.errors.innerHTML = '';
		this.errors.classList.remove('show');
		this.querySelectorAll('baza-field').forEach(field => {
			field.removeErrors();
		});
	}

	populateForm(blob) {
		Object.entries(blob).forEach((entry, index) => {
			const selector = this.fieldTranslations && this.fieldTranslations[entry[0]] || entry[0],
				field = this.querySelector(`#${selector}`);
			if (!!field) {
				field.setValue(entry[1]);
			}
		});
	}

	setFieldTranslations(fieldTranslations) {
		this.fieldTranslations = fieldTranslations;
	}
}
