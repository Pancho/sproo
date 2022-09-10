import Component from '../../../fiu/js/component.js';

export default class BazaTablesComponent extends Component {
	static tagName = 'baza-tables';
	static template = '/app/pages/baza-tables/baza-tables';
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		'/app/pages/baza-tables/baza-tables',
	];
	static registerComponents = ['/baza/table/table.js'];

	headers = [
		{
			name: 'First Name',
			sortable: true,
		},
		{name: 'Last Name'},
		{
			name: 'Birth Date',
			transform: (dateString) => {
				const date = new Date(dateString);

				return `${ date.getDate() }.${ date.getMonth() + 1 }.${ date.getFullYear() }`;
			},
			sortable: true,
		},
		{
			name: 'Weight',
			transform: (weight) => `${ weight }kg`,
			sortable: true,
		},
		{
			name: 'Height',
			transform: (height) => `${ height }cm`,
			sortable: true,
		},
	];
	data = {};
	rotation = 4;
	blob = {};

	rotate() {
		if (this.rotation === 5) {
			this.rotation = 0;
		}

		this.app.http.get(`/app/tables-${ this.rotation }.json`)
			.then((response) => response.json())
			.then((json) => {
				this.data = json;
			});

		this.rotation += 1;
	}

	onTemplateLoaded() {
		// This.app.http.get('/app/tables.json')
		// This.app.http.get('/app/tables-short.json')
		// This.app.http.get('/app/tables-0.json')
		// This.app.http.get('/app/tables-3.json')
		this.app.http.get('/app/tables-4.json')
			.then((response) => response.json())
			.then((json) => {
				this.data = json;
			});
	}
}
