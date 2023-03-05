export function choice(array) {
	return array[Math.floor(Math.random() * array.length)];
}

export function shuffle(array) {
	const result = array.slice(0);
	let temp = [],
		i = 0,
		arrayLength = result.length;

	while (arrayLength) {
		i = Math.floor(Math.random() * (arrayLength -= 1));
		temp = [result[i], result[arrayLength]];
		result[arrayLength] = temp[0];
		result[i] = temp[1];
	}

	return result;
}

export function randomIntArrayInRange(min, max, n) {
	const num = n || 1;

	return Array.from({length: num}, function () {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	});
}

export function randomIntegerInRange(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomNumberInRange(min, max) {
	return Math.random() * (max - min) + min;
}

export function getRandomInt(max) {
	return Math.floor(Math.random() * Math.floor(max));
}
