import { CssStatic, HtmlStatic } from '../../fiu/js/utils.js';
import BazaComponent from '../baza-component.js';

const html = new HtmlStatic(`<table>
	<thead fiu-ref="thead">
		<tr></tr>
	</thead>
	<tbody fiu-ref="tbody"></tbody>
	<tfoot fiu-ref="tfoot">
		<tr></tr>
	</tfoot>
</table>`),
	css = new CssStatic(`:host {display:flex;}
table {width:100%;border-collapse:separate;}
table tr {}
table tr td {padding:8px;font-size:14px;line-height:20px;vertical-align:top;}
table tr th {padding:8px;font-size:14px;line-height:20px;vertical-align:top;font-weight:700;}
table tr .narrow {width:20%;}
table tr .free {width:auto;}
table tr .wide {width:50%;}
table thead {display:none;}
table thead.show {display:table-header-group;}
table thead tr {}
table thead tr th {border-bottom:1px solid rgba(245, 245, 245, 1.0);cursor:pointer;}
table tbody tr {cursor:pointer;}
table tbody tr td {border-bottom:1px solid rgba(245, 245, 245, 1.0);}
table tbody tr td a {text-decoration:none;}
table tbody tr td img {max-width:30px;max-height:30px;}
table tbody tr:hover {background-color:rgba(245, 245, 245, 1.0);}
table tbody tr:last-child td {border-bottom:none;}
table tbody tr.hidden {display:none;}
table tfoot {display:none;}
table tfoot.show {display:table-footer-group;}
.button {text-decoration:none;display:inline-block;margin:0 15px 0 0;transition:.3s all ease;color:rgba(255, 255, 255, 1);font-size:14px;line-height:20px;font-weight:bold;padding:6px 12px;border:none;cursor:pointer;border-radius:2px;}
.button-small {padding:4px 8px;}`);

export default class BazaTableComponent extends BazaComponent {
	static tagName = 'baza-table';
	static template = html;
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		css,
	];
	static registerComponents = [];

	thead;
	tbody;
	tfoot;

	constructor() {
		super();
	}

	unload() {
	}

	onTemplateLoaded() {
		const header = this.attribute('header');

		if (!!header) {
			this.thead.classList.add('show');
			header.split(',').forEach((headerText, index) => {
				const heading = this.newElement('th');
				heading.textContent = headerText.trim();
				this.thead.querySelector('tr').append(heading);
			});
		}
	}

	updateBody(data) {
		this.tbody.innerHTML = '';
		data.forEach((dataRow, index) => {
			const row = this.newElement('tr');

			dataRow.forEach((dataCell, index) => {
				const cell = this.newElement('td');

				if (Array.isArray(dataCell)) {
					dataCell.forEach((part, index) => {
						cell.append(part);
					});
				} else {
					cell.append(dataCell);
				}
				row.append(cell);
			});

			this.tbody.append(row);
		});
	}
}
