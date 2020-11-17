import { Suite } from '../../api/suite.js';
import * as app from './app.js';


export class FiuAppSuite extends Suite {
	constructor() {
		super('Fiu App Suite', app);
	}
}
