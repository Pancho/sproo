import {Suite} from '../../api/suite.js';
import * as component from './component.js';


export class FiuComponentSuite extends Suite {
	constructor() {
		super('Fiu Component Suite', component);
	}
}
