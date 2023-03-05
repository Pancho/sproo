export default class CssStatic {
	content;

	constructor(cssString) {
		const styleSheet = new CSSStyleSheet;

		styleSheet.replaceSync(cssString);
		this.content = styleSheet;
	}

	getContent() {
		return this.content;
	}
}
