class Services {
	#appName = '';
	#staticRoot = '';
	#router = null;
	#http = null;
	#loggerFactory = null;
	#app = null;

	get appName() {
		return this.#appName;
	}

	set appName(value) {
		this.#appName = value;
	}

	get staticRoot() {
		return this.#staticRoot;
	}

	set staticRoot(value) {
		this.#staticRoot = value;
	}

	get router() {
		return this.#router;
	}

	set router(value) {
		this.#router = value;
	}

	get http() {
		return this.#http;
	}

	set http(value) {
		this.#http = value;
	}

	get loggerFactory() {
		return this.#loggerFactory;
	}

	set loggerFactory(value) {
		this.#loggerFactory = value;
	}

	get app() {
		return this.#app;
	}

	set app(value) {
		this.#app = value;
	}

	getLogger(clazz) {
		if (this.#loggerFactory) {
			return this.#loggerFactory.getLogger(clazz);
		}

		return new Proxy({}, {
			get: () => () => {},
		});
	}

	reset() {
		this.#appName = '';
		this.#staticRoot = '';
		this.#router = null;
		this.#http = null;
		this.#loggerFactory = null;
		this.#app = null;
	}
}


const services = new Services;

export default services;
