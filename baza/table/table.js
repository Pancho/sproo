import utils from '../../sproo/js/utils/index.js';
import BazaComponent from '../baza-component.js';

const html = new utils.HtmlStatic(`<table>
	<thead ref="thead"></thead>
	<tbody ref="tbody">
		<tr for-each="row in internalData" for-key="0">
			<td for-each="column in row">{{ column }}</td>
		</tr>
	</tbody>
	<tfoot ref="tfoot"></tfoot>
</table>`),
	css = new utils.CssStatic(`:host {display:flex;}`);

export default class BazaTableComponent extends BazaComponent {
	static tagName = 'baza-table';
	static template = html;
	static stylesheets = [
		'/sproo/css/normalize',
		css,
	];
	internalHeaders = [];
	internalData = [];
	sortingIndex = {}

	thead;
	tbody;
	tfoot;

	onTemplateLoaded() {
	}

	set headers(headers) {
		if (!Array.isArray(headers)) {
			throw new Error(`Headers must be an array. Got ${ typeof headers }`);
		}

		this.internalHeaders = headers;
		const tableRow = this.newElement('tr');

		this.internalHeaders.forEach((header) => {
			const tableHeader = this.newElement('th');

			tableHeader.textContent = header.name;
			tableRow.appendChild(tableHeader);
		});
		this.thead.appendChild(tableRow);
	}

	get headers() {
		return this.internalHeaders;
	}

	set data(data) {
		if (!Array.isArray(data)) {
			throw new Error(`Data must be an array. Got ${ typeof data }`);
		}

		this.internalData = data;
	}

	get data() {
		return this.internalData;
	}
}
