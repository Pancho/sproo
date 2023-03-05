export function getCookie(name) {
	const values = document.cookie.match(`(^|;) ?${ name }=([^;]*)(;|$)`);

	return values ? values[2] : null;
}

export function setCookie(name, value, days) {
	const newDate = new Date;

	newDate.setTime(newDate.getTime() + 24 * 60 * 60 * 1000 * days);
	document.cookie = `${ name }=${ value };path=/;expires=${ newDate.toUTCString() }`;
}

export function removeCookie(name) {
	setCookie(name, '', -1);
}
