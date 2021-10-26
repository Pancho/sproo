import Guard from '../../../fiu/js/guard.js';

export default class WorkAreaGuard extends Guard {
	async guard() {
		const result = await new Promise((resolve) => {
			resolve(true);
		});

		this.router.testSuccessful = 'befefeae-765a-4987-a676-21b8eafa59a9';

		return result;
	}
}
