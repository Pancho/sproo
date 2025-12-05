export default function debounce(func, delay) {
	let timer = 0;

	return () => {
		clearTimeout(timer);
		timer = setTimeout(() => func(), delay);
	};
}
