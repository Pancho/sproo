import ExpressionEvaluator, {EVALUATION_ERROR} from './template/expression-evaluator.js';
import BindingFactory from './template/binding-factory.js';
import EventHandlerParser from './template/event-handler-parser.js';
import DOMUtils from './template/dom-utils.js';
import DirectiveParser from './template/directive-parser.js';
import ChildComponentUpdater from './template/child-component-updater.js';
import ElementStateManager from './template/element-state-manager.js';


export default class TemplateFragment {
	#component;
	#template;
	#placeholder;
	#rendered;
	#bindings;
	#childFragments;
	#parentContext;
	#type;
	#expression;
	#itemName;
	#keyExpression;
	#renderedItems;
	#renderedItemsByKey;
	#parsed;
	#evaluator;
	#childUpdater;

	constructor(component, template, options = {}) {
		this.#component = component;
		this.#template = template;
		this.#type = options.type || 'root';
		this.#expression = options.expression || null;
		this.#itemName = options.itemName || null;
		this.#keyExpression = options.keyExpression || null;
		this.#placeholder = options.placeholder || null;
		this.#parentContext = options.parentContext || {};
		this.#rendered = null;
		this.#bindings = [];
		this.#childFragments = [];
		this.#renderedItems = [];
		this.#renderedItemsByKey = new Map();
		this.#parsed = false;
		this.#evaluator = new ExpressionEvaluator(component);
		this.#childUpdater = new ChildComponentUpdater(this.#evaluator);
	}

	parse() {
		if (this.#parsed) {
			return;
		}

		this.#parsed = true;

		if (this.#type === 'root') {
			this.#parseContent(this.#template);
		}
	}

	#parseContent(root) {
		const ifElements = DirectiveParser.findIfDirectives(root),
			forEachElements = DirectiveParser.findForEachDirectives(root);

