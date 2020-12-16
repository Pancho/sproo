const HALF_RADIAN = 180.0,
	BYTE = 256;

export default class Mavor {
	static EASING_OPTIONS = {
		'linear': (t) => t,
		'easeInQuad': (t) => t * t,
		'easeOutQuad': (t) => t * (2 - t),
		'easeInOutQuad': (t) => {
			if (t < 0.5) {
				return 2 * t * t;
			}

			return -1 + (4 - 2 * t) * t;
		},
		'easeInCubic': (t) => t * t * t,
		'easeOutCubic': (t) => {
			const internal = t - 1;

			return internal * internal * internal + 1;
		},
		'easeInOutCubic': (t) => {
			if (t < 0.5) {
				return 4 * t * t * t;
			}

			return (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
		},
		'easeInQuart': (t) => t * t * t * t,
		'easeOutQuart': (t) => {
			const internal = t - 1;

			return 1 - internal * internal * internal * internal;
		},
		'easeInOutQuart': (t) => {
			const internal = t - 1;

			if (t < 0.5) {
				return 8 * t * t * t * t;
			}

			return 1 - 8 * internal * internal * internal * internal;
		},
		'easeInQuint': (t) => t * t * t * t * t,
		'easeOutQuint': (t) => {
			const internal = t - 1;

			return 1 + internal * internal * internal * internal * internal;
		},
		'easeInOutQuint': (t) => {
			const internal = t - 1;

			if (t < 0.5) {
				return 16 * t * t * t * t * t;
			}

			return 1 + 16 * internal * internal * internal * internal * internal;
		},
	};

	// TODO: This needs fixing to work in this context
	static scrollTo(destination, duration, easing, callback) {
		let destinationOffset = 0,
			destinationOffsetToScroll = 0;

		const internalDuration = duration || 200,
			internalEasing = easing || 'linear',
			internalCallback = callback || (() => {
			}),
			start = window.pageYOffset,
			startTime = 'now' in window.performance ? performance.now() : (new Date).getTime(),
			documentHeight = Math.max(
				document.body.scrollHeight,
				document.body.offsetHeight,
				document.documentElement.clientHeight,
				document.documentElement.scrollHeight,
				document.documentElement.offsetHeight,
			),
			windowHeight = window.innerHeight || document.documentElement.clientHeight || document.querySelector('body').clientHeight,
			targetElement = document.querySelector(destination),
			scroll = () => {
				const now = 'now' in window.performance ? performance.now() : (new Date).getTime(),
					time = Math.min(1, (now - startTime) / internalDuration),
					timeFunction = Mavor.EASING_OPTIONS[internalEasing](time);

				window.scroll(0, Math.ceil(timeFunction * (destinationOffsetToScroll - start) + start));

				if (Math.abs(window.pageYOffset - destinationOffsetToScroll) < 2) {
					internalCallback();

					return;
				}

				destinationOffset = targetElement.offsetTop;
				destinationOffsetToScroll = Math.round(
					documentHeight - destinationOffset < windowHeight ? documentHeight - windowHeight : destinationOffset,
				);
				requestAnimationFrame(scroll);
			};

		destinationOffset = targetElement.offsetTop;
		destinationOffsetToScroll = Math.round(
			documentHeight - destinationOffset < windowHeight ? documentHeight - windowHeight : destinationOffset,
		);

		if (!('requestAnimationFrame' in window)) {
			window.scroll(0, destinationOffsetToScroll);
			callback();

			return;
		}

		scroll();
	}

	static debounce(cb, wait, immediate) {
		let timeout = null;

		return (ev) => {
			const context = this,
				later = function () {
					timeout = null;

					if (!immediate) {
						cb.apply(context, [ev]);
					}
				},
				callNow = immediate && !timeout;

			clearTimeout(timeout);
			timeout = setTimeout(later, wait);

			if (callNow) {
				cb.apply(context, [ev]);
			}
		};
	}

	static chunk(array, size) {
		return Array.from({length: Math.ceil(array.length / size)}, function (currentValue, index) {
			return array.slice(index * size, index * size + size);
		});
	}

	static countBy(array, callback) {
		return array.map(typeof callback === 'function' ? callback : function (val) {
			return val[callback];
		}).reduce(function (acc, val) {
			acc[val] = (acc[val] || 0) + 1;

			return acc;
		}, {});
	}

	static deepFlatten(array) {
		return [].concat.apply([], array.map(function (currentValue) {
			return Array.isArray(currentValue) ? Mavor.deepFlatten(currentValue) : currentValue;
		}));
	}

	static groupBy(array, callback) {
		return array.map(typeof callback === 'function' ? callback : function (currentValue) {
			return currentValue[callback];
		}).reduce(function (acc, val, i) {
			acc[val] = (acc[val] || []).concat(array[i]);

			return acc;
		}, {});
	}

	static arrayToCSV(array, delimiter) {
		const internalDelimiter = delimiter || ',';

		return array.map(function (currentValue) {
			return currentValue.map(function (innerCurrentValue) {
				if (isNaN(innerCurrentValue)) {
					return `\\${ innerCurrentValue.replace(/"/gu, '""') }\\`;
				}

				return innerCurrentValue;
			}).join(internalDelimiter);
		}).join('\n');
	}

	static JSONToCSV(array, columns, delimiter) {
		const internalDelimiter = delimiter || ',';

		return [columns.join(internalDelimiter)].concat(array.map(function (currentValue) {
			return columns.reduce(function (acc, key) {
				return `${ acc }${ acc.length ? delimiter : '' }"${ currentValue[key] ? currentValue[key] : '' }"`;
			}, '');
		})).join('\n');
	}

	static randomChoice(array) {
		return array[Math.floor(Math.random() * array.length)];
	}

	static shuffle(array) {
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

	static union(a, b) {
		return Array.from(new Set(a.concat(b)));
	}

	static createElement(string) {
		const wrapper = document.createElement('div');

		wrapper.innerHTML = string;

		return wrapper.firstElementChild;
	}

	static isMobile() {
		return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/iu.test(navigator.userAgent);
	}

	static slugify(text) {
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

	static kebabToCamel(string) {
		return string.split('-').map((item, index) => {
			if (index) {
				return item.charAt(0).toUpperCase() + item.slice(1).toLowerCase();
			}

			return item.toLowerCase();
		}).join('');
	}

	static snakeToCamel(string) {
		return string.split('_').map((item, index) => {
			if (index) {
				return item.charAt(0).toUpperCase() + item.slice(1).toLowerCase();
			}

			return item.toLowerCase();
		}).join('');
	}

	static camelToKebab(string) {
		return string
			.replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
			.replace(/([A-Z])([A-Z])(?=[a-z])/gu, '$1-$2')
			.toLowerCase();
	}

	static elementContains(parent, child) {
		return parent !== child && parent.contains(child);
	}

	static insertAfter(afterElement, htmlString) {
		return afterElement.insertAdjacentHTML('afterend', htmlString);
	}

	static insertBefore(beforeElement, htmlString) {
		return beforeElement.insertAdjacentHTML('beforebegin', htmlString);
	}

	static insertBeforeEnd(beforeElement, htmlString) {
		return beforeElement.insertAdjacentHTML('beforeend', htmlString);
	}

	static observeMutations(element, callback, options) {
		const observer = new MutationObserver(function (mutations) {
			return mutations.forEach(function (m) {
				return callback(m);
			});
		});

		observer.observe(element, {
			childList: true,
			attributes: true,
			attributeOldValue: true,
			characterData: true,
			characterDataOldValue: true,
			subtree: true,
			...options,
		});

		return observer;
	}

	static runAsync(fn) {
		const worker = new Worker(URL.createObjectURL(new Blob([`postMessage((${ fn })());`])));

		return new Promise(function (resolve, reject) {
			worker.onmessage = function (result) {
				const data = result.data;

				resolve(data);
				worker.terminate();
			};

			worker.onerror = function (err) {
				reject(err);
				worker.terminate();
			};
		});
	}

	static triggerEvent(element, eventType, detail) {
		return element.dispatchEvent(new CustomEvent(eventType, {detail: detail}));
	}

	static uuid() {
		return '10000000-1000-4000-8000-100000000000'.replace(/[018]/gu, function (c) {
			return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
		});
	}

	static getTimeFromDate(date) {
		return date.toTimeString().slice(0, 8);
	}

	static getDaysDiffBetweenDates(dateInitial, dateFinal) {
		return (dateFinal - (dateInitial || new Date)) / (1000 * 3600 * 24);
	}

	static average(...args) {
		return args.reduce(function (accumulator, currentValue) {
			return accumulator + currentValue;
		}, 0) / args.length;
	}

	static median(array) {
		const mid = Math.floor(array.length / 2),
			nums = array.slice().sort(function (a, b) {
				return a - b;
			});

		return array.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
	}

	static degreesToRads(deg) {
		return deg * Math.PI / HALF_RADIAN;
	}

	static radsToDegrees(rad) {
		return rad * HALF_RADIAN / Math.PI;
	}

	static randomIntArrayInRange(min, max, n) {
		const num = n || 1;

		return Array.from({length: num}, function () {
			return Math.floor(Math.random() * (max - min + 1)) + min;
		});
	}

	static randomIntegerInRange(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	static randomNumberInRange(min, max) {
		return Math.random() * (max - min) + min;
	}

	static round(n, decimals) {
		const internalDecimals = decimals || 0;

		return Number(`${ Math.round(Number(`${ n }e${ internalDecimals }`)) }e-${ internalDecimals }`);
	}

	static standardDeviation(arr, usePopulation) {
		const mean = arr.reduce(function (acc, val) {
			return acc + val;
		}, 0) / arr.length;

		return Math.sqrt(arr.reduce(function (acc, val) {
			return acc.concat((val - mean) ** 2);
		}, []).reduce(function (acc, val) {
			return acc + val;
		}, 0) / (arr.length - (usePopulation ? 0 : 1)));
	}

	static flattenObject(obj, prefix) {
		const internalPrefix = prefix || '';

		return Object.keys(obj).reduce(function (acc, k) {
			const pre = internalPrefix.length ? `${ internalPrefix }.` : '';
			let accumulator = acc;

			if (typeof obj[k] === 'object') {
				accumulator = {
					...accumulator,
					...Mavor.flattenObject(obj[k], pre + k),
				};
			} else {
				accumulator[pre + k] = obj[k];
			}

			return accumulator;
		}, {});
	}

	static invertKeyValues(obj, fn) {
		return Object.keys(obj).reduce(function (acc, key) {
			const val = fn ? fn(obj[key]) : obj[key];

			acc[val] = acc[val] || [];
			acc[val].push(key);

			return acc;
		}, {});
	}

	static stripHTMLTags(str) {
		return str.replace(/<[^>]*>/gu, '');
	}

	static toCamelCase(str) {
		const result = str &&
			str.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/gu).map(
				function (x) {
					return x.slice(0, 1).toUpperCase() + x.slice(1).toLowerCase();
				},
			).join('');

		return result.slice(0, 1).toLowerCase() + result.slice(1);
	}

	static getCookie(name) {
		const values = document.cookie.match(`(^|;) ?${ name }=([^;]*)(;|$)`);

		return values ? values[2] : null;
	}

	static setCookie(name, value, days) {
		const newDate = new Date;

		newDate.setTime(newDate.getTime() + 24 * 60 * 60 * 1000 * days);
		document.cookie = `${ name }=${ value };path=/;expires=${ newDate.toUTCString() }`;
	}

	static removeCookie(name) {
		Mavor.setCookie(name, '', -1);
	}

	static removeElement(element) {
		element.parentNode.removeChild(element);
	}

	static getRandomInt(max) {
		return Math.floor(Math.random() * Math.floor(max));
	}

	static scrambleColors() {
		document.querySelectorAll('*').forEach(function (elm) {
			elm.style.backgroundColor = `rgba(${
				Mavor.getRandomInt(BYTE)
			}, ${
				Mavor.getRandomInt(BYTE)
			}, ${
				Mavor.getRandomInt(BYTE)
			}, 1.0)`;
		});
	}
}
