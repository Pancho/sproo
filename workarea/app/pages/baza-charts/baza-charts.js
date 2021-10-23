import Component from '../../../fiu/js/component.js';

export default class BazaPageComponent extends Component {
	static tagName = 'baza-charts';
	static template = '/app/pages/baza-charts/baza-charts';
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		'/app/pages/baza-charts/baza-charts',
	];
	static registerComponents = [
		'/baza/chart/chart.js',
		'/baza/row/row.js',
		'/baza/card/card.js',
	];
	data = {};

	onTemplateLoaded() {
		this.app.http.get('/app/charts.json')
			.then((response) => response.json())
			.then((json) => {
				this.data = json;
			});
	}
}
