import utils from '../../fiu/js/utils/index.js';
import BazaComponent from '../baza-component.js';

const html = new utils.HtmlStatic(`<table>
	<thead fiu-ref="thead"></thead>
	<tbody fiu-ref="tbody">
		<tr for-each="row in internalData">
			<td for-each="item in row"><span [text-content]="item"></span></td>
		</tr>
	</tbody>
	<tfoot fiu-ref="tfoot"></tfoot>
</table>`),
	css = new utils.CssStatic(`:host {display:flex;}`);

export default class BazaTableComponent extends BazaComponent {
	static tagName = 'baza-table';
	static template = html;
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
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
		// this.internalData.forEach((dataRow) => {
		// 	const row = this.newElement('tr');
		//
		// 	dataRow.forEach((dataCell, index) => {
		// 		const cell = this.newElement('td');
		//
		// 		if (this.internalHeaders[index].transform) {
		// 			cell.textContent = this.internalHeaders[index].transform(dataCell);
		// 		} else {
		// 			cell.textContent = dataCell;
		// 		}
		//
		// 		row.append(cell);
		// 	});
		//
		// 	this.tbody.append(row);
		// });
	}

	get data() {
		return this.internalData;
	}
}
