import utils from '../../../../fiu/js/utils/index.js';
import Component from '../../../fiu/js/component.js';

const html = new utils.HtmlStatic(`<pre>{{ stringifiedBlob }}</pre>`),
	css = new utils.CssStatic(`:host {display:flex;}`);

export default class JsonComponent extends Component {
	static tagName = 'json-component';
	static template = html;
	static stylesheets = [css];
	stringifiedBlob;

	set json(json) {
		this.stringifiedBlob = JSON.stringify(json, null, '\t');
	}
}
