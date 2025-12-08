import ElementStateManager from './element-state-manager.js';


export default class EventHandlerParser {
	static parse(root, component, context = null, skipNestedDirectives = false) {
		const elements = Array.from(root.querySelectorAll ? root.querySelectorAll('*') : []);

		if (root.getAttributeNames) {
			elements.unshift(root);
		}

		for (const el of elements) {
			if (skipNestedDirectives && el !== root && EventHandlerParser.#isInsideNestedDirective(el, root)) {
				continue;
			}

			EventHandlerParser.#parseElement(el, component, context);
		}
	}

	static #parseElement(el, component, context) {
		const attrs = el.getAttributeNames ? el.getAttributeNames() : [];

		for (const attr of attrs) {
			if (!attr.startsWith('@')) {
				continue;
			}

			const eventName = attr.slice(1).trim(),
				handlerName = el.getAttribute(attr);

			if (typeof component[handlerName] !== 'function') {
				continue;
			}

			EventHandlerParser.#removeExistingHandler(el, eventName);

			const handler = EventHandlerParser.#createHandler(el, component, handlerName, context);

			el.addEventListener(eventName, handler);
			ElementStateManager.setEventListener(el, eventName, handler);

			if (context && !ElementStateManager.getLoopContext(el)) {
				ElementStateManager.setLoopContext(el, context);
			}
		}
	}

	static #createHandler(el, component, handlerName, context) {
		return (ev) => {
			let result = null;

			if (context && Object.keys(context).length > 0) {
				result = component[handlerName](ev, context);
			} else {
				const loopContext = ElementStateManager.getLoopContext(el);

				if (loopContext) {
					result = component[handlerName](ev, loopContext);
				} else {
					result = component[handlerName](ev);
				}
			}

			if (result === false) {
				ev.preventDefault();
				ev.stopPropagation();
			}
		};
	}

	static #removeExistingHandler(el, eventName) {
		const existingHandler = ElementStateManager.getEventListener(el, eventName);

		if (existingHandler) {
			el.removeEventListener(eventName, existingHandler);
		}
	}

	static #isInsideNestedDirective(el, root) {
		let parent = el.parentElement;

		while (parent && parent !== root) {
			if (parent.hasAttribute && (parent.hasAttribute('if') || parent.hasAttribute('for-each'))) {
				return true;
			}

			parent = parent.parentElement;
		}

		return false;
	}

	static cleanupElement(element) {
		const listeners = ElementStateManager.getEventListeners(element);

		if (!listeners) {
			return;
		}

		for (const [event, handler] of Object.entries(listeners)) {
			element.removeEventListener(event, handler);
		}

		ElementStateManager.clearEventListeners(element);
	}

	static cleanupTree(root) {
		if (!root) {
			return;
		}

		EventHandlerParser.cleanupElement(root);

		const children = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];

		for (const child of children) {
			EventHandlerParser.cleanupElement(child);
		}
	}
}
