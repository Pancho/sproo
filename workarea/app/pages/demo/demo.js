import Component from '../../../fiu/js/component.js';


export default class DemoPageComponent extends Component {
	static tagName = 'demo-page';
	static template = '/app/pages/demo/demo';
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/normalize',
		'/app/pages/demo/demo',
	];
	static registerComponents = [
		'/app/components/child-component/child-component.js',
		'/app/components/json-component/json-component.js',
	];
	paragraphContainer;
	testList = [];
	timestampText = '/////////////////';
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
			booleanValue: true,
		},
		{
			name: 'Second',
			children: [
				{
					name: 'Child of second 1',
					other: 'Child of second other 1',
					booleanValue: false,
				},
				{
					name: 'Child of second 2',
					other: 'Child of second other 2',
					booleanValue: true,
				},
			],
		},
	];
	dictFor = {};
	valuesUpdated = false;
	booleanValue = true;
	coordinates = '(0, 0)';
	coordinates2 = '(0, 0)';
	coordinates3 = {};
	coords = {
		x: 0,
		y: 0,
	};

	onTemplateLoaded() {
		setTimeout(() => {
			this.testList = [
				{
					title: 'Test Title 1',
					text: 'Lorem ipsum dolor sit amet 1',
					date: '01.01.2021',
				},
				{
					title: 'Test Title 2',
					text: 'Lorem ipsum dolor sit amet 2',
					date: '02.01.2021',
				},
				{
					title: 'Test Title 3',
					text: 'Lorem ipsum dolor sit amet 3',
					date: '03.01.2021',
				},
			];
			this.dictFor = {
				name: 'Name',
				lastName: 'Lastname',
				prop1: 'Prop 1',
				prop2: 'Prop 2',
				prop3: 'Prop 3',
			};
		}, 1000);
		// SetTimeout((_) => {
		setInterval((_) => {
			this.timestampText = Number(new Date);
		}, 1000);
		setTimeout((_) => {
			this.nested[2] = {name: 'Third'};
			this.nested.push({name: 'Third'});
			this.nested[2].children = [
				{
					name: 'Child of third 1',
					other: 'Child of third other 1',
					booleanValue: false,
				},
				{
					name: 'Child of third 2',
					other: 'Child of third other 2',
					booleanValue: false,
				},
			];
		}, 1000);
		setTimeout((_) => {
			// This.nested[2] = {name: 'Third'};
			this.nested.push({name: 'Fourth'});
			this.nested[3].children = [
				{
					name: 'Child of fourth 1',
					other: 'Child of fourth other 1',
					booleanValue: false,
				},
				{
					name: 'Child of fourth 2',
					other: 'Child of fourth other 2',
				},
			];
		}, 2000);
		this.nested.push({name: 'Third'});
		this.nested[0].children = [
			{
				name: 'Third',
				booleanValue: false,
			},
		];
		this.testList.push({
			title: 'Test Title 4',
			text: 'Lorem ipsum dolor sit amet 4',
			date: '04.01.2021',
		});
		setTimeout((_) => {
			console.log('sort start');
			this.testList.reverse();
			console.log('sort end');
		}, 2000);
		setTimeout(() => {
			console.log('push start', this.testList);
			this.testList.push({
				title: 'Test Title 5',
				text: 'Lorem ipsum dolor sit amet 5',
				date: '05.01.2021',
			});
			console.log('push end');
		}, 3000);
		setTimeout((_) => {
			console.log('pop start');
			this.testList.pop();
			this.dictFor['x'] = 'y';
			console.log('pop end');
		}, 4000);
		setTimeout((_) => {
			console.log('shift start');
			this.testList.shift();
			console.log('shift end');
		}, 5000);
	}

	logEvent(ev) {
		this.booleanValue = !this.booleanValue;
		this.nested[0].booleanValue = !this.nested[0].booleanValue;
		this.nested[0].children[0].booleanValue = !this.nested[0].children[0].booleanValue;
		this.coordinates = `(${ ev.screenX }, ${ ev.screenY })`;
		this.coordinates2 = `(${ ev.screenX }, ${ ev.screenY })`;
		this.coordinates3.key = ev.screenX;
		this.coordinates3.value = ev.screenY;
		this.coords = {
			x: ev.screenX,
			y: ev.screenY,
		};
	}

	notifyValuesUpdated() {
		this.valuesUpdated = true;
	}

	addRecord() {
		console.log(this.testList);
		this.testList.push({
			title: 'Test Title 999',
			text: 'Lorem ipsum dolor sit amet 999',
			date: '05.01.2021',
		});

		return false;
	}

	forElementClick(ev, x, y) {
		console.log('forElementClick', ev, x, y);
		ev.stopPropagation();
	}
}
