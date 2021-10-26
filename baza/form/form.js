import utils from '../../fiu/js/utils/index.js';
import BazaComponent from '../baza-component.js';

const html = new utils.HtmlStatic(`<form fiu-ref="form">
	<fieldset>
		<legend fiu-ref="legend"></legend>
		<ol id="errors" fiu-ref="errors"></ol>
		<slot></slot>
		<div>
			<input type="submit" id="submit" name="submit" fiu-ref="button" value="Submit" />
		</div>
	</fieldset>
</form>`),
	css = new utils.CssStatic(`:host {display:flex;}`);

/**
 * Submit - mandatory; put into value what is passed as an attribute
 * legend - non-mandatory; if set to truthy value, add the element, if set to falsy value or not set, remove the element
 * authentication - non-mandatory; if you don't want to use authentication for your requests, otherwise set to true (as a raw text attribute, like so: use-authentication="true")
 */

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
	legend;
	button;
	errors;
	headers = {};
	requestOptions = {};
	useAuthentication = false;
	fieldTranslations;
	successHandler = (response) => response;
	parser = (response) => response.json();

	onTemplateLoaded() {
		const submitValue = this.attribute('submit-value'),
			legendValue = this.attribute('legend');

		this.useAuthentication = this.attribute('authentication') === 'true';

		if (submitValue) {
			this.button.setAttribute('value', submitValue);
		}

		if (legendValue) {
			this.legend.textContent = legendValue;
		}

		// This.form.addEventListener('submit', (event) => {
		// 	Event.preventDefault();
		//
		// 	Const formData = new FormData;
		//
		// 	Object.entries(this.compileValues()).forEach((entry) => {
		// 		FormData.append(...entry);
		// 	});
		//
		// 	If (this.validate()) {
		// 		This.app.http[this.attribute('method')](
		// 			This.attribute('action'),
		// 			FormData,
		// 			This.requestOptions,
		// 			This.headers,
		// 			Boolean(useAuthentication),
		// 		).then(this.parser).then(this.successHandler);
		// 	}
		// });
	}

	// Validate() {
	// 	Const fields = this.querySelectorAll('baza-field');
	// 	Let valid = true;
	//
	// 	Fields.forEach((field) => {
	// 		Valid = valid && field.validate();
	// 	});
	//
	// 	Return valid;
	// }
	//
	// CompileValues() {
	// 	Const result = {},
	// 		Fields = this.querySelectorAll('baza-field');
	//
	// 	Fields.forEach((field) => {
	// 		Object.assign(result, field.compileValues(this.fieldTranslations));
	// 	});
	//
	// 	Return result;
	// }
	//
	// SetHeaders(headers) {
	// 	This.headers = headers;
	// }
	//
	// SetRequestOptions(requestOptions) {
	// 	This.requestOptions = requestOptions;
	// }
	//
	// SetSuccessHandler(successHandler) {
	// 	This.successHandler = successHandler;
	// }
	//
	// SetParser(parser) {
	// 	This.parser = parser;
	// }
	//
	// TriggerSubmit() {
	// 	This.shadowRoot.querySelector('form').dispatchEvent(new Event('submit'));
	// }
	//
	// SetErrors(errors) {
	// 	Const formErrors = errors['__all__'];
	//
	// 	This.removeErrors(); // First we'll just clean any previous errors
	//
	// 	If (formErrors) {
	// 		This.errors.classList.add('show');
	// 		FormErrors.forEach((error) => {
	// 			Const item = this.newElement('li');
	//
	// 			Item.textContent = error.message;
	// 			This.errors.appendChild(item);
	// 		});
	// 	}
	//
	// 	Object.entries(errors).forEach((entry) => {
	// 		Const selector = this.fieldTranslations && this.fieldTranslations[entry[0]] || entry[0],
	// 			Field = this.querySelector(`#${ selector }`);
	//
	// 		If (field) {
	// 			Field.setErrors(entry[1]);
	// 		}
	// 	});
	// }
	//
	// RemoveErrors() {
	// 	This.errors.innerHTML = '';
	// 	This.errors.classList.remove('show');
	// 	This.querySelectorAll('baza-field').forEach((field) => {
	// 		Field.removeErrors();
	// 	});
	// }
	//
	// PopulateForm(blob) {
	// 	Object.entries(blob).forEach((entry) => {
	// 		Const selector = this.fieldTranslations && this.fieldTranslations[entry[0]] || entry[0],
	// 			Field = this.querySelector(`#${ selector }`);
	//
	// 		If (field) {
	// 			Field.setValue(entry[1]);
	// 		}
	// 	});
	// }
	//
	// SetFieldTranslations(fieldTranslations) {
	// 	This.fieldTranslations = fieldTranslations;
	// }
}
