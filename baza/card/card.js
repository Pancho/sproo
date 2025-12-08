import utils from '../../sproo/js/utils/index.js';
import BazaComponent from '../baza-component.js';

/** @const {utils.HtmlStatic} [HTML static template, so we don't load it from another file] */
const html = new utils.HtmlStatic(`<header>
	<h1 ref="titleElement"></h1>
</header>
<main>
	<slot></slot>
</main>`),
	/** @const {CssStatic} [CSS static template, so we don't load it from another file] */
	css = new utils.CssStatic(`:host {display:flex;margin:10px;padding:10px;flex:auto;flex-direction:column;}
	main {width:100%;}`);

/**
 * @class BazaCardComponent
 *
 * In your template you can use the card element with the tag <baza-card></baza-card>
 *
 * Whatever you put inside it will get slotted in the body of the card. The component has a single slot.
 *
 * The tag accepts one attribute: title
 *
 * You may also bind the title (:title="myTitle") and change it dynamically from the parent component. The slotted content
 * gets changed from the parent component by default.
 */
class BazaCardComponent extends BazaComponent {
	static tagName = 'baza-card';
	static template = html;
	static stylesheets = [
		'/sproo/css/normalize',
		css,
	];
	static registerComponents = [];
	titleElement;

	onTemplateLoaded() {
		const elementTitle = this.getAttribute('title');

		if (elementTitle) {
			this.titleElement.textContent = this.getAttribute('title');
		}
	}

	set title(title) {
		if (this.titleElement) {
			this.titleElement.textContent = title;
		}
	}

	get title() {
		return this.titleElement.textContent;
	}
}

export default BazaCardComponent;
