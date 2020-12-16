const LEVELS = [
		'with-warnings',
		'trace',
		'debug',
		'log',
		'warn',
		'error',
	],
	WHITE = 0x00FFFFFF;

/**
 * Factory class for {@see Logger}
 */
export default class LoggerFactory {
	[Symbol.toStringTag] = 'LoggerFactory';
	/**
	 * Current logging level
	 */
	logLevel = 'with-warnings';
	worker;

	/**
	 * @return Single log function that can be called, e.g. getSingleLogger(...)('hello world')
	 * @param initiator - badge string, that every log will be marked with
	 * @param style - css style, e.g. `font-size: 10px; border-color: red`
	 * @param fn - bound function that will be called eventually, e.g. console.log
	 * @param minLevel - initial logging level, .e.g 2
	 */
	getSingleLogger(initiator, style, fn, minLevel = 'with-warnings') {
		return (...outerArgs) => {
			if (this.logLevel > minLevel) {
				return () => {
				};
			}

			const params = [console, `%c${ initiator }`, style, ...outerArgs];

			if (this.worker) {
				this.worker.postMessage({
					source: initiator,
					arguments: JSON.stringify(outerArgs),
					level: fn.name,
				});
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
				clazz.name, style, console.trace, 'trace'),
			debug: this.getSingleLogger(
				clazz.name, style, console.debug, 'debug'),
			log: this.getSingleLogger(
				clazz.name, style, console.log, 'log'),
			warn: this.getSingleLogger(
				clazz.name, style, console.warn, 'warn'),
			error: this.getSingleLogger(
				clazz.name, style, console.error, 'error'),
		};
	}

	setEndpoint(handler) {
		if (!handler) {
			return;
		}

		this.worker = LoggerFactory.createWorker(handler);
	}

	setLogLevel(logLevel) {
		if (!LEVELS.includes(logLevel)) {
			throw Error(`Invalid log level ${ logLevel },  allowed levels:  ${ JSON.stringify(LEVELS) }`);
		}

		this.logLevel = logLevel;
	}

	/**
	 * @return css for badge
	 * @param color - css color, e.g. #FFFAAA
	 */
	static getColorStyle(color) {
		return `color: white; background-color: ${
			color }; padding: 2px 6px; border-radius: 2px; font-size: 10px`;
	}

	static classToColor(clazz) {
		let color = '#FFFFFF',
			hash = 0,
			i = 0;
		const len = clazz.name.length;

		for (; i < len; i += 1) {
			hash = clazz.name.charCodeAt(i) + ((hash << 5) - hash);
		}

		color = (hash & WHITE)
			.toString(16)
			.toUpperCase();

		return '#00000'.substring(1, 6 - color.length) + color;
	}

	static createWorker(fn) {
		return new Worker(URL.createObjectURL(new Blob([`onmessage = ${ fn }`])));
	}
}
