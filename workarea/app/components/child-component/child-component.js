import { Component } from '../../../fiu/js/component.js';

export class ChildComponent extends Component {
	static tagName = 'child-component';
	static template = '/app/components/child-component/child-component';
	static stylesheets = [];

	constructor() {
		super();
		this.logger.log('ChildComponent constructor finished')();
	}

	set coords (coords) {
		this.context = {
			coords: coords,
		}
	}
}