		for (const el of ifElements) {
			const directive = DirectiveParser.parseIfDirective(el);

			if (directive) {
				const childFragment = new TemplateFragment(this.#component, directive.template, {
					type: directive.type,
					expression: directive.expression,
					placeholder: directive.placeholder,
					parentContext: this.#parentContext,
				});

				this.#childFragments.push(childFragment);
			}
		}

		for (const el of forEachElements) {
			const directive = DirectiveParser.parseForEachDirective(el);

			if (directive) {
				const childFragment = new TemplateFragment(this.#component, directive.template, {
					type: directive.type,
					expression: directive.expression,
					itemName: directive.itemName,
					keyExpression: directive.keyExpression,
					placeholder: directive.placeholder,
					parentContext: this.#parentContext,
				});

				this.#childFragments.push(childFragment);
			}
		}

		this.#parseBindings(root);
		EventHandlerParser.parse(root, this.#component, this.#parentContext);
		DOMUtils.parseReferences(root, this.#component);
	}

	#parseBindings(root) {
		const elements = DOMUtils.getBindableElements(root, DOMUtils.isComponent);

		for (const el of elements) {
			const attrs = el.getAttributeNames ? el.getAttributeNames() : [];

			for (const attr of attrs) {
				if (attr.startsWith(':')) {
					const binding = BindingFactory.createFromColonAttribute(el, attr);

					this.#bindings.push(binding);
				}
			}
		}

		const textBindings = BindingFactory.parseTextNodes(root, DOMUtils.isComponent);

		this.#bindings.push(...textBindings);
	}

	update(context = {}) {
		const mergedContext = {...this.#parentContext, ...context};

		switch (this.#type) {
			case 'root':
				this.#updateRoot(mergedContext);

				break;
			case 'if':
				this.#updateIf(mergedContext);

				break;
			case 'for-each':
				this.#updateForEach(mergedContext);

				break;
		}
	}

	#updateRoot(context) {
		this.#bindings = BindingFactory.filterDisconnectedBindings(this.#bindings);
		BindingFactory.updateBindings(this.#bindings, this.#evaluator, context);

		for (const child of this.#childFragments) {
			child.setParentContext(context);
			child.update(context);
		}

		this.#childUpdater.updateChildComponents(this.#template, context);
	}

	#updateIf(context) {
		const shouldShow = this.#evaluator.evaluate(this.#expression, context),
			show = !ExpressionEvaluator.isEvaluationError(shouldShow) && Boolean(shouldShow);

		if (show && !this.#rendered) {
			const clone = document.importNode(this.#template, true),
				parentNode = DOMUtils.getParentNode(this.#placeholder);

			parentNode.insertBefore(clone, this.#placeholder);
			this.#rendered = clone;

			this.#parseContent(clone);
			BindingFactory.updateBindings(this.#bindings, this.#evaluator, context);

			for (const child of this.#childFragments) {
				child.setParentContext(context);
				child.update(context);
			}

			this.#childUpdater.updateChildComponents(this.#rendered, context);
		} else if (!show && this.#rendered) {
			this.#cleanupRendered();
			this.#rendered.remove();
			this.#rendered = null;
		} else if (show && this.#rendered) {
			this.#bindings = BindingFactory.filterDisconnectedBindings(this.#bindings);
			BindingFactory.updateBindings(this.#bindings, this.#evaluator, context);

			for (const child of this.#childFragments) {
				child.setParentContext(context);
				child.update(context);
			}

			this.#childUpdater.updateChildComponents(this.#rendered, context);
		}
	}

	#updateForEach(context) {
		const items = this.#evaluator.evaluate(this.#expression, context);

		if (!Array.isArray(items)) {
			this.#cleanupForEachItems();

			return;
		}

		if (this.#keyExpression) {
			this.#updateForEachKeyed(items, context);
		} else {
			this.#updateForEachNonKeyed(items, context);
		}
	}

	#updateForEachNonKeyed(items, context) {
		const existingCount = this.#renderedItems.length,
			newCount = items.length;

		if (existingCount === newCount && newCount > 0) {
			this.#updateExistingForEachItems(items, context);
		} else {
			this.#rebuildForEachItems(items, context);
		}
	}

	#updateForEachKeyed(items, context) {
		const parentNode = DOMUtils.getParentNode(this.#placeholder),
			newKeys = [],
			newKeyToItem = new Map(),
			newKeyToIndex = new Map();

		for (let i = 0; i < items.length; i += 1) {
			const item = items[i],
				itemContext = {...context, [this.#itemName]: item, index: i},
				key = this.#evaluator.evaluate(this.#keyExpression, itemContext);

			newKeys.push(key);
			newKeyToItem.set(key, item);
			newKeyToIndex.set(key, i);
		}

		const oldKeys = new Set(this.#renderedItemsByKey.keys()),
			newKeySet = new Set(newKeys),
			toRemove = [],
			toUpdate = [],
			toCreate = [];

		for (const key of oldKeys) {
			if (!newKeySet.has(key)) {
				toRemove.push(key);
			}
		}

		for (const key of newKeys) {
			if (oldKeys.has(key)) {
				toUpdate.push(key);
			} else {
				toCreate.push(key);
			}
		}

		for (const key of toRemove) {
			const el = this.#renderedItemsByKey.get(key);

			this.#cleanupSingleItem(el);
			el.remove();
			this.#renderedItemsByKey.delete(key);
		}

		for (const key of toCreate) {
			const item = newKeyToItem.get(key),
				index = newKeyToIndex.get(key),
				itemContext = {...context, [this.#itemName]: item, index},
				el = this.#createForEachItem(item, itemContext);

			ElementStateManager.setKey(el, key);
			this.#renderedItemsByKey.set(key, el);
		}

		const newRenderedItems = [];

		for (let i = 0; i < newKeys.length; i += 1) {
			const key = newKeys[i],
				el = this.#renderedItemsByKey.get(key),
				item = newKeyToItem.get(key),
				itemContext = {...context, [this.#itemName]: item, index: i};

			newRenderedItems.push(el);

			ElementStateManager.setLoopContext(el, itemContext);

			if (toUpdate.includes(key)) {
				this.#updateSingleItem(el, itemContext);
			}
		}

		for (let i = 0; i < newRenderedItems.length; i += 1) {
			const el = newRenderedItems[i],
				nextSibling = i < newRenderedItems.length - 1 ? newRenderedItems[i + 1] : this.#placeholder;

			if (el.nextSibling !== nextSibling) {
				parentNode.insertBefore(el, nextSibling);
			}
		}

		this.#renderedItems = newRenderedItems;
	}

	#createForEachItem(item, itemContext) {
		const clone = document.importNode(this.#template, true);

		ElementStateManager.setForEachItem(clone, true);
		ElementStateManager.setLoopContext(clone, itemContext);

		const parentNode = DOMUtils.getParentNode(this.#placeholder);

		parentNode.insertBefore(clone, this.#placeholder);

		const itemBindings = this.#parseBindingsForItem(clone);

		ElementStateManager.setBindings(clone, itemBindings);

		EventHandlerParser.parse(clone, this.#component, itemContext, true);
		DOMUtils.parseReferencesForItem(clone, this.#component, true);

		const childFragments = this.#createChildFragmentsForItem(clone, itemContext);

		ElementStateManager.setChildFragments(clone, childFragments);

		BindingFactory.updateBindings(itemBindings, this.#evaluator, itemContext);

		for (const child of childFragments) {
			child.update(itemContext);
		}

		this.#childUpdater.updateChildComponents(clone, itemContext);

		return clone;
	}

	#updateSingleItem(el, itemContext) {
		const itemBindings = ElementStateManager.getBindings(el) || [];

		for (const binding of itemBindings) {
			if (binding.element && binding.element.isConnected && binding.update) {
				const value = this.#evaluator.evaluate(binding.expression, itemContext);

				binding.update(value);
			}
		}

		const childFragments = ElementStateManager.getChildFragments(el) || [];

		for (const child of childFragments) {
			child.setParentContext(itemContext);
			child.update(itemContext);
		}

		this.#childUpdater.updateChildComponents(el, itemContext);
	}

	#cleanupSingleItem(el) {
		const childFragments = ElementStateManager.getChildFragments(el) || [];

		for (const child of childFragments) {
			child.cleanup();
		}

		BindingFactory.clearBindings(ElementStateManager.getBindings(el) || []);
		EventHandlerParser.cleanupElement(el);
		DOMUtils.cleanupElementData(el);
		DOMUtils.cleanupElementTree(el, DOMUtils.isComponent);
	}

	#updateExistingForEachItems(items, context) {
		for (let i = 0; i < items.length; i += 1) {
			const el = this.#renderedItems[i],
				item = items[i],
				itemContext = {
					...context,
					[this.#itemName]: item,
					index: i,
				};

			ElementStateManager.setLoopContext(el, itemContext);

			const itemBindings = ElementStateManager.getBindings(el) || [];

			for (const binding of itemBindings) {
				if (binding.element && binding.element.isConnected && binding.update) {
					const value = this.#evaluator.evaluate(binding.expression, itemContext);

					binding.update(value);
				}
			}

			const childFragments = ElementStateManager.getChildFragments(el) || [];

			for (const child of childFragments) {
				child.setParentContext(itemContext);
				child.update(itemContext);
			}

			this.#childUpdater.updateChildComponents(el, itemContext);
		}
	}

	#rebuildForEachItems(items, context) {
		this.#cleanupForEachItems();

		for (let i = 0; i < items.length; i += 1) {
			const clone = document.importNode(this.#template, true),
				item = items[i],
				itemContext = {
					...context,
					[this.#itemName]: item,
					index: i,
				};

			ElementStateManager.setForEachItem(clone, true);
			ElementStateManager.setLoopContext(clone, itemContext);

			const parentNode = DOMUtils.getParentNode(this.#placeholder);

			parentNode.insertBefore(clone, this.#placeholder);
			this.#renderedItems.push(clone);

			const itemBindings = this.#parseBindingsForItem(clone);

			ElementStateManager.setBindings(clone, itemBindings);

			EventHandlerParser.parse(clone, this.#component, itemContext, true);
			DOMUtils.parseReferencesForItem(clone, this.#component, true);

			const childFragments = this.#createChildFragmentsForItem(clone, itemContext);

			ElementStateManager.setChildFragments(clone, childFragments);

			BindingFactory.updateBindings(itemBindings, this.#evaluator, itemContext);

			for (const child of childFragments) {
				child.update(itemContext);
			}

			this.#childUpdater.updateChildComponents(clone, itemContext);
		}
	}

	#parseBindingsForItem(root) {
		const bindings = [],
			elements = DOMUtils.getBindableElements(root, DOMUtils.isComponent);

		for (const el of elements) {
			if (DOMUtils.isInsideNestedDirective(el, root)) {
				continue;
			}

			const attrs = el.getAttributeNames ? el.getAttributeNames() : [];

			for (const attr of attrs) {
				if (attr.startsWith(':')) {
					const binding = BindingFactory.createFromColonAttribute(el, attr);

					bindings.push(binding);
				}
			}
		}

		const isInsideNestedDirective = (parent, rootEl) => {
			return parent.hasAttribute && (parent.hasAttribute('if') || parent.hasAttribute('for-each'));
		};

		const textBindings = BindingFactory.parseTextNodes(root, DOMUtils.isComponent, isInsideNestedDirective);

		bindings.push(...textBindings);

		return bindings;
	}

	#createChildFragmentsForItem(root, context) {
		const fragments = [],
			ifElements = DirectiveParser.findIfDirectives(root),
			forEachElements = DirectiveParser.findForEachDirectives(root);

		for (const el of ifElements) {
			const directive = DirectiveParser.parseIfDirective(el);

			if (directive) {
				const childFragment = new TemplateFragment(this.#component, directive.template, {
					type: directive.type,
					expression: directive.expression,
					placeholder: directive.placeholder,
					parentContext: context,
				});

				fragments.push(childFragment);
			}
		}

		for (const el of forEachElements) {
			const directive = DirectiveParser.parseForEachDirective(el);

			if (directive) {
				const childFragment = new TemplateFragment(this.#component, directive.template, {
					type: directive.type,
					expression: directive.expression,
					itemName: directive.itemName,
					keyExpression: directive.keyExpression,
					placeholder: directive.placeholder,
					parentContext: context,
				});

				fragments.push(childFragment);
			}
		}

		return fragments;
	}

	#cleanupForEachItems() {
		for (const el of this.#renderedItems) {
			this.#cleanupSingleItem(el);
			el.remove();
		}

		this.#renderedItems = [];
		this.#renderedItemsByKey.clear();
	}

	#cleanupRendered() {
		if (!this.#rendered) {
			return;
		}

		DOMUtils.clearReferences(this.#rendered, this.#component);

		for (const child of this.#childFragments) {
			child.cleanup();
		}

		this.#childFragments = [];
		BindingFactory.clearBindings(this.#bindings);
		this.#bindings = [];

		EventHandlerParser.cleanupTree(this.#rendered);
		DOMUtils.cleanupElementTree(this.#rendered, DOMUtils.isComponent);
	}

	setParentContext(context) {
		this.#parentContext = context;
	}

	cleanup() {
		this.#cleanupForEachItems();
		this.#cleanupRendered();

		for (const child of this.#childFragments) {
			child.cleanup();
		}

		this.#childFragments = [];
		BindingFactory.clearBindings(this.#bindings);
		this.#bindings = [];

		this.#template = null;
		this.#placeholder = null;
		this.#rendered = null;
		this.#component = null;
		this.#parentContext = {};
		this.#evaluator = null;
		this.#childUpdater = null;
	}

	getPlaceholder() {
		return this.#placeholder;
	}

	isRendered() {
		if (this.#type === 'for-each') {
			return this.#renderedItems.length > 0;
		}

		return this.#rendered !== null;
	}
}


export {EVALUATION_ERROR};
