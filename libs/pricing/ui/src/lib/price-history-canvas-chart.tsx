'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  Chart,
  type ChartConfiguration,
  type ChartDataset,
  type Plugin,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import styles from './pricing-ui.module.css';

Chart.register(LinearScale, LineController, LineElement, PointElement, Tooltip);

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 260;

interface PriceHistoryChartDatum {
  readonly x: number;
  readonly y: number;
}

export interface PriceHistoryCanvasChartPoint {
  readonly headlinePriceMinor: number;
  readonly label: string;
  readonly merchantLabel?: string;
  readonly valueLabel: string;
}

export interface PriceHistoryCanvasChartProps {
  readonly ariaLabel: string;
  readonly highIndex: number;
  readonly latestIndex: number;
  readonly lowIndex: number;
  readonly points: readonly PriceHistoryCanvasChartPoint[];
}

function readCanvasColor(
  canvas: HTMLCanvasElement,
  property: string,
  fallback: string,
): string {
  const value = getComputedStyle(canvas).getPropertyValue(property).trim();

  if (value.length === 0) {
    return fallback;
  }

  const context = canvas.getContext('2d');

  if (!context) {
    return fallback;
  }

  const previousFillStyle = context.fillStyle;
  context.fillStyle = value;
  const normalizedValue = context.fillStyle;
  context.fillStyle = previousFillStyle;

  return normalizedValue === '#000000' && value !== '#000000'
    ? fallback
    : value;
}

function getDevicePixelRatio(): number {
  return Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
}

export function getPriceHistoryTooltipTitle(
  point: PriceHistoryCanvasChartPoint | undefined,
): string {
  return point?.label ?? '';
}

export function getPriceHistoryTooltipLines(
  point: PriceHistoryCanvasChartPoint | undefined,
): string[] {
  if (!point) {
    return [];
  }

  return [
    point.valueLabel,
    ...(point.merchantLabel
      ? [`Laagste prijs bij ${point.merchantLabel}`]
      : []),
    'Laagste prijs op dat moment',
  ];
}

export function PriceHistoryCanvasChart({
  ariaLabel,
  highIndex,
  latestIndex,
  lowIndex,
  points,
}: PriceHistoryCanvasChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const values = useMemo(
    () => points.map((point) => point.headlinePriceMinor),
    [points],
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || points.length < 2) {
      return;
    }

    const accentColor = readCanvasColor(
      canvas,
      '--pricing-history-chart-line',
      '#0f6fd8',
    );
    const gridColor = readCanvasColor(
      canvas,
      '--pricing-history-chart-grid',
      '#d9e1ea',
    );
    const labelColor = readCanvasColor(
      canvas,
      '--pricing-history-chart-label',
      '#64748b',
    );
    const markerColor = readCanvasColor(
      canvas,
      '--pricing-history-chart-marker',
      '#ffffff',
    );
    const lowColor = readCanvasColor(
      canvas,
      '--pricing-history-chart-low',
      '#1f8f5f',
    );
    const highColor = readCanvasColor(
      canvas,
      '--pricing-history-chart-high',
      '#6b7280',
    );
    const pointRadii = points.map((_, index) =>
      index === latestIndex
        ? 5
        : index === lowIndex || index === highIndex
          ? 4
          : 0,
    );
    const pointBorderColors = points.map((_, index) =>
      index === lowIndex
        ? lowColor
        : index === highIndex
          ? highColor
          : accentColor,
    );
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const yPadding = Math.max(Math.round((maxValue - minValue) * 0.12), 100);
    const referenceLinePlugin: Plugin<'line'> = {
      beforeDatasetsDraw(chart) {
        const yScale = chart.scales.y;
        const chartArea = chart.chartArea;

        if (!yScale || !chartArea) {
          return;
        }

        const context = chart.ctx;
        const lowY = yScale.getPixelForValue(minValue);
        const highY = yScale.getPixelForValue(maxValue);

        context.save();
        context.setLineDash([4, 6]);
        context.lineWidth = 1;

        for (const { color, y } of [
          { color: highColor, y: highY },
          { color: lowColor, y: lowY },
        ]) {
          context.beginPath();
          context.strokeStyle = color;
          context.globalAlpha = 0.26;
          context.moveTo(chartArea.left, y);
          context.lineTo(chartArea.right, y);
          context.stroke();
        }

        context.restore();
      },
      id: 'priceHistoryReferenceLines',
    };
    const data = points.map((point, index) => ({
      x: index,
      y: point.headlinePriceMinor,
    }));
    const dataSet: ChartDataset<'line', PriceHistoryChartDatum[]> = {
      borderColor: accentColor,
      borderCapStyle: 'round',
      borderJoinStyle: 'round',
      borderWidth: 4,
      clip: false,
      data,
      fill: false,
      pointBackgroundColor: markerColor,
      pointBorderColor: pointBorderColors,
      pointBorderWidth: 2,
      pointHitRadius: 10,
      pointHoverRadius: pointRadii.map((radius) => Math.max(radius + 1, 4)),
      pointRadius: pointRadii,
      tension: 0.26,
    };
    const config: ChartConfiguration<'line', PriceHistoryChartDatum[]> = {
      data: {
        datasets: [dataSet],
      },
      options: {
        animation: false,
        datasets: {
          line: {
            spanGaps: true,
          },
        },
        devicePixelRatio: getDevicePixelRatio(),
        elements: {
          line: {
            capBezierPoints: true,
          },
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 8,
            left: 4,
            right: 8,
            top: 8,
          },
        },
        normalized: true,
        parsing: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: '#111827',
            bodyFont: {
              size: 12,
              weight: 600,
            },
            callbacks: {
              label(context) {
                return getPriceHistoryTooltipLines(points[context.dataIndex]);
              },
              title(items) {
                return getPriceHistoryTooltipTitle(
                  points[items[0]?.dataIndex ?? 0],
                );
              },
            },
            displayColors: false,
            padding: 10,
            titleFont: {
              size: 11,
              weight: 500,
            },
          },
        },
        responsive: false,
        scales: {
          x: {
            border: {
              display: false,
            },
            display: false,
            grid: {
              display: false,
            },
            max: points.length - 1,
            min: 0,
            type: 'linear',
            ticks: {
              autoSkip: true,
              color: labelColor,
              maxRotation: 0,
              minRotation: 0,
              padding: 8,
              sampleSize: 4,
            },
          },
          y: {
            border: {
              display: false,
            },
            grid: {
              color: gridColor,
              lineWidth: 1,
            },
            max: maxValue + yPadding,
            min: Math.max(minValue - yPadding, 0),
            ticks: {
              color: labelColor,
              display: false,
              maxTicksLimit: 3,
              padding: 8,
            },
          },
        },
      },
      plugins: [referenceLinePlugin],
      type: 'line',
    };
    const chart = new Chart(canvas, config);

    return () => {
      chart.destroy();
    };
  }, [highIndex, latestIndex, lowIndex, points, values]);

  return (
    <canvas
      aria-label={ariaLabel}
      className={styles.historyCanvas}
      height={CANVAS_HEIGHT}
      ref={canvasRef}
      role="img"
      width={CANVAS_WIDTH}
    >
      Prijsverloop bouwt nog op
    </canvas>
  );
}
