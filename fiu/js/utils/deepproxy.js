/* From: https://stackoverflow.com/a/61868531 */
export default class DeepProxy {
	constructor(target, handler) {
		this.preproxy = new WeakMap();
		this.handler = handler;

		return this.wrap(target, []);
	}

	unwrap(obj, key) {
		if (this.preproxy.has(obj[key])) {
			obj[key] = this.preproxy.get(obj[key]);
			this.preproxy.delete(obj[key]);
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

		const p = new Proxy(obj, this.makeHandler(path));

		this.preproxy.set(p, obj);

		return p;
	}

	makeHandler(path) {
		const deepProxy = this;

		return {
			set(target, key, value, receiver) {
				if (typeof value === 'object') {
					value = deepProxy.wrap(value, [...path, key]);
				}

				target[key] = value;

				if (deepProxy.handler.set) {
					deepProxy.handler.set(target, [...path, key], value, receiver);
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
