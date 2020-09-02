/**
 * Logging levels
 *
 */
export class LogStrict {

	/**
	 * Log all, raise an error if mismatch amount of arguments
	 */
	static LOG_RAISE_ERROR = 1;

	/**
	 * Log all, print a warning when mismatch amount of arguments
	 */
	static LOG_WITH_WARNINGS = 2;

	/**
	 * Log all
	 */
	static TRACE = 3;

	/**
	 * Hide: trace
	 * Print: debug, info, warn, error
	 */
	static DEBUG = 4;
	/**
	 * Print: info, warn, error
	 * Hide: trace, debug
	 */
	static LOG = 5;
	/**
	 * Print: warn, error
	 * Hide: trace, debug, info
	 */
	static WARN = 6;
	/**
	 * Print: error
	 * Hide: trace, debug, info, warn
	 */
	static ERROR = 7;
	/**
	 * Completely disable all loggin functions
	 */
	static DISABLE_LOGS = 8;
}

/**
 * Factory class for {@see Logger}
 */
export class LoggerFactory {
	/**
	 * Current logging level
	 */
	logLevel = LogStrict.LOG_WITH_WARNINGS;
	worker;

	constructor() {
	}

	noop() {
	}

	/**
	 * @return Single log function that can be called, e.g. getSingleLogger(...)('hello world')
	 * @param initiator - badge string, that every log will be marked with
	 * @param style - css style, e.g. `font-size: 10px; border-color: red`
	 * @param fn - bound function that will be called eventually, e.g. console.log
	 * @param minLevel - initial logging level, .e.g 2
	 */
	getSingleLogger(initiator, style, fn, minLevel = LogStrict.LOG_WITH_WARNINGS) {
		return (...outerArgs) => {
			if (this.logLevel > minLevel) {
				return this.noop;
			}
			const args = Array.prototype.slice.call(outerArgs);
			const parts = args.shift().split('{}');
			const partsLength = parts.length;
			let i = 0;
			const params = [console, '%c' + initiator, style];

			for (; i < partsLength; i += 1) {
				params.push(parts[i]);
				if (typeof args[i] !== 'undefined') {  // args can be '0'
					params.push(args[i]);
				}
			}
			if (parts.length - 1 !== args.length) {
				if (this.logLevel === LogStrict.LOG_WITH_WARNINGS) {
					console.error('Mismatch amount of arguments');
				} else if (this.logLevel === LogStrict.LOG_RAISE_ERROR) {
					throw new Error('Mismatch amount of arguments');
				}
			}
			if (this.worker) {
				this.worker.postMessage({
					source: initiator,
					arguments: JSON.stringify(outerArgs),
					level: fn.name,
					endpoint: this.endpoint,
				})
			}
			return Function.prototype.bind.apply(fn, params);
		};
	}

	/**
	 * @return a logger object
	 * @param clazz - class for which this logger will be created;
	 */
	getLogger(clazz) {
		const style = LoggerFactory.getColorStyle(LoggerFactory.classToColor(clazz));
		return {
			trace: this.getSingleLogger(
				clazz.name, style, console.trace, LogStrict.TRACE),
			debug: this.getSingleLogger(
				clazz.name, style, console.debug, LogStrict.DEBUG),
			log: this.getSingleLogger(
				clazz.name, style, console.log, LogStrict.LOG),
			warn: this.getSingleLogger(
				clazz.name, style, console.warn, LogStrict.WARN),
			error: this.getSingleLogger(
				clazz.name, style, console.error, LogStrict.ERROR),
		};
	}

	setEndpoint(endpoint) {
		if (!endpoint) {
			return;
		}

		this.endpoint = endpoint;
		this.worker = LoggerFactory.createWorker((message) => {
			const formData = new FormData();

			formData.append('source', message.data.source);
			formData.append('arguments', message.data.arguments);
			formData.append('level', message.data.level);
			const headers = {
				'Accept': 'application/json, text/plain, */*',
				'X-Requested-With': 'XMLHttpRequest',
			}, options = {
				method: 'POST',
				headers: headers,
				body: formData,
			};

			return fetch(message.data.endpoint, options);
		});
	}

	setLogLevel(logLevel) {
		if (LogStrict.LOG_RAISE_ERROR > logLevel || logLevel > LogStrict.DISABLE_LOGS) {
			throw Error(`Invalid log level ${logLevel} allowed:  ${JSON.stringify(LogStrict)}`);
		}
		this.logLevel = logLevel;
	}

	/**
	 * @return css for badge
	 * @param color - css color, e.g. #FFFAAA
	 */
	static getColorStyle(color) {
		return `color: white; background-color: ${
			color}; padding: 2px 6px; border-radius: 2px; font-size: 10px`;
	}

	static classToColor(clazz) {
		let hash = 0;
		let i = 0;
		const len = clazz.name.length;
		for (; i < len; i += 1) {
			hash = clazz.name.charCodeAt(i) + ((hash << 5) - hash);
		}

		const color = (hash & 0x00FFFFFF)
			.toString(16)
			.toUpperCase();

		return '#00000'.substring(1, 6 - color.length) + color;
	}

	static createWorker(fn) {
		return new Worker(URL.createObjectURL(new Blob([`onmessage = ${fn}`])));
	}
}