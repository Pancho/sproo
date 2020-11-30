import { Mavor } from '../../../fiu/js/mavor.js';
import { Test } from '../../api/test.js';

export class MavorSlugifyTest extends Test {
	constructor() {
		super('Mavor Slugify Test', 'Slugify works fine', 'Slugify failed to produce the right result');
	}

	async test() {
		return this.assertEquals(Mavor.slugify('Slugify TexT  with extra spaces'), 'slugify-text-with-extra-spaces');
	}
}

export class MavorSlugifyNonASCIICharactersTest extends Test {
	constructor() {
		super('Mavor Slugify Non ASCII Characters Test (čšž)', 'Slugify works fine (čšž -> csz)', 'Slugify failed to produce the right result');
	}

	async test() {
		return this.assertEquals(Mavor.slugify('čšž'), 'csz');
	}
}

export class MavorSlugifyUnknownCharacterTest extends Test {
	constructor() {
		super('Mavor Slugify Unknown Character Test (đ)', 'Slugify works fine (đ does not translate to any character)', 'Slugify failed to produce the right result');
	}

	async test() {
		return this.assertEquals(Mavor.slugify('đ'), '');
	}
}

export class MavorArrayToCSVTest extends Test {
	constructor() {
		super('Mavor Array To CSV Test', 'Array successfully converted to CSV', 'Array did not convert to expected CSV');
	}

	async test() {
		return this.assertEquals(Mavor.arrayToCSV([[1, 2, 3, 4], [5, 6, 7, 8]], '|'), '1|2|3|4\n5|6|7|8');
	}
}

export class MavorJSONToCSVTest extends Test {
	constructor() {
		super('Mavor JSON To CSV Test', 'JSON successfully converted to CSV', 'JSON did not convert to expected CSV');
	}

	async test() {
		return this.assertEquals(Mavor.JSONToCSV([{
			a: 1,
			b: 2,
			c: 3,
		}, {
			a: 4,
			b: 5,
			c: 6,
		}], ['a', 'b'], '×'), 'a×b\n"1"×"2"\n"4"×"5"');
	}
}

export class MavorRunAsyncTest extends Test {
	constructor() {
		super('Mavor Run Async Test', 'Async runs and delivers result', 'Async did not produce results');
	}

	async test() {
		const fun = _ => 'testRunAsync',
			result = await Mavor.runAsync(fun);
		return this.assertEquals(result, 'testRunAsync');
	}
}

export class MavorRoundTest extends Test {
	constructor() {
		super('Mavor Round Test', 'Rounding delivered a correct result', 'Round did not deliver a correct result');
	}

	async test() {
		return this.assertEquals(Mavor.round(Math.PI, 10), 3.1415926536);
	}
}

export class MavorFlattenObjectTest extends Test {
	constructor() {
		super('Mavor Flatten Object Test', 'Object flattened correctly', 'Object did not flatten correctly');
	}

	async test() {
		return this.assertObjectsEquals(Mavor.flattenObject({a: 'b', c: {d: 'e'}}), {a: 'b', 'c.d': 'e'});
	}
}

export class MavorCookiesTest extends Test {
	constructor() {
		super('Mavor (Get, Set, Delete) Cookie Test', 'Cookie removed, added and tested', 'Cookie functions failed');
	}

	async test() {
		const randomNumber = Math.random(),
			cookieName = 'FiuTestCookie';

		Mavor.removeCookie(cookieName);
		Mavor.setCookie(cookieName, randomNumber, 1);

		return this.assertEquals(Mavor.getCookie(cookieName), `${randomNumber}`);
	}
}
