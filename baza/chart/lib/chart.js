export default class Chart {
	svg = null;
	width = 0;
	height = 0;
	tooltip = null;
	groupRegistry = {};
	ready;
	padding = {
		top: 30,
		right: 30,
		bottom: 30,
		left: 30,
	};

	static textMeasurementsCache = {};

	constructor(svg) {
		this.svg = svg;
		this.ready = new Promise(resolve => {
			setTimeout(() => { // We have to delay picking up the actual width and height, lest we want haggard charts
				this.width = this.svg.width.baseVal.value;
				this.height = this.svg.height.baseVal.value;
				resolve();
			}, 0);
			// }, 50);
		});
	}

	getSeriesMinimums(data) {
		throw new Error('Chart implementation must implement getSeriesMinimums function');
	}

	getSeriesMaximums(data) {
		throw new Error('Chart implementation must implement getSeriesMaximums function');
	}

	getMagnitude(yMin, yMax) {
		throw new Error('Chart implementation must implement getMagnitude function');
	}

	analyzeData(data) {
		const yMinimums = this.getSeriesMinimums(data),
			yMaximums = this.getSeriesMaximums(data);
		let yAxisLabels = [];

		const yMin = Math.min(...yMinimums),
			yMax = Math.max(...yMaximums),
			{atMagnitude, factor} = this.getMagnitude(yMin, yMax);
		let yMaxChart = atMagnitude,
			step = factor !== 0 ? Math.abs(atMagnitude) / factor : 1,
			counter = 0,
			heightCutoff = 0,
			heightAddition = 0,
			yOffset = 0;

		while (yMaxChart < yMax) {
			// yMaxChart = atMagnitude + counter * step;
			// yAxisLabels.push(yMaxChart);
			// counter += 1;
			yMaxChart = atMagnitude + counter * step;
			if (yMaxChart === 0 || yMaxChart > (yMin - step)) {
				yAxisLabels.push(yMaxChart);
			}
			// yAxisLabels.push(yMaxChart);
			counter += 1;
			if (yAxisLabels.length > 8) {
				yAxisLabels = [];
				yMaxChart = atMagnitude;
				counter = 0;
				step *= 2;
			}
		}

		if (atMagnitude !== 0) {
			const diff = yMaxChart - atMagnitude,
				zeroRatio = atMagnitude / diff,
				paintHeight = this.getPaintHeight();
			yOffset = zeroRatio * paintHeight;
			if (Math.abs(yOffset) > Math.abs(this.getPaintHeight())) { // This is here to normalize what "0" is when the whole chart if offset
				yOffset = Math.sign(yOffset) * this.getPaintHeight();
			}
			if (yMin > 0) {
				heightCutoff = Math.abs(yOffset);
			}
			if (yMax < 0) {
				heightAddition = Math.abs(paintHeight * yMaxChart / diff);
			}
		}

		return {
			yAxisLabels: yAxisLabels,
			yMaxChart: Math.max(...yAxisLabels),
			yMinChart: Math.min(...yAxisLabels),
			yOffset: yOffset,
			heightCutoff: heightCutoff,
			heightAddition: heightAddition,
		};
	}

	renderSkeleton(data) {
		const analysis = this.analyzeData(data);

		if (analysis.yAxisLabels.length > 1) {
			analysis.yAxisLabels.forEach((label, index) => {
				const step = index * (this.getPaintHeight() / (analysis.yAxisLabels.length - 1)),
					labelDisplay = this.humanize(label),
					textElement = this.newText(
						labelDisplay,
						this.padding.left - this.predictTextWidth(labelDisplay, 'y-axis-text axis-text') - 3,
						this.height - step - this.padding.bottom + 3,
						{'class': 'y-axis-text axis-text'},
					),
					lineElement = this.newLine(
						this.padding.left,
						this.height - step - this.padding.bottom,
						this.width - this.padding.right,
						this.height - step - this.padding.bottom,
						{'class': 'x-axis'},
					);
				this.appendToGroup('y-axis', textElement);
				this.appendToGroup('y-axis', lineElement);
			});
		}

		return analysis;
	}

	renderData(data) {
		this.ready.then(() => {
			this._renderData(data);
		});
	}

	_renderData(data) {
		throw new Error('Base Chart class does not implement renderData.');
	}

	newElement(tagName, attributes) {
		const newElement = document.createElementNS('http://www.w3.org/2000/svg', tagName);
		Object.entries(attributes).forEach((entry) => newElement.setAttribute(...entry));
		return newElement;
	}

	newLine(x1, y1, x2, y2, attributes) {
		return this.newElement('line', {
			x1: x1,
			y1: y1,
			x2: x2,
			y2: y2,
			...attributes,
		});
	}

	newText(text, x, y, attributes) {
		const textElement = this.newElement('text', {
			x: x,
			y: y,
			...attributes,
		});
		textElement.textContent = text;
		return textElement;
	}

	newRectangle(x, y, width, height, attributes) {
		const rectangleElement = this.newElement('rect', {
			x: x,
			y: y,
			width: width,
			height: height,
			...attributes,
		});
		return rectangleElement;
	}

	newLinearGradient(id, attributes) {
		return this.newElement('linearGradient', {
			id: id,
			...attributes,
		});
	}

	newCircle(x, y, radius, attributes) {
		return this.newElement('circle', {
			cx: x,
			cy: y,
			r: radius,
			...attributes,
		});
	}

	newPolyline(points, attributes) {
		return this.newElement('polyline', {
			points: points,
			...attributes,
		});
	}

	newPolygon(points, attributes) {
		return this.newElement('polygon', {
			points: points,
			...attributes,
		});
	}

	newStop(offset, attributes) {
		return this.newElement('stop', {
			offset: offset,
			...attributes,
		});
	}

	newGroup(groupName, attributes) {
		return this.newElement('g', {
			'id': groupName,
			...attributes,
		});
	}

	appendToGroup(groupName, element, attributes) {
		if (!this.groupRegistry[groupName]) {
			this.groupRegistry[groupName] = this.newGroup(groupName, attributes);
			this.svg.append(this.groupRegistry[groupName]);
		}
		if (!!element) {
			this.groupRegistry[groupName].append(element);
		}
		return this.groupRegistry[groupName];
	}

	emptyGroup(groupName) {
		const group = this.groupRegistry[groupName];
		if (!!group) {
			while (group.lastElementChild) {
				group.removeChild(group.lastElementChild);
			}
		}
	}

	addLinearGradients(gradients) {
		gradients.forEach((gradient, index) => {
			const attributes = !!gradient.vertical ? {
					x1: 0,
					y1: 0,
					x2: 0,
					y2: 1,
				} : {},
				gradientElement = this.newLinearGradient(`series-${index}`, attributes);
			let i = 0, j = gradient.stops - 1 || 1;
			for (; i < j; i += 1) {
				gradientElement.append(this.newStop(`${((100 * i / j).toFixed(2))}%`, {'class': `series-${index}-stop-${i}`}));
			}
			gradientElement.append(this.newStop('100.00%', {'class': `series-${index}-stop-${i}`}));
			this.appendToGroup('gradients', gradientElement);
		});
	}

	setPadding(padding) {
		if (
			!!padding &&
			!!padding.top &&
			!!padding.right &&
			!!padding.bottom &&
			!!padding.left
		) {
			this.padding = padding;
		}
	}

	humanize(value) {
		const prefix = value < 0 ? '-' : '',
			absValue = Math.abs(value),
			mag = this.magnitude(absValue);
		let result = value.toString(),
			modulo = mag % 3, // Every 1000
			displayedValue = value / 10 ** (mag - modulo),
			decimals = `.${displayedValue.toFixed(1).split('.')[1]}`;

		if (decimals === '.0') {
			decimals = '';
		}

		if (mag <= 3) {
			result = absValue;
		} else if (mag > 3 && mag <= 6) {
			result = `${absValue.toString().substr(0, mag - 3)}${decimals}K`;
		} else if (mag > 6 && mag <= 9) {
			result = `${absValue.toString().substr(0, mag - 6)}${decimals}K`;
		} else if (mag > 9 && mag <= 12) {
			result = `${absValue.toString().substr(0, mag - 9)}${decimals}K`;
		} else if (mag > 12 && mag <= 15) {
			result = `${absValue.toString().substr(0, mag - 12)}${decimals}K`;
		} else if (mag > 15 && mag <= 18) {
			result = `${absValue.toString().substr(0, mag - 15)}${decimals}K`;
		} else if (mag > 18 && mag <= 21) {
			result = `${absValue.toString().substr(0, mag - 18)}${decimals}K`;
		} else if (mag > 21 && mag <= 24) {
			result = `${absValue.toString().substr(0, mag - 21)}${decimals}K`;
		} else if (mag > 24 && mag <= 27) {
			result = `${absValue.toString().substr(0, mag - 24)}${decimals}S`;
		}
		// Too large... enjoy
		return `${prefix}${result}`;
	}

	magnitude(value) {
		let mag = 0;
		while (value >= 1) {
			mag += 1;
			value = value / 10;
		}
		return mag;
	}

	roundToMagnitude(value) {
		const absValue = Math.abs(value),
			magnitude = Math.max(2, this.magnitude(absValue) - 1),
			rounding = value < 0 ? Math.ceil : Math.floor;

		return {
			atMagnitude: Math.sign(value) * rounding(absValue / (10 ** magnitude)) * (10 ** magnitude),
			factor: rounding(absValue / (10 ** magnitude)),
		};
	}

	getMeasurementText(measurement) {
		let element = this.svg.querySelector('.measure');

		if (!element) {
			element = this.newText('', 0, 0, {'class': `measure ${measurement}`});
			this.appendToGroup('measure', element);
		}

		return element;
	}

	predictTextWidth(text, measurement) {
		if (typeof text === 'string' && text.trim() === '') {
			return 0;
		}
		return `${text}`.split('').map(letter => {
			const cacheKey = `${letter}${measurement}`;
			let width = Chart.textMeasurementsCache[cacheKey];

			if (!width) {
				const measurementElement = this.getMeasurementText(measurement);
				measurementElement.textContent = letter;
				width = measurementElement.getComputedTextLength();
				Chart.textMeasurementsCache[cacheKey] = width;
			}

			return width;
		}).reduce((width, nextWidth) => width + nextWidth);
	}

	getPaintHeight() {
		return this.height - this.padding.top - this.padding.bottom;
	}

	getPaintWidth() {
		return this.width - this.padding.left - this.padding.right;
	}

	setupTooltip(tooltip, config) {
		this.tooltip = tooltip;
		if (typeof config.tooltip === 'function') {
			this.tooltipCallback = config.tooltip;
		}
	}

	cleanup() {
		this.svg.querySelector('.measure').remove();
	}
}
