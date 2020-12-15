import Chart from './chart.js';

export default class CandlestickChart extends Chart {
	getSeriesMinimums(data) {
		const result = [];
		data.forEach(series => {
			result.push(Math.min(...series.data.map(entry => !!entry && entry.low)));
		});
		return result;
	}

	getSeriesMaximums(data) {
		const result = [];
		data.forEach(series => {
			result.push(Math.max(...series.data.map(entry => !!entry && entry.high)));
		});
		return result;
	}

	getMagnitude(yMin, yMax) {
		return this.roundToMagnitude(yMax - yMin);
	}

	_renderData(data) {
		if (data.length !== 1) {
			throw new Error('Candlestick charts must have only one series');
		}

		const analysis = this.renderSkeleton(data);

		data.forEach((series, seriesIndex) => {
			const spaceWidth = (this.getPaintWidth() - series.data.length) / series.data.length,
				elementWidth = spaceWidth / data.length,
				labelTextLength = Math.max(...series.data.map(entry => this.predictTextWidth(entry.datetime, 'x-axis-text axis-text'))),
				labelPeriodicity = spaceWidth > labelTextLength ? 1 : Math.ceil(labelTextLength / spaceWidth);
			series.data.forEach((element, index) => {
				const closesHigher = element.close > element.open,
					heightUnit = this.getPaintHeight() / Math.abs(analysis.yMaxChart - analysis.yMinChart),
					higher = closesHigher ? element.close : element.open,
					lower = closesHigher ? element.open : element.close,
					height = Math.abs(higher - lower) * heightUnit,
					rectangle = this.newRectangle(
						this.padding.left + index * (elementWidth + 1) - 1,
						this.padding.top + Math.abs((analysis.yMaxChart - higher) * heightUnit),
						elementWidth - 1,
						height,
						{'class': `candle candle-close-${closesHigher ? 'high' : 'low'} candle-body`},
					),
					highWick = this.newLine(
						this.padding.left + index * (data.length * elementWidth + 1) + (seriesIndex * elementWidth) + elementWidth / 2 - 1.5,
						this.padding.top + Math.abs((analysis.yMaxChart - element.high) * heightUnit),
						this.padding.left + index * (data.length * elementWidth + 1) + (seriesIndex * elementWidth) + elementWidth / 2 - 1.5,
						this.padding.top + Math.abs((analysis.yMaxChart - higher) * heightUnit),
						{'class': `candle candle-close-${closesHigher ? 'high' : 'low'} candle-wick`}
					),
					lowWick = this.newLine(
						this.padding.left + index * (data.length * elementWidth + 1) + (seriesIndex * elementWidth) + elementWidth / 2 - 1.5,
						this.padding.top + Math.abs((analysis.yMaxChart - lower) * heightUnit),
						this.padding.left + index * (data.length * elementWidth + 1) + (seriesIndex * elementWidth) + elementWidth / 2 - 1.5,
						this.padding.top + Math.abs((analysis.yMaxChart - element.low) * heightUnit),
						{'class': `candle candle-close-${closesHigher ? 'high' : 'low'} candle-wick`}
					),
					marker = this.newRectangle(
						this.padding.left + index * (elementWidth + 1) - 1,
						this.padding.top,
						elementWidth,
						this.getPaintHeight(),
						{'class': 'candle-marker'},
					);

				marker.addEventListener('mouseenter', ev => {
					if (!!this.tooltip) {
						this.tooltip.style.display = 'block';
						this.tooltip.innerHTML = this.tooltipCallback(element);
						this.tooltip.style.top = `${this.padding.top - 20 - this.tooltip.offsetHeight / 2}px`;
						this.tooltip.style.left = `${Math.max(0, Math.min(this.width - this.tooltip.offsetWidth, this.padding.left + index * (data.length * elementWidth + 1) + (seriesIndex * elementWidth) - this.tooltip.offsetWidth / 2 + elementWidth / 2))}px`;
					}
				});
				marker.addEventListener('mouseleave', ev => {
					if (!!this.tooltip) {
						this.tooltip.style.display = 'none';
					}
				});

				this.appendToGroup('chart', rectangle);
				this.appendToGroup('chart', highWick);
				this.appendToGroup('chart', lowWick);
				this.appendToGroup('chart', marker);

				if (seriesIndex === 0 && index % labelPeriodicity === 0) {
					const textElement = this.newText(
						element.datetime,
						this.padding.left + index * (data.length * elementWidth + 1) + (seriesIndex * elementWidth) + spaceWidth / 2 - this.predictTextWidth(element.datetime) / 2,
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
