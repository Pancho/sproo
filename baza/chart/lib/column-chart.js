import Chart from './chart.js';

export default class ColumnChart extends Chart {
	getSeriesMinimums(data) {
		const result = [];
		data.forEach(series => {
			result.push(Math.min(...series.data.map(entry => !!entry && entry[1])));
		});
		return result;
	}

	getSeriesMaximums(data) {
		const result = [];
		data.forEach(series => {
			result.push(Math.max(...series.data.map(entry => !!entry && entry[1])));
		});
		return result;
	}

	getMagnitude(yMin, yMax) {
		return this.roundToMagnitude(yMin);
	}

	_renderData(data) {
		const analysis = this.renderSkeleton(data);

		data.forEach((series, seriesIndex) => {
			const spaceWidth = (this.getPaintWidth() - series.data.length) / series.data.length,
				elementWidth = spaceWidth / data.length,
				labelTextLength = Math.max(...series.data.map(entry => this.predictTextWidth(entry[1], 'x-axis-text axis-text'))),
				labelPeriodicity = spaceWidth > labelTextLength ? 1 : Math.ceil(labelTextLength / spaceWidth);
			series.data.forEach((element, index) => {
				const height = !!element[1] ? this.getPaintHeight() * (element[1] / Math.abs(analysis.yMaxChart - analysis.yMinChart)) : 0,
					rectangle = this.newRectangle(
						this.padding.left + index * (data.length * elementWidth + 1) + (seriesIndex * elementWidth),
						this.height - this.padding.bottom - Math.max(height, 0) + analysis.yOffset,
						elementWidth,
						Math.max(0, Math.abs(height + analysis.heightAddition) - analysis.heightCutoff),
						{'class': `series series-${seriesIndex}`},
					);

				rectangle.addEventListener('mouseenter', ev => {
					if (!!this.tooltip) {
						this.tooltip.style.display = 'block';
						this.tooltip.innerHTML = this.tooltipCallback(element);
						this.tooltip.style.top = `${this.height - this.padding.bottom - Math.max(height, 0) + analysis.yOffset - 20 - this.tooltip.offsetHeight / 2}px`;
						this.tooltip.style.left = `${Math.max(0, Math.min(this.width - this.tooltip.offsetWidth, this.padding.left + index * (data.length * elementWidth + 1) + (seriesIndex * elementWidth) - this.tooltip.offsetWidth / 2 + elementWidth / 2))}px`;
					}
				});
				rectangle.addEventListener('mouseleave', ev => {
					if (!!this.tooltip) {
						this.tooltip.style.display = 'none';
					}
				});

				this.appendToGroup('chart', rectangle);

				if (seriesIndex === 0 && index % labelPeriodicity === 0) {
					const textElement = this.newText(
						element[0],
						this.padding.left + index * (data.length * elementWidth + 1) + (seriesIndex * elementWidth) + spaceWidth / 2 - this.predictTextWidth(element[0]) / 2,
						this.height - this.padding.bottom + 20,
						{'class': 'x-axis-text axis-text'},
						),
						lineElement = this.newLine(
							this.padding.left + index * (data.length * elementWidth + 1) + (seriesIndex * elementWidth) + spaceWidth / 2,
							this.height - this.padding.bottom,
							this.padding.left + index * (data.length * elementWidth + 1) + (seriesIndex * elementWidth) + spaceWidth / 2,
							this.height - this.padding.bottom + 10,
							{'class': 'x-axis'},
						);
					this.appendToGroup('x-axis', textElement);
					this.appendToGroup('x-axis', lineElement);
				}
			});
		});
	}
}
