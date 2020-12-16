import Component from '../fiu/js/component.js';
import {Utils} from '../fiu/js/utils.js';

export default class BazaComponent extends Component {
	constructor() {
		super();
		const additionalStylesPath = this.getAttribute('style-path');

		if (additionalStylesPath) {
			Utils.getCSS(additionalStylesPath, (css) => {
				this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, css];
			});
		}
	}
}
