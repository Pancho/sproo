import Chart from './chart.js';

export default class LineChart extends Chart {
	static getSeriesMinimums(data) {
		const result = [];

		data.forEach((series) => {
			result.push(Math.min(...series.data.map((entry) => Boolean(entry) && entry[1])));
		});

		return result;
	}

	static getSeriesMaximums(data) {
		const result = [];

		data.forEach((series) => {
			result.push(Math.max(...series.data.map((entry) => Boolean(entry) && entry[1])));
		});

		return result;
	}

	static getMagnitude(yMin) {
		return this.roundToMagnitude(yMin);
	}

	internalRenderData(data) {
		const analysis = this.renderSkeleton(data),
			markers = {};

		// We'll append the group first, so the circles don't stay  on the top
		// The issue is the hover effect and in svg world, the first element is below the latter
		this.appendToGroup('circles');

		data.forEach((series, seriesIndex) => {
			const spaceWidth = this.getPaintWidth() / series.data.length,
				elementWidth = spaceWidth / data.length,
				labelTextLength = Math.max(
					...series.data.map((entry) => this.predictTextWidth(entry[1], 'x-axis-text axis-text')),
				),
				labelPeriodicity = spaceWidth > labelTextLength ? 1 : Math.ceil(labelTextLength / spaceWidth),
				points = [];

			series.data.forEach((element, index) => {
				const height = element[1] ? this.getPaintHeight() * (element[1] / (analysis.yMaxChart - analysis.yMinChart)) : 0,
					xCoord = this.padding.left + index * (data.length * elementWidth) + spaceWidth / 2,
					yCoord = this.height - this.padding.bottom - height -
						analysis.heightAddition + analysis.yOffset + analysis.heightCutoff;

				if (!markers[index]) {
					markers[index] = [];
				}

				markers[index].push({
					yCoord: yCoord,
					element: element,
					series: seriesIndex,
				});

				points.push([
					xCoord,
					yCoord,
				]);

				if (seriesIndex === 0 && index % labelPeriodicity === 0) {
					const textElement = Chart.newText(
							element[0],
							xCoord - this.predictTextWidth(element[0]) / 2,
							this.height - this.padding.bottom + 20,
							{'class': 'x-axis-text axis-text'},
						),
						lineElement = Chart.newLine(
							xCoord,
							this.height - this.padding.bottom,
							xCoord,
							this.height - this.padding.bottom + 10,
							{'class': 'x-axis'},
						);

					this.appendToGroup('x-axis', textElement);
					this.appendToGroup('x-axis', lineElement);
				}
			});
			this.appendToGroup('chart', Chart.newPolyline(
				points.map((elm) => elm.join(',')).join(' '),
				{'class': `line series series-${ seriesIndex }`},
			));
		});

		Object.values(markers).forEach((values, index) => {
			const spacesCount = Object.keys(markers).length,
				spaceWidth = this.getPaintWidth() / spacesCount;
			let marker = {};

			if (data.length > 1) {
				const midpoints = [],
					heights = [],
					sortedValues = values.sort((a, b) => a.yCoord - b.yCoord),
					heightValues = sortedValues.map((entry) => entry.yCoord);
				let prevHeight = this.padding.top;

				heightValues.slice(1).reduce((prev, next) => {
					midpoints.push((prev + next) / 2);

					return next;
				}, heightValues[0]);
				midpoints.push(this.getPaintHeight() + this.padding.top);

				midpoints.forEach((height, midpointIndex) => {
					heights.push({
						start: prevHeight,
						stop: height,
						blob: sortedValues[midpointIndex],
					});
					prevHeight = height;
				});

				heights.forEach((height) => {
					marker = Chart.newRectangle(
						this.padding.left + index * spaceWidth,
						height.start,
						spaceWidth,
						height.stop - height.start,
						{'class': 'line-marker'},
					);

					marker.circles = [
						Chart.newCircle(
							this.padding.left + index * spaceWidth + spaceWidth / 2,
							height.blob.yCoord,
							10,
							{'class': `line-marker-outer line-marker-circle line-marker-${ height.blob.series }`},
						),
						Chart.newCircle(
							this.padding.left + index * spaceWidth + spaceWidth / 2,
							height.blob.yCoord,
							5,
							{'class': `line-marker-border line-marker-circle line-marker-${ height.blob.series }`},
						),
						Chart.newCircle(
							this.padding.left + index * spaceWidth + spaceWidth / 2,
							height.blob.yCoord,
							4,
							{'class': `line-marker-inner line-marker-circle line-marker-${ height.blob.series }`},
						),
					];

					marker.addEventListener('mouseenter', (ev) => {
						if (this.tooltip) {
							this.tooltip.style.display = 'block';
							this.tooltip.innerHTML = this.tooltipCallback(height.blob.element);
							this.tooltip.style.top = `${ this.padding.top - 20 - this.tooltip.offsetHeight / 2 }px`;
							this.tooltip.style.left = `${ Math.max(
								0,
								Math.min(
									this.width - this.tooltip.offsetWidth,
									this.padding.left + index * spaceWidth - this.tooltip.offsetWidth / 2 + spaceWidth / 2,
								),
							) }px`;
						}

						this.emptyGroup('circles');
						ev.target.circles.forEach((circle) => this.appendToGroup('circles', circle));
					});
					marker.addEventListener('mouseleave', (ev) => {
						if (this.tooltip) {
							this.tooltip.style.display = 'none';
						}

						ev.target.circles.forEach((circle) => Boolean(circle.parentElement) && circle.parentElement.removeChild(circle));
					});

					this.appendToGroup('chart', marker);
				});
			} else {
				marker = Chart.newRectangle(
					this.padding.left + index * spaceWidth,
					this.padding.top,
					spaceWidth,
					this.getPaintHeight(),
					{'class': 'line-marker'},
				);

				marker.circles = [
					Chart.newCircle(
						this.padding.left + index * spaceWidth + spaceWidth / 2,
						values[0].yCoord,
						10,
						{'class': 'line-marker-outer line-marker-circle line-marker-0'},
					),
					Chart.newCircle(
						this.padding.left + index * spaceWidth + spaceWidth / 2,
						values[0].yCoord,
						5,
						{'class': 'line-marker-border line-marker-circle line-marker-0'},
					),
					Chart.newCircle(
						this.padding.left + index * spaceWidth + spaceWidth / 2,
						values[0].yCoord,
						4,
						{'class': 'line-marker-inner line-marker-circle line-marker-0'},
					),
				];

				marker.addEventListener('mouseenter', (ev) => {
					if (this.tooltip) {
						this.tooltip.style.display = 'block';
						this.tooltip.innerHTML = this.tooltipCallback(values[0].element);
						this.tooltip.style.top = `${ this.padding.top - 20 - this.tooltip.offsetHeight / 2 }px`;
						this.tooltip.style.left = `${ Math.max(
							0,
							Math.min(
								this.width - this.tooltip.offsetWidth,
								this.padding.left + index * (data.length * spaceWidth + 1) +
								values[0].series * spaceWidth - this.tooltip.offsetWidth / 2 + spaceWidth / 2
							)
						) }px`;
					}

					this.emptyGroup('circles');
					ev.target.circles.forEach((circle) => this.appendToGroup('circles', circle));
				});
				marker.addEventListener('mouseleave', (ev) => {
					if (this.tooltip) {
						this.tooltip.style.display = 'none';
					}

					ev.target.circles.forEach((circle) => Boolean(circle.parentElement) && circle.parentElement.removeChild(circle));
				});
				this.appendToGroup('chart', marker);
			}
		});
	}
}
