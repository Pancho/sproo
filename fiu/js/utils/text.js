export function slugify(text) {
	return text
		.toString()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/gu, '')
		.toLowerCase()
		.trim()
		.replace(/\s+/gu, '-')
		.replace(/[^\w-]+/gu, '')
		.replace(/--+/gu, '-');
}

export function toCamelCase(str) {
	const result = str &&
		str.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/gu).map(
			function (x) {
				return x.slice(0, 1).toUpperCase() + x.slice(1).toLowerCase();
			},
		).join('');

	return result.slice(0, 1).toLowerCase() + result.slice(1);
}

export function kebabToCamel(string) {
	return string.split('-').map((item, index) => {
		if (index) {
			return item.charAt(0).toUpperCase() + item.slice(1).toLowerCase();
		}

		return item.toLowerCase();
	}).join('');
}

export function snakeToCamel(string) {
	return string.split('_').map((item, index) => {
		if (index) {
			return item.charAt(0).toUpperCase() + item.slice(1).toLowerCase();
		}

		return item.toLowerCase();
	}).join('');
}

export function camelToKebab(string) {
	return string
		.replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
		.replace(/([A-Z])([A-Z])(?=[a-z])/gu, '$1-$2')
		.toLowerCase();
}
