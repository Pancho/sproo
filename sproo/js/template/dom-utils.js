import ElementStateManager from './element-state-manager.js';


export default class DOMUtils {
	static isComponent(el) {
		return el.shadowRoot && typeof el.templateLoaded !== 'undefined';
	}

	static isInsideNestedDirective(el, root) {
		let parent = el.parentElement;

		while (parent && parent !== root) {
			if (parent.hasAttribute && (parent.hasAttribute('if') || parent.hasAttribute('for-each'))) {
				return true;
			}

			parent = parent.parentElement;
		}

		return false;
	}

	static findDirectDirectiveChildren(root, selector) {
		const all = root.querySelectorAll ? root.querySelectorAll(selector) : [],
			result = [];

		for (const el of all) {
			if (!DOMUtils.isInsideNestedDirective(el, root)) {
				result.push(el);
			}
		}

		return result;
	}

	static getBindableElements(root, isComponent) {
		const elements = Array.from(root.querySelectorAll ? root.querySelectorAll('*') : [])
			.filter((el) => !isComponent(el));

		if (root.getAttributeNames && !isComponent(root)) {
			elements.unshift(root);
		}

		return elements;
	}

	static parseReferences(root, component) {
		const elements = root.querySelectorAll ? root.querySelectorAll('[ref]') : [];

		for (const el of elements) {
			const refName = el.getAttribute('ref');

			if (refName) {
				component[refName] = el;
			}
		}
	}

	static parseReferencesForItem(root, component, skipNestedDirectives = false) {
		if (root.getAttribute && root.getAttribute('ref')) {
			const refName = root.getAttribute('ref');

			if (refName) {
				component[refName] = root;
			}
		}

		const elements = root.querySelectorAll ? root.querySelectorAll('[ref]') : [];

		for (const el of elements) {
			if (skipNestedDirectives && DOMUtils.isInsideNestedDirective(el, root)) {
				continue;
			}

			const refName = el.getAttribute('ref');

			if (refName) {
				component[refName] = el;
			}
		}
	}

	static clearReferences(root, component) {
		const elements = root.querySelectorAll ? root.querySelectorAll('[ref]') : [];

		for (const el of elements) {
			const refName = el.getAttribute('ref');

			if (refName && component[refName] === el) {
				component[refName] = null;
			}
		}

		if (root.getAttribute && root.getAttribute('ref')) {
			const refName = root.getAttribute('ref');

			if (refName && component[refName] === root) {
				component[refName] = null;
			}
		}
	}

	static cleanupElementData(element) {
		if (!element) {
			return;
		}

		ElementStateManager.clear(element);
	}

	static cleanupElementTree(element, isComponent, disconnectComponents = true) {
		if (!element) {
			return;
		}

		const children = element.querySelectorAll ? Array.from(element.querySelectorAll('*')) : [];

		for (const child of children) {
			DOMUtils.cleanupElementData(child);

			if (disconnectComponents && isComponent(child) && typeof child.disconnectedCallback === 'function') {
				child.disconnectedCallback();
			}
		}

		DOMUtils.cleanupElementData(element);

		if (disconnectComponents && isComponent(element) && typeof element.disconnectedCallback === 'function') {
			element.disconnectedCallback();
		}
	}

	static getParentNode(element) {
		return element.parentElement || element.parentNode;
	}
}
