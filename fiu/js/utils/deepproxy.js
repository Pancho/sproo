/* From: https://stackoverflow.com/a/61868531 */
export default class DeepProxy {
	constructor(target, handler) {
		this.original = new WeakMap;
		this.handler = handler;
		this.proxy = this.wrap(target, []);
	}

	unwrap(obj, key) {
		if (this.original.has(obj[key])) {
			obj[key] = this.original.get(obj[key]);
			this.original.delete(obj[key]);
		}

		Object.keys(obj[key]).forEach((elm) => {
			if (typeof obj[key][elm] === 'object') {
				this.unwrap(obj[key], elm);
			}
		});
	}

	wrap(obj, path) {
		for (const key of Object.keys(obj)) {
			if (typeof obj[key] === 'object') {
				obj[key] = this.wrap(obj[key], [...path, key]);
			}
		}

		const proxy = new Proxy(obj, this.makeHandler(path));

		this.original.set(proxy, obj);

		return proxy;
	}

	makeHandler(path) {
		const deepProxy = this;

		return {
			set(target, key, value, receiver) {
				let handlerValue = value;

				if (typeof value === 'object') {
					handlerValue = deepProxy.wrap(value, [...path, key]);
				}

				target[key] = handlerValue;

				if (deepProxy.handler.set) {
					deepProxy.handler.set(target, [...path, key], handlerValue, receiver);
				}

				return true;
			},

			deleteProperty(target, key) {
				if (Reflect.has(target, key)) {
					deepProxy.unwrap(target, key);
					const deleted = Reflect.deleteProperty(target, key);

					if (deleted && deepProxy.handler.deleteProperty) {
						deepProxy.handler.deleteProperty(target, [...path, key]);
					}

					return deleted;
				}

				return false;
			},
		};
	}
}
