import Component from '../../../fiu/js/component.js';

export default class ChildComponent extends Component {
	static tagName = 'child-component';
	static template = '/app/components/child-component/child-component';
	static stylesheets = [];

	set coords(coords) {
		this.dispatch('values-updated', coords);
		this.context = {
			coords: coords,
		};
	}
}
