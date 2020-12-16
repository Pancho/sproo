import {CssStatic, HtmlStatic} from '../../fiu/js/utils.js';
import BazaComponent from '../baza-component.js';

const html = new HtmlStatic(`<slot></slot>`),
	css = new CssStatic(`:host {}
slot {display:flex;flex-direction:row;flex:auto;}`);

export default class BazaRowComponent extends BazaComponent {
	static tagName = 'baza-row';
	static template = html;
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		css,
	];
	static registerComponents = [];

	onTemplateLoaded() {
		this.eslintPlaceholder = 0;
	}
}
