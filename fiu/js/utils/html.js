export default class HtmlStatic {
	static domParser = (new DOMParser);
	content;

	constructor(htmlString) {
		this.content = HtmlStatic.domParser.parseFromString(`<template>${ htmlString }</template>`, 'text/html');
	}

	getContent() {
		return this.content.querySelector('template').content.cloneNode(true);
	}
}
