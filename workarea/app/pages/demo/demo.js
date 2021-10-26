import Component from '../../../fiu/js/component.js';


export default class DemoPageComponent extends Component {
	static tagName = 'demo-page';
	static template = '/app/pages/demo/demo';
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		'/app/pages/demo/demo',
	];
	static registerComponents = ['/app/components/child-component/child-component.js'];
	paragraphContainer;
	// testList = [
	// 	{
	// 		title: 'Test Title 1',
	// 		text: 'Lorem ipsum dolor sit amet 1',
	// 		date: '01.01.2021',
	// 	},
	// 	{
	// 		title: 'Test Title 2',
	// 		text: 'Lorem ipsum dolor sit amet 2',
	// 		date: '02.01.2021',
	// 	},
	// 	{
	// 		title: 'Test Title 3',
	// 		text: 'Lorem ipsum dolor sit amet 3',
	// 		date: '03.01.2021',
	// 	},
	// ];
	outerScopeText = '/////////////////';
	nested = [
		{
			name: 'First',
			children: [
				{
					name: 'Child of first 1',
					other: 'Child of first other 1',
					booleanValue: false,
				},
				{
					name: 'Child of first 2',
					other: 'Child of first other 2',
					booleanValue: false,
				},
			],
		},
		// {
		// 	name: 'Second',
		// 	children: [
		// 		{
		// 			name: 'Child of second 1',
		// 			other: 'Child of second other 1',
		// 		},
		// 		{
		// 			name: 'Child of second 2',
		// 			other: 'Child of second other 2',
		// 		},
		// 	],
		// },
	];
	dictFor = {
		name: 'Name',
		lastName: 'Lastname',
		prop1: 'Prop 1',
		prop2: 'Prop 2',
		prop3: 'Prop 3',
	}
	valuesUpdated = false;
	booleanValue = true;
	blah = '(0, 0)';
	coords = {
		x: 0,
		y: 0,
	};

	onTemplateLoaded() {
		setInterval(_ => {
			this.outerScopeText = +(new Date());
		}, 1000);
		// setTimeout(_ => {
		// 	// this.nested[2] = {name: 'Third'};
		// 	this.nested.push({name: 'Third'});
		// 	this.nested[2].children = [
		// 		{
		// 			name: 'Child of third 1',
		// 			Other: 'Child of third other 1',
		// 			booleanValue: false,
		// 		},
		// 		{
		// 			name: 'Child of third 2',
		// 			other: 'Child of third other 2',
		// 			booleanValue: false,
		// 		},
		// 	];
		// }, 1000);
		// setTimeout(_ => {
		// 	// this.nested[2] = {name: 'Third'};
		// 	this.nested.push({name: 'Fourth'});
		// 	this.nested[3].children = [
		// 		{
		// 			name: 'Child of fourth 1',
		// 			other: 'Child of fourth other 1',
		// 			booleanValue: false,
		// 		},
		// 		{
		// 			name: 'Child of fourth 2',
		// 			other: 'Child of fourth other 2',
		// 		},
		// 	];
		// }, 2000);
		// this.nested.push({name: 'Third'})
		// this.nested[0].children = {name: 'Third'}
		// this.testList.push({
		// 	title: 'Test Title 4',
		// 	text: 'Lorem ipsum dolor sit amet 4',
		// 	date: '04.01.2021',
		// });
		// setTimeout(_ => {
		// 	this.testList.push({
		// 		title: 'Test Title 5',
		// 		text: 'Lorem ipsum dolor sit amet 5',
		// 		date: '05.01.2021',
		// 	});
		// }, 2000);
		// setTimeout(_ => {
		// 	this.testList.pop();
		// }, 4000);
		// setTimeout(_ => {
		// 	this.testList.shift();
		// }, 6000);
	}

	logEvent(ev) {
		this.booleanValue = !this.booleanValue;
		this.nested[0].children[0].booleanValue = !this.nested[0].children[0].booleanValue;
		this.blah = `(${ ev.screenX }, ${ ev.screenY })`;
		this.coords = {
			x: ev.screenX,
			y: ev.screenY,
		};
	}

	notifyValuesUpdated() {
		this.valuesUpdated = true;
	}

	forElementClick(ev, x, y) {
		console.log('forElementClick', ev, x, y);
	}
}
