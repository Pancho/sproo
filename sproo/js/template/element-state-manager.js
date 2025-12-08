const elementState = new WeakMap();


export default class ElementStateManager {
	static get(element) {
		return elementState.get(element);
	}

	static set(element, state) {
		const existing = elementState.get(element) || {};

		elementState.set(element, {...existing, ...state});
	}

	static has(element) {
		return elementState.has(element);
	}

	static clear(element) {
		elementState.delete(element);
	}

	static getProperty(element, property) {
		const state = elementState.get(element);

		return state ? state[property] : undefined;
	}

	static setProperty(element, property, value) {
		const state = elementState.get(element) || {};

		state[property] = value;
		elementState.set(element, state);
	}

	static clearProperty(element, property) {
		const state = elementState.get(element);

		if (state) {
			delete state[property];
		}
	}

	// Convenience methods for common properties

	static getLoopContext(element) {
		return ElementStateManager.getProperty(element, 'loopContext');
	}

	static setLoopContext(element, context) {
		ElementStateManager.setProperty(element, 'loopContext', context);
	}

	static getEventListeners(element) {
		return ElementStateManager.getProperty(element, 'eventListeners');
	}

	static setEventListener(element, eventName, handler) {
		const listeners = ElementStateManager.getProperty(element, 'eventListeners') || {};

		listeners[eventName] = handler;
		ElementStateManager.setProperty(element, 'eventListeners', listeners);
	}

	static getEventListener(element, eventName) {
		const listeners = ElementStateManager.getProperty(element, 'eventListeners');

		return listeners ? listeners[eventName] : undefined;
	}

	static clearEventListeners(element) {
		ElementStateManager.clearProperty(element, 'eventListeners');
	}

	static getBindings(element) {
		return ElementStateManager.getProperty(element, 'bindings');
	}

	static setBindings(element, bindings) {
		ElementStateManager.setProperty(element, 'bindings', bindings);
	}

	static getChildFragments(element) {
		return ElementStateManager.getProperty(element, 'childFragments');
	}

	static setChildFragments(element, fragments) {
		ElementStateManager.setProperty(element, 'childFragments', fragments);
	}

	static isForEachItem(element) {
		return ElementStateManager.getProperty(element, 'forEachItem') === true;
	}

	static setForEachItem(element, value) {
		ElementStateManager.setProperty(element, 'forEachItem', value);
	}

	static getKey(element) {
		return ElementStateManager.getProperty(element, 'key');
	}

	static setKey(element, key) {
		ElementStateManager.setProperty(element, 'key', key);
	}
}
