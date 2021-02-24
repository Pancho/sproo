import {CssStatic, HtmlStatic} from '../../fiu/js/utils.js';
import BazaComponent from '../baza-component.js';

const html = new HtmlStatic(`<h1 fiu-ref="titleElement"></h1>
<div>
	<slot></slot>
</div>`),
	css = new CssStatic(`:host {display:flex;margin:10px;padding:10px;flex:auto;flex-direction:column;}
	div {width:100%;}`);

export default class BazaCardComponent extends BazaComponent {
	static tagName = 'baza-card';
	static template = html;
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		css,
	];
	static registerComponents = [];
	titleElement;
	loading = false;

	onTemplateLoaded() {
		const elementTitle = this.getAttribute('title');

		if (elementTitle) {
			this.titleElement.textContent = this.getAttribute('title');
		} else {
			this.titleElement.remove();
		}
	}

	get title() {
		if (this.titleElement) {
			return this.titleElement.textContent;
		}

		return '';
	}

	set title(title) {
		if (this.titleElement) {
			this.titleElement.textContent = title;
		}
	}
}
