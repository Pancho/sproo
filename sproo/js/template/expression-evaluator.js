const SIMPLE_PROPERTY_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$.?]*$/u,
	EVALUATION_ERROR = Symbol('EVALUATION_ERROR'),
	functionCache = new Map();


export default class ExpressionEvaluator {
	#component;

	constructor(component) {
		this.#component = component;
	}

	evaluate(expression, context) {
		try {
			if (SIMPLE_PROPERTY_REGEX.test(expression) && !expression.includes('(')) {
				return this.#getProperty(expression, context);
			}

			const componentContext = this.#component.getContext ? this.#component.getContext() : {},
				componentMethods = this.#component.getMethods ? this.#component.getMethods() : {},
				fullContext = {...componentContext, ...context, ...componentMethods},
				args = Object.keys(fullContext),
				values = Object.values(fullContext),
				func = this.#getOrCreateFunction(expression, args);

			return func.apply(this.#component, values);
		} catch (error) {
			console.warn(`[ExpressionEvaluator] Error evaluating expression "${expression}":`, error.message);

			return EVALUATION_ERROR;
		}
	}

	#getOrCreateFunction(expression, args) {
		const sortedArgs = [...args].sort(),
			cacheKey = `${expression}|${sortedArgs.join(',')}`;

		if (!functionCache.has(cacheKey)) {
			// eslint-disable-next-line no-new-func
			const func = new Function(...args, `return ${expression}`);

			functionCache.set(cacheKey, func);
		}

		return functionCache.get(cacheKey);
	}

	#getProperty(path, context) {
		try {
			const parts = path.split('.').map((p) => p.replace(/\?/gu, ''));

			if (typeof context[parts[0]] !== 'undefined') {
				let value = context[parts[0]];

				for (let i = 1; i < parts.length && value; i += 1) {
					value = value[parts[i]];
				}

				return value;
			}

			const componentContext = this.#component.getContext ? this.#component.getContext() : {};

			if (typeof componentContext[parts[0]] !== 'undefined') {
				let value = componentContext[parts[0]];

				for (let i = 1; i < parts.length && value; i += 1) {
					value = value[parts[i]];
				}

				return value;
			}

			let value = this.#component[`_${parts[0]}`] ?? this.#component[parts[0]];

			for (let i = 1; i < parts.length && value; i += 1) {
				value = value[parts[i]];
			}

			return value;
		} catch (error) {
			console.warn(`[ExpressionEvaluator] Error accessing property "${path}":`, error.message);

			return EVALUATION_ERROR;
		}
	}

	static isEvaluationError(value) {
		return value === EVALUATION_ERROR;
	}

	static clearCache() {
		functionCache.clear();
	}

	static getCacheSize() {
		return functionCache.size;
	}
}


export {EVALUATION_ERROR};
