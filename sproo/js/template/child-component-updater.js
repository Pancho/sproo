import {kebabToCamel} from '../utils/text.js';
import DOMUtils from './dom-utils.js';


export default class ChildComponentUpdater {
	#evaluator;

	constructor(evaluator) {
		this.#evaluator = evaluator;
	}

	updateChildComponents(root, context) {
		if (!root) {
			return;
		}

		const elements = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];

		for (const el of elements) {
			if (DOMUtils.isComponent(el)) {
				this.#setChildComponentProperties(el, context);
			}
		}
	}

	#setChildComponentProperties(childComponent, context) {
		const attrs = childComponent.getAttributeNames ? childComponent.getAttributeNames() : [];

		for (const attr of attrs) {
			if (!attr.startsWith(':')) {
				continue;
			}

			const propName = kebabToCamel(attr.slice(1)),
				expression = childComponent.getAttribute(attr);

			try {
				const value = this.#evaluator.evaluate(expression, context),
					hasBacking = Object.prototype.hasOwnProperty.call(childComponent, `_${propName}`);

				if (hasBacking) {
					childComponent[`_${propName}`] = value;

					if (childComponent.isConnected && childComponent.templateLoaded) {
						childComponent.templateLoaded.then(() => {
							if (childComponent.isConnected) {
								if (typeof childComponent.update === 'function') {
									childComponent.update({});
								}
							}
						});
					}
				} else {
					childComponent[propName] = value;
				}
			} catch (e) {
				console.error('[ChildComponentUpdater] Failed to set child property:', propName, e);
			}
		}
	}
}
