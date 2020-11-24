import { CSSTemplate } from '../../../../fiu/js/component.js';
import { Component, HTMLTemplate } from '../../../fiu/js/component.js';

export class EmptyPageComponent extends Component {
	static tagName = 'empty-page';
	static template = new HTMLTemplate(`<template>
			<main class="bg-bluegrey-5">
				<div>
					<h2>Empty page (except this and that)</h2>
					<a route="/">To Demo</a>
				</div>
			</main>
		</template>`);
	static stylesheets = [
		'/fiu/css/meta',
		'/fiu/css/palette',
		'/fiu/css/normalize',
		new CSSTemplate(`/*This is just a test CSS that doesn't or rather shouldn't apply any styles to any elements found in either (file or in component) templates for empty component.*/
			blockquote {display:block;}
			img {display:inline-block;}
			hr {color:red;}
			button {border-radius:3px;}
			font {margin:0;}
			i {display:inline-block;}
			table {font-size:10px;}`),
	];
	static registerComponents = [];
}
