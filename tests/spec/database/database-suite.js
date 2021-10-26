import {Suite} from '../../api/suite.js';
import * as database from './database.js';

export class DatabaseSuite extends Suite {
	constructor() {
		super('Database Suite', database);
	}
}
