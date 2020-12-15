import Guard from '../../../fiu/js/guard.js';

export default class WorkAreaGuard extends Guard {
	async run(router, route) {
		router.testSuccessful = true;
		return true;
	}
}
