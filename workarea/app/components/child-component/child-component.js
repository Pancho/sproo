import Component from '../../../fiu/js/component.js';

export default class ChildComponent extends Component {
	static tagName = 'child-component';
	static template = '/app/components/child-component/child-component';
	static stylesheets = [];
	coords = {
		x: 0,
		y: 0,
	};
}
