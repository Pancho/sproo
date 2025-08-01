const LEVELS = [
		'trace',
		'debug',
		'log',
		'warn',
		'error',
	],
	WHITE = 0x00FFFFFF;

export default class LoggerFactory {
	[Symbol.toStringTag] = 'LoggerFactory';
	logLevels = LEVELS;
	worker;

	getLogger(clazz) {
		const style = LoggerFactory.getColorStyle(LoggerFactory.classToColor(clazz));

		return new LoggerService(clazz, style, this.logLevels, this.worker);
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

		this.logLevels = LEVELS.splice(LEVELS.indexOf(logLevel), LEVELS.length);
	}

	static getColorStyle(color) {
		return `color: white; background-color: ${
			color }; padding: 2px 6px; border-radius: 2px; font-size: 10px`;
	}

	static classToColor(clazz) {
		let hash = 0,
			i = 0;
		const len = clazz.name.length;

		for (; i < len; i += 1) {
			hash = clazz.name.charCodeAt(i) + ((hash << 5) - hash);
		}

		// Generate RGB components with reduced brightness to ensure dark colors
		const r = Math.floor((hash & 0xFF) * 0.6), // Limit red to 60% of max
			g = Math.floor(((hash >> 8) & 0xFF) * 0.6), // Limit green to 60% of max
			b = Math.floor(((hash >> 16) & 0xFF) * 0.6), // Limit blue to 60% of max
			toHex = (value) => Number(value).toString(16).padStart(2, '0');

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

	static createWorker(fn) {
		return new Worker(URL.createObjectURL(new Blob([`onmessage = ${ fn }`])));
	}
}


class LoggerService {
	[Symbol.toStringTag] = 'LoggerService';

	clazz;
	style;
	logLevels;
	worker;

	constructor(clazz, style, logLevels, worker) {
		this.clazz = clazz;
		this.style = style;
		this.logLevels = logLevels;
		this.worker = worker;
	}

	get trace() {
		if (!this.logLevels.includes('trace')) {
			return () => {};
		}

		if (this.worker) {
			return (...args) => {
				LoggerService.postMessage(this.worker, this.clazz, 'trace', ...args);
			};
		}

		return console.trace.bind(window.console, `%c TRACE: ${ this.clazz.name }`, this.style);
	}

	get debug() {
		if (!this.logLevels.includes('debug')) {
			return () => {};
		}

		if (this.worker) {
			return (...args) => {
				LoggerService.postMessage(this.worker, this.clazz, 'debug', ...args);
			};
		}

		return console.debug.bind(window.console, `%c DEBUG: ${ this.clazz.name }`, this.style);
	}

	get log() {
		if (!this.logLevels.includes('log')) {
			return () => {};
		}

		if (this.worker) {
			return (...args) => {
				LoggerService.postMessage(this.worker, this.clazz, 'log', ...args);
			};
		}

		return console.log.bind(window.console, `%c LOG: ${ this.clazz.name }`, this.style);
	}

	get warn() {
		if (!this.logLevels.includes('warn')) {
			return () => {};
		}

		if (this.worker) {
			return (...args) => {
				LoggerService.postMessage(this.worker, this.clazz, 'warn', ...args);
			};
		}

		return console.warn.bind(window.console, `%c WARN: ${ this.clazz.name }`, this.style);
	}

	get error() {
		if (!this.logLevels.includes('error')) {
			return () => {};
		}

		if (this.worker) {
			return (...args) => {
				LoggerService.postMessage(this.worker, this.clazz, 'error', ...args);
			};
		}

		return console.error.bind(window.console, `%c ERROR: ${ this.clazz.name }`, this.style);
	}

	static postMessage(worker, clazz, level, ...args) {
		if (worker) {
			worker.postMessage({
				source: clazz.name,
				arguments: JSON.stringify(args),
				level: level,
			});
		}
	}
}
