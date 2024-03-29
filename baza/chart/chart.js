import utils from '../../sproo/js/utils/index.js';
import BazaComponent from '../baza-component.js';

const html = new utils.HtmlStatic(`<h1 ref="titleElement" [textContent]="title"></h1>
		<svg ref="svgElement"></svg>
		<ol ref="legendElement"></ol>
		<div ref="tooltipElement"></div>`),
	css = new utils.CssStatic(`:host {display:flex;position:relative;}
			/*Must figure out what CSS would work for generalizing the color palette, for any type of chart*/
			[ref="svgElement"] {width:100%;margin:20px 0;}
			[ref="svgElement"] {width:100%;margin:20px 0;}
			[ref="svgElement"] .x-axis {stroke:rgba(238,238,238,1.0);}
			[ref="svgElement"] .y-axis {stroke:rgba(238,238,238,1.0);}
			[ref="svgElement"] .x-axis-text {fill:rgba(158,158,158,1.0);font-size:12px;line-height:16px;}
			[ref="svgElement"] .y-axis-text {fill:rgba(158,158,158,1.0);font-size:12px;line-height:16px;}
			[ref="svgElement"] .measure {fill:transparent;}
			[ref="svgElement"] .series-0 {fill:url(#series-0);stroke:rgba(30,136,229,0.5);}
			[ref="svgElement"] .series-1 {fill:url(#series-1);stroke:rgba(229,57,53,0.5);}
			[ref="svgElement"] .series-2 {fill:url(#series-2);stroke:rgba(102,187,106,0.5);}
			[ref="svgElement"] .line {fill:none;z-index:-1;}
			[ref="svgElement"] .line-marker {opacity:0;transition:.3s all ease;fill:transparent;}
			[ref="svgElement"] .line-marker:hover {opacity:1;}
			[ref="svgElement"] .line-marker-0.line-marker-circle {fill:rgba(30,136,229,1.0);}
			[ref="svgElement"] .line-marker-1.line-marker-circle {fill:rgba(229,57,53,1.0);}
			[ref="svgElement"] .line-marker-2.line-marker-circle {fill:rgba(102,187,106,1.0);}
			[ref="svgElement"] .line-marker-outer.line-marker-circle {opacity:0.2;}
			[ref="svgElement"] .line-marker-border.line-marker-circle {fill:rgba(255,255,255,1.0);}
			[ref="svgElement"] .line-marker-inner.line-marker-circle {opacity:0.6;}
			[ref="svgElement"] .candle {}
			[ref="svgElement"] .candle-close-high {fill:rgba(102,187,106,1.0);stroke:rgba(102,187,106,1.0);}
			[ref="svgElement"] .candle-close-low {fill:rgba(229,57,53,1.0);stroke:rgba(229,57,53,1.0);}
			[ref="svgElement"] .candle-close-body {}
			[ref="svgElement"] .candle-wick {}
			[ref="svgElement"] .candle-marker {opacity:0;transition:.3s all ease;fill:transparent;}
			[ref="svgElement"] .border {stroke:purple;}
			.series-0-stop-0 {stop-color:rgba(30,136,229,0.5);}
			.series-0-stop-1 {stop-color:rgba(30,136,229,0.25);}
			.series-0-stop-2 {stop-color:rgba(255,255,255,0.1);}
			.series-1-stop-0 {stop-color:rgba(229,57,53,0.5);}
			.series-1-stop-1 {stop-color:rgba(255,255,255,0.1);}
			.series-2-stop-0 {stop-color:rgba(102,187,106,0.5);}
			.series-2-stop-1 {stop-color:rgba(102,187,106,0.1);}
			[ref="tooltipElement"] {display:none;position:absolute;padding:5px;width:150px;background:rgba(0,0,0,0.9);}
			[ref="tooltipElement"] div {color:rgba(255,255,255,1.0);}
			[ref="tooltipElement"] div h6 {font-weight:600;font-size:14px;line-height:20px;}
			[ref="tooltipElement"] div p {font-size:12px;line-height:20px;}
			[ref="tooltipElement"] div p span {font-weight:500;}
`);

export default class BazaChartComponent extends BazaComponent {
	static tagName = 'baza-chart';
	static template = html;
	static stylesheets = [
		'/sproo/css/meta',
		'/sproo/css/normalize',
		css,
	];

	static registerComponents = [];
	static implementations = {
		'candlestick': '/baza/chart/lib/candlestick-chart.js',
		'column': '/baza/chart/lib/column-chart.js',
		'line': '/baza/chart/lib/line-chart.js',
	};

	chartReady;
	titleElement;
	svgElement;
	legendElement;
	tooltipElement;
	internalSeries;
	internalConfig;

	seriesProperty;
	configProperty;

	onTemplateLoaded() {
		const elementTitle = this.getAttribute('title');

		if (elementTitle) {
			this.titleElement.textContent = this.getAttribute('title');
		} else {
			this.titleElement.remove();
		}

		this.chartReady = new Promise((resolve) => {
			import(BazaChartComponent.implementations[this.attribute('chart')])
				.then((module) => {
					resolve(new module.default(this.svgElement));
				});
		});
	}

	get series() {
		return this.seriesProperty;
	}

	set series(series) {
		this.seriesProperty = series;
		this.chartReady.then((chart) => chart.renderData(this.seriesProperty));
	}

	get config() {
		return this.configProperty;
	}

	set config(config) {
		this.configProperty = config;
		this.chartReady.then((chart) => {
			chart.setupTooltip(this.tooltipElement, this.configProperty);
			chart.addLinearGradients(this.configProperty.linearGradients);
			chart.setPadding(this.configProperty.padding);
		});
	}
}
