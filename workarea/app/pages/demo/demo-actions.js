export class DemoTestXAction {
	slice = 'clicks/x'
	ev;

	constructor(ev) {
		this.ev = ev;
	}

	reducer(currentState) {
		currentState.x = this.ev.screenX;
	}
}

export class DemoTestYAction {
	slice = 'clicks/y'
	ev;

	constructor(ev) {
		this.ev = ev;
	}

	reducer(currentState) {
		currentState.y = this.ev.screenY;
	}
}