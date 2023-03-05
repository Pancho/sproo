import Component from '../sproo/js/component.js';
import utils from '../sproo/js/utils/index.js';

/**
 * @class BazaComponent
 * @extends Component
 *
 * This class extends the sproo base Component class and adds a way to inject a path to custom CSS file
 * via style-path attribute on the component element in the template.
 *
 * This is convenient for the baza components that strive to be generic, so if we must set templates
 * into stone, at least we can allow the end user to style them the way they please.
 *
 * The style-path attribute is not bindable, hence the styles have to be specified in advance.
 */
class BazaComponent extends Component {
	constructor() {
		super();
		const additionalStylesPath = this.getAttribute('style-path');

		if (additionalStylesPath) {
			this.templateLoaded.then(() => {
				utils.Loader.getCSS(additionalStylesPath, (css) => {
					this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, css];
				});
			});
		}
	}
}

export default BazaComponent;
