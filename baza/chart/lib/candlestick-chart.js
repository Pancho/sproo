import Chart from './chart.js';

export default class CandlestickChart extends Chart {
	static getSeriesMinimums(data) {
		const result = [];

		data.forEach((series) => {
			result.push(Math.min(...series.data.map((entry) => Boolean(entry) && entry.low)));
		});

		return result;
	}

	static getSeriesMaximums(data) {
		const result = [];

		data.forEach((series) => {
			result.push(Math.max(...series.data.map((entry) => Boolean(entry) && entry.high)));
		});

		return result;
	}

	static getMagnitude(yMin, yMax) {
		return this.roundToMagnitude(yMax - yMin);
	}

	internalRenderData(data) {
		if (data.length !== 1) {
			throw new Error('Candlestick charts must have only one series');
		}

		const analysis = this.renderSkeleton(data);

		data.forEach((series, seriesIndex) => {
			const spaceWidth = (this.getPaintWidth() - series.data.length) / series.data.length,
				elementWidth = spaceWidth / data.length,
				labelTextLength = Math.max(...series.data.map((entry) => this.predictTextWidth(entry.datetime, 'x-axis-text axis-text'))),
				labelPeriodicity = spaceWidth > labelTextLength ? 1 : Math.ceil(labelTextLength / spaceWidth);

			series.data.forEach((element, index) => {
				const closesHigher = element.close > element.open,
					heightUnit = this.getPaintHeight() / Math.abs(analysis.yMaxChart - analysis.yMinChart),
					higher = closesHigher ? element.close : element.open,
					lower = closesHigher ? element.open : element.close,
					height = Math.abs(higher - lower) * heightUnit,
					elementStart = index * (data.length * elementWidth + 1) + seriesIndex * elementWidth,
					wickCenter = elementWidth / 2,
					rectangle = Chart.newRectangle(
						this.padding.left + index * (elementWidth + 1) - 1,
						this.padding.top + Math.abs((analysis.yMaxChart - higher) * heightUnit),
						elementWidth - 1,
						height,
						{'class': `candle candle-close-${ closesHigher ? 'high' : 'low' } candle-body`},
					),
					highWick = Chart.newLine(
						this.padding.left + elementStart + wickCenter - 1.5,
						this.padding.top + Math.abs((analysis.yMaxChart - element.high) * heightUnit),
						this.padding.left + elementStart + wickCenter - 1.5,
						this.padding.top + Math.abs((analysis.yMaxChart - higher) * heightUnit),
						{'class': `candle candle-close-${ closesHigher ? 'high' : 'low' } candle-wick`},
					),
					lowWick = Chart.newLine(
						this.padding.left + elementStart + wickCenter - 1.5,
						this.padding.top + Math.abs((analysis.yMaxChart - lower) * heightUnit),
						this.padding.left + elementStart + wickCenter - 1.5,
						this.padding.top + Math.abs((analysis.yMaxChart - element.low) * heightUnit),
						{'class': `candle candle-close-${ closesHigher ? 'high' : 'low' } candle-wick`},
					),
					marker = Chart.newRectangle(
						this.padding.left + index * (elementWidth + 1) - 1,
						this.padding.top,
						elementWidth,
						this.getPaintHeight(),
						{'class': 'candle-marker'},
					);

				marker.addEventListener('mouseenter', () => {
					if (this.tooltip) {
						this.tooltip.style.display = 'block';
						this.tooltip.innerHTML = this.tooltipCallback(element);
						this.tooltip.style.top = `${ this.padding.top - 20 - this.tooltip.offsetHeight / 2 }px`;
						this.tooltip.style.left = `${ Math.max(
							0,
							Math.min(
								this.width - this.tooltip.offsetWidth,
								this.padding.left + elementStart - this.tooltip.offsetWidth / 2 + wickCenter
							)
						) }px`;
					}
				});
				marker.addEventListener('mouseleave', () => {
					if (this.tooltip) {
						this.tooltip.style.display = 'none';
					}
				});

				this.appendToGroup('chart', rectangle);
				this.appendToGroup('chart', highWick);
				this.appendToGroup('chart', lowWick);
				this.appendToGroup('chart', marker);

				if (seriesIndex === 0 && index % labelPeriodicity === 0) {
					const textElement = Chart.newText(
							element.datetime,
							this.padding.left + elementStart + spaceWidth / 2 - this.predictTextWidth(element.datetime) / 2,
							this.height - this.padding.bottom + 20,
							{'class': 'x-axis-text axis-text'},
						),
						lineElement = Chart.newLine(
							this.padding.left + elementStart + spaceWidth / 2,
							this.height - this.padding.bottom,
							this.padding.left + elementStart + spaceWidth / 2,
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
