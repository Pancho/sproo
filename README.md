# Sproo



[DEBUG #parseContent] {type: 'root', ifCount: 15, forEachCount: 0, ifConditions: Array(15), componentName: 'UniqueComponentClass', …}componentName: "UniqueComponentClass"forEachCount: 0ifConditions: Array(15)0: "showSimple"1: "hideSimple"2: "!showSimple"3: "count > 5"4: "count > 100"5: "truthyString"6: "falsyString"7: "truthyNumber"8: "falsyNumber"9: "truthyArray.length"10: "falsyArray.length"11: "user.isAdmin"12: "showWithBinding"13: "showOuter"14: "showWithEvent"length: 15[[Prototype]]: Array(0)ifCount: 15rootHTML: "\n<!-- Simple boolean if -->\n<div id=\"simple-true\" if=\"showSimple\">Simple True</div>\n<div id=\"simple-false\" if=\"hideSimple\">Simple False</div>\n\n<!-- Negation -->\n<div id=\"negation\" if=\"!showSimple\">Neg"type: "root"[[Prototype]]: Object
template-fragment.js:225 [DEBUG #parseContent AFTER] {childFragments: 15, rootHTMLAfter: '\n\x3C!-- Simple boolean if -->\n\x3C!--if-->\n\x3C!--if-->\n\n<…\x3C!-- If with bindings inside -->\n\x3C!--if-->\n\n\x3C!-- ', hasSimpleFalse: false}childFragments: 15hasSimpleFalse: falserootHTMLAfter: "\n<!-- Simple boolean if -->\n<!--if-->\n<!--if-->\n\n<!-- Negation -->\n<!--if-->\n\n<!-- Expression if -->\n<!--if-->\n<!--if-->\n\n<!-- Truthy/falsy values -->\n<!--if-->\n<!--if-->\n<!--if-->\n<!--if-->\n<!--if-->\n<!--if-->\n\n<!-- Nested property if -->\n<!--if-->\n\n<!-- If with bindings inside -->\n<!--if-->\n\n<!-- "[[Prototype]]: Object
template-fragment.js:610 [DEBUG #updateIf] {expression: 'showSimple', shouldShow: true, show: true, rendered: false, contextKeys: Array(17)}contextKeys: Array(17)0: "showSimple"1: "hideSimple"2: "count"3: "truthyString"4: "falsyString"5: "truthyNumber"6: "falsyNumber"7: "truthyArray"8: "falsyArray"9: "user"10: "showWithBinding"11: "message"12: "value"13: "showOuter"14: "showInner"15: "showWithEvent"16: "clickCount"length: 17[[Prototype]]: Array(0)expression: "showSimple"rendered: falseshouldShow: trueshow: true[[Prototype]]: Object
template-fragment.js:622 Uncaught (in promise) TypeError: Cannot read properties of null (reading 'insertBefore')
    at #updateIf (template-fragment.js:622:36)
    at TemplateFragment.update (template-fragment.js:554:19)
    at #updateRoot (template-fragment.js:594:10)
    at TemplateFragment.update (template-fragment.js:550:21)
    at #updateAllBindings (component.js:331:24)
    at component.js:140:30
#updateIf @ template-fragment.js:622
update @ template-fragment.js:554
#updateRoot @ template-fragment.js:594
update @ template-fragment.js:550
#updateAllBindings @ component.js:331
(anonymous) @ component.js:140
Promise.then
(anonymous) @ component.js:124
Promise.then
(anonymous) @ component.js:103
Component @ component.js:97
IfDirectiveComponent @ if-directive.js:49
UniqueComponentClass @ component-test.js:75
setup @ component-test.js:87
await in setup
run @ test.js:39
(anonymous) @ tests.js:103
template-fragment.js:147 [DEBUG #parseContent] 