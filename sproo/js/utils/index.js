import {uniqueBy} from './array.js';
import {getCookie, removeCookie, setCookie} from './cookie.js';
import CssStatic from './css.js';
import debounce from './debounce.js';
import DeepProxy from './deepproxy.js';
import HtmlStatic from './html.js';
import Loader from './loader.js';
import {choice, randomIntArrayInRange, randomIntegerInRange, randomNumberInRange, shuffle, getRandomInt} from './random.js';
import {slugify, kebabToCamel, toCamelCase, snakeToCamel, camelToKebab} from './text.js';
import uuid from './uuid.js';

export default {
	uniqueBy: uniqueBy,
	getCookie, removeCookie, setCookie,
	CssStatic,
	debounce,
	DeepProxy,
	HtmlStatic,
	Loader,
	choice, randomIntArrayInRange, randomIntegerInRange, randomNumberInRange, shuffle, getRandomInt,
	slugify, kebabToCamel, toCamelCase, snakeToCamel, camelToKebab,
	uuid,
};
