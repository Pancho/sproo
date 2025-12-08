import {EVALUATION_ERROR} from './expression-evaluator.js';


const TEXT_NODE_REGEX = /(\{\{.+?\}\})/u,
	PROPERTY_BINDINGS = {
		'value': (element, value) => {
			if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
				element.value = value ?? '';
			}
		},
		'checked': (element, value) => {
			if (element.tagName === 'INPUT' && (element.type === 'checkbox' || element.type === 'radio')) {
				element.checked = Boolean(value);
			}
		},
		'selected': (element, value) => {
			if (element.tagName === 'OPTION') {
				element.selected = Boolean(value);
			}
		},
		'disabled': (element, value) => {
			element.disabled = Boolean(value);
		},
		'readonly': (element, value) => {
			if (['INPUT', 'TEXTAREA'].includes(element.tagName)) {
				element.readOnly = Boolean(value);
			}
		},
	};


export default class BindingFactory {
	static createInnerHTMLBinding(element, expression) {
		return {
			expression,
			element,
			update: (value) => {
				if (value === EVALUATION_ERROR) {
					element.innerHTML = '';
				} else {
					element.innerHTML = value ?? '';
				}
			},
		};
	}

	static createClassBinding(element, expression, className) {
		return {
			expression,
			element,
			update: (value) => {
				if (value === EVALUATION_ERROR || !value) {
					element.classList.remove(className);
				} else {
					element.classList.add(className);
				}
			},
		};
	}

	static createStyleBinding(element, expression, styleProp) {
		return {
			expression,
			element,
			update: (value) => {
				if (value === EVALUATION_ERROR || value === null || typeof value === 'undefined') {
					element.style[styleProp] = '';
				} else {
					element.style[styleProp] = value;
				}
			},
		};
	}

	static createAttributeBinding(element, expression, attrName) {
		return {
			expression,
			element,
			update: (value) => {
				if (value === EVALUATION_ERROR || value === null || typeof value === 'undefined') {
					element.removeAttribute(attrName);

					if (PROPERTY_BINDINGS[attrName]) {
						PROPERTY_BINDINGS[attrName](element, '');
					}
				} else {
					if (PROPERTY_BINDINGS[attrName]) {
						PROPERTY_BINDINGS[attrName](element, value);
					}

					element.setAttribute(attrName, value);
				}
			},
		};
	}

	static createTextBinding(textNode, expression) {
		return {
			expression,
			element: textNode,
			update: (value) => {
				if (value === EVALUATION_ERROR) {
					textNode.textContent = '';
				} else {
					textNode.textContent = value ?? '';
				}
			},
		};
	}

	static createFromColonAttribute(element, attr) {
		const actualAttr = attr.slice(1),
			expression = element.getAttribute(attr);

		if (actualAttr.toLowerCase() === 'innerhtml') {
			return BindingFactory.createInnerHTMLBinding(element, expression);
		}

		if (actualAttr.startsWith('class.')) {
			const className = actualAttr.substring(6);

			return BindingFactory.createClassBinding(element, expression, className);
		}

		if (actualAttr.startsWith('style.')) {
			const styleProp = actualAttr.substring(6);

			return BindingFactory.createStyleBinding(element, expression, styleProp);
		}

		return BindingFactory.createAttributeBinding(element, expression, actualAttr);
	}

	static parseTextNodes(root, isInsideComponent, isInsideNestedDirective = null) {
		const bindings = [],
			textNodes = [],
			iter = document.createNodeIterator(
				root,
				NodeFilter.SHOW_TEXT,
				{
					acceptNode: (node) => {
						let parent = node.parentElement;

						while (parent && parent !== root) {
							if (isInsideNestedDirective && isInsideNestedDirective(parent, root)) {
								return NodeFilter.FILTER_REJECT;
							}

							if (isInsideComponent(parent)) {
								const shadowRoot = parent.shadowRoot;

								if (shadowRoot && shadowRoot.contains(node)) {
									return NodeFilter.FILTER_REJECT;
								}
							}

							parent = parent.parentElement;
						}

						return NodeFilter.FILTER_ACCEPT;
					},
				},
			);

		let node = iter.nextNode();

		while (node) {
			if (node.textContent.includes('{{')) {
				textNodes.push(node);
			}

			node = iter.nextNode();
		}

		for (const textNode of textNodes) {
			const parts = textNode.textContent.split(TEXT_NODE_REGEX).filter(Boolean),
				replacements = [];

			for (const part of parts) {
				if (part.startsWith('{{') && part.endsWith('}}')) {
					const expression = part.slice(2, -2).trim(),
						newTextNode = document.createTextNode('');

					bindings.push(BindingFactory.createTextBinding(newTextNode, expression));
					replacements.push(newTextNode);
				} else {
					replacements.push(document.createTextNode(part));
				}
			}

			textNode.replaceWith(...replacements);
		}

		return bindings;
	}

	static clearBinding(binding) {
		binding.update = null;
		binding.element = null;
	}

	static clearBindings(bindings) {
		for (const binding of bindings) {
			BindingFactory.clearBinding(binding);
		}
	}

	static filterDisconnectedBindings(bindings) {
		return bindings.filter((binding) => {
			if (binding.element && !binding.element.isConnected) {
				BindingFactory.clearBinding(binding);

				return false;
			}

			return true;
		});
	}

	static updateBindings(bindings, evaluator, context) {
		for (const binding of bindings) {
			if (binding.element && binding.update) {
				const value = evaluator.evaluate(binding.expression, context);

				binding.update(value);
			}
		}
	}
}
