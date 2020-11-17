import { Component } from '../../../fiu/js/component.js';

export class NotFoundComponent extends Component {
	static tagName = 'not-found-page';
	static template = '/app/pages/not-found/not-found';
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/palette',
		'/fiu/css/normalize',
		'/app/pages/not-found/not-found',
	];
}
