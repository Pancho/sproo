import DOMUtils from './dom-utils.js';


export default class DirectiveParser {
	static parseIfDirective(element) {
		const condition = element.getAttribute('if'),
			parentNode = DOMUtils.getParentNode(element);

		if (!parentNode) {
			return null;
		}

		const placeholder = document.createComment('if'),
			childTemplate = document.importNode(element, true);

		childTemplate.removeAttribute('if');
		parentNode.insertBefore(placeholder, element);
		element.remove();

		return {
			type: 'if',
			expression: condition,
			placeholder,
			template: childTemplate,
		};
	}

	static parseForEachDirective(element) {
		const forExpr = element.getAttribute('for-each'),
			keyExpr = element.getAttribute('key'),
			parentNode = DOMUtils.getParentNode(element);

		if (!parentNode) {
			return null;
		}

		const [itemName, itemsExpr] = forExpr.split(' in ').map((s) => s.trim()),
			placeholder = document.createComment('for-each'),
			childTemplate = document.importNode(element, true);

		childTemplate.removeAttribute('for-each');

		if (keyExpr) {
			childTemplate.removeAttribute('key');
		}

		parentNode.insertBefore(placeholder, element);
		element.remove();

		return {
			type: 'for-each',
			expression: itemsExpr,
			itemName,
			keyExpression: keyExpr || null,
			placeholder,
			template: childTemplate,
		};
	}

	static findIfDirectives(root) {
		return DOMUtils.findDirectDirectiveChildren(root, '[if]');
	}

	static findForEachDirectives(root) {
		return DOMUtils.findDirectDirectiveChildren(root, '[for-each]');
	}
}
