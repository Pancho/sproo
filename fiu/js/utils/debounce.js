export default function debounce(func, wait) {
	let timeout = null;

	return (ev) => {
		const context = this,
			later = function () {
				timeout = null;

				func.apply(context, [ev]);
			};

		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}
