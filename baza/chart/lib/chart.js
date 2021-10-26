export default class Chart {
	static textMeasurementsCache = {};
	svg = null;
	width = 0;
	height = 0;
	tooltip = null;
	groupRegistry = {};
	padding = {
		top: 30,
		right: 30,
		bottom: 30,
		left: 30,
	};

	constructor(svg) {
		this.svg = svg;
		const rect = this.svg.getBoundingClientRect();

		this.width = rect.width;
		this.height = rect.height;
	}

	static getSeriesMinimums() {
		throw new Error('Chart implementation must implement getSeriesMinimums function');
	}

	static getSeriesMaximums() {
		throw new Error('Chart implementation must implement getSeriesMaximums function');
	}

	static getMagnitude() {
		throw new Error('Chart implementation must implement getMagnitude function');
	}

	analyzeData(data) {
		const yMinimums = this.constructor.getSeriesMinimums(data),
			yMaximums = this.constructor.getSeriesMaximums(data),
			yMin = Math.min(...yMinimums),
			yMax = Math.max(...yMaximums),
			{atMagnitude, factor} = this.constructor.getMagnitude(yMin, yMax);
		let yAxisLabels = [],
			yMaxChart = atMagnitude,
			step = factor === 0 ? 1 : Math.abs(atMagnitude) / factor,
			counter = 0,
			heightCutoff = 0,
			heightAddition = 0,
			yOffset = 0;

		while (yMaxChart < yMax) {
			yMaxChart = atMagnitude + counter * step;

			if (yMaxChart === 0 || yMaxChart > yMin - step) {
				yAxisLabels.push(yMaxChart);
			}

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

			// This is here to normalize what "0" is when the whole chart if offset
			if (Math.abs(yOffset) > Math.abs(this.getPaintHeight())) {
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
					textElement = Chart.newText(
						labelDisplay,
						this.padding.left - this.predictTextWidth(labelDisplay, 'y-axis-text axis-text') - 3,
						this.height - step - this.padding.bottom + 3,
						{'class': 'y-axis-text axis-text'},
					),
					lineElement = Chart.newLine(
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
		// This.ready.then(() => {
		this.internalRenderData(data);
		// });
	}

	internalRenderData(data) {
		throw new Error(`Base Chart class does not implement renderData [${ this }]{${ data }`);
	}

	static newElement(tagName, attributes) {
		const newElement = document.createElementNS('http://www.w3.org/2000/svg', tagName);

		Object.entries(attributes).forEach((entry) => newElement.setAttribute(...entry));

		return newElement;
	}

	static newLine(x1, y1, x2, y2, attributes) {
		return Chart.newElement('line', {
			x1: x1,
			y1: y1,
			x2: x2,
			y2: y2,
			...attributes,
		});
	}

	static newText(text, x, y, attributes) {
		const textElement = Chart.newElement('text', {
			x: x,
			y: y,
			...attributes,
		});

		textElement.textContent = text;

		return textElement;
	}

	static newRectangle(x, y, width, height, attributes) {
		return Chart.newElement('rect', {
			x: x,
			y: y,
			width: width,
			height: height,
			...attributes,
		});
	}

	static newLinearGradient(id, attributes) {
		return Chart.newElement('linearGradient', {
			id: id,
			...attributes,
		});
	}

	static newCircle(x, y, radius, attributes) {
		return Chart.newElement('circle', {
			cx: x,
			cy: y,
			r: radius,
			...attributes,
		});
	}

	static newPolyline(points, attributes) {
		return Chart.newElement('polyline', {
			points: points,
			...attributes,
		});
	}

	static newPolygon(points, attributes) {
		return Chart.newElement('polygon', {
			points: points,
			...attributes,
		});
	}

	static newStop(offset, attributes) {
		return Chart.newElement('stop', {
			offset: offset,
			...attributes,
		});
	}

	static newGroup(groupName, attributes) {
		return Chart.newElement('g', {
			'id': groupName,
			...attributes,
		});
	}

	appendToGroup(groupName, element, attributes) {
		if (!this.groupRegistry[groupName]) {
			this.groupRegistry[groupName] = Chart.newGroup(groupName, attributes);
			this.svg.append(this.groupRegistry[groupName]);
		}

		if (element) {
			this.groupRegistry[groupName].append(element);
		}

		return this.groupRegistry[groupName];
	}

	emptyGroup(groupName) {
		const group = this.groupRegistry[groupName];

		if (group) {
			while (group.lastElementChild) {
				group.removeChild(group.lastElementChild);
			}
		}
	}

	addLinearGradients(gradients) {
		gradients.forEach((gradient, index) => {
			const attributes = gradient.vertical ? {
					x1: 0,
					y1: 0,
					x2: 0,
					y2: 1,
				} : {},
				gradientElement = Chart.newLinearGradient(`series-${ index }`, attributes),
				j = gradient.stops - 1 || 1;
			let i = 0;

			for (; i < j; i += 1) {
				gradientElement.append(Chart.newStop(`${ (100 * i / j).toFixed(2) }%`, {'class': `series-${ index }-stop-${ i }`}));
			}

			gradientElement.append(Chart.newStop('100.00%', {'class': `series-${ index }-stop-${ i }`}));
			this.appendToGroup('gradients', gradientElement);
		});
	}

	setPadding(padding) {
		if (
			Boolean(padding) &&
			Boolean(padding.top) &&
			Boolean(padding.right) &&
			Boolean(padding.bottom) &&
			Boolean(padding.left)
		) {
			this.padding = padding;
		}
	}

	humanize(value) {
		const prefix = value < 0 ? '-' : '',
			absValue = Math.abs(value),
			mag = this.constructor.magnitude(absValue),
			modulo = mag % 3,
			displayedValue = value / 10 ** (mag - modulo);
		let result = value.toString(), // Every 1000
			decimals = `.${ displayedValue.toFixed(1).split('.')[1] }`;

		if (decimals === '.0') {
			decimals = '';
		}

		if (mag <= 3) {
			result = absValue;
		} else if (mag > 3 && mag <= 6) {
			result = `${ absValue.toString().substr(0, mag - 3) }${ decimals }K`;
		} else if (mag > 6 && mag <= 9) {
			result = `${ absValue.toString().substr(0, mag - 6) }${ decimals }K`;
		} else if (mag > 9 && mag <= 12) {
			result = `${ absValue.toString().substr(0, mag - 9) }${ decimals }K`;
		} else if (mag > 12 && mag <= 15) {
			result = `${ absValue.toString().substr(0, mag - 12) }${ decimals }K`;
		} else if (mag > 15 && mag <= 18) {
			result = `${ absValue.toString().substr(0, mag - 15) }${ decimals }K`;
		} else if (mag > 18 && mag <= 21) {
			result = `${ absValue.toString().substr(0, mag - 18) }${ decimals }K`;
		} else if (mag > 21 && mag <= 24) {
			result = `${ absValue.toString().substr(0, mag - 21) }${ decimals }K`;
		} else if (mag > 24 && mag <= 27) {
			result = `${ absValue.toString().substr(0, mag - 24) }${ decimals }S`;
		}

		// Too large... enjoy
		return `${ prefix }${ result }`;
	}

	static magnitude(value) {
		let mag = 0,
			workingValue = value;

		while (workingValue >= 1) {
			mag += 1;
			workingValue /= 10;
		}

		return mag;
	}

	static roundToMagnitude(value) {
		const absValue = Math.abs(value),
			magnitude = Math.max(2, Chart.magnitude(absValue) - 1),
			rounding = value < 0 ? Math.ceil : Math.floor;

		return {
			atMagnitude: Math.sign(value) * rounding(absValue / 10 ** magnitude) * 10 ** magnitude,
			factor: rounding(absValue / 10 ** magnitude),
		};
	}

	getMeasurementText(measurement) {
		let element = this.svg.querySelector('.measure');

		if (!element) {
			element = Chart.newText('', 0, 0, {'class': `measure ${ measurement }`});
			this.appendToGroup('measure', element);
		}

		return element;
	}

	predictTextWidth(text, measurement) {
		if (typeof text === 'string' && text.trim() === '') {
			return 0;
		}

		return `${ text }`.split('').map((letter) => {
			const cacheKey = `${ letter }${ measurement }`;
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
		if (typeof config.tooltip === 'function') {
			this.tooltip = tooltip;
			this.tooltipCallback = config.tooltip;
		}
	}

	cleanup() {
		this.svg.querySelector('.measure').remove();
	}
}
