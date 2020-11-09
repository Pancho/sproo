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
