import { Suite } from '../../api/suite.js';
import { MavorSlugifyNonASCIICharactersTest, MavorSlugifyTest, MavorSlugifyUnknownCharacterTest } from './mavor-slugify.js';

export class MavorSuite extends Suite {
	constructor() {
		super('Mavor Suite');
		this.registerTest(new MavorSlugifyTest());
		this.registerTest(new MavorSlugifyNonASCIICharactersTest());
		this.registerTest(new MavorSlugifyUnknownCharacterTest());
	}
}
