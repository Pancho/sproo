import {Suite} from '../../api/suite.js';
import * as stateManagement from './state-management.js';

export class StateManagementSuite extends Suite {
	constructor() {
		super('State Management Suite', stateManagement);
	}
}
