import { Suite } from '../../api/suite.js';
import * as mavor from './mavor.js';

export class MavorSuite extends Suite {
	constructor() {
		super('Mavor Suite', mavor);
	}
}
