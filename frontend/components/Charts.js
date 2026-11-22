
"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";

import {
  Bar,
  Doughnut,
  Line,
} from "react-chartjs-2";

/* =========================================================
   NETSHIELD AI — CHART DESIGN SYSTEM
   ========================================================= */

export const COLORS = {
  signal: "#FF965E",
  low: "#69D6A1",
  medium: "#F3CA6B",
  high: "#FF9D65",
  critical: "#FF7181",

  attack: [
    "#FF7181",
    "#FF9D65",
    "#F3CA6B",
    "#B99BEA",
    "#54C5DC",
    "#69D6A1",
  ],
};

/* =========================================================
   HELPER — HEX TO RGBA
   ========================================================= */

function rgba(hex, alpha) {
  const clean = String(hex || COLORS.signal).replace("#", "");

  if (clean.length !== 6) {
    return `rgba(84,197,220,${alpha})`;
  }

  const value = parseInt(clean, 16);

  return `rgba(
    ${(value >> 16) & 255},
    ${(value >> 8) & 255},
    ${value & 255},
    ${alpha}
  )`;
}

/* =========================================================
   HELPER — GRADIENT FILL
   ========================================================= */

function gradient(context, color, fallback) {
  const chart = context.chart;
  const area = chart.chartArea;

  if (!area) {
    return fallback || rgba(color, 0.16);
  }

  const fill = chart.ctx.createLinearGradient(
    0,
    area.top,
    0,
    area.bottom
  );

  fill.addColorStop(0, rgba(color, 0.28));
  fill.addColorStop(0.72, rgba(color, 0.07));
  fill.addColorStop(1, rgba(color, 0.015));

  return fill;
}

/* =========================================================
   OPTIONAL ANOMALY THRESHOLD BAND
   Only renders when a real threshold is supplied.
   ========================================================= */

const thresholdBandPlugin = {
  id: "netshieldThresholdBand",

  beforeDatasetsDraw(chart, _args, options) {
    const band = options?.band;

    if (
      !band ||
      !chart.chartArea ||
      !chart.scales?.y
    ) {
      return;
    }

    const lowValue = Number(band.min ?? band.value);
    const highValue = Number(band.max ?? band.value);

    if (
      !Number.isFinite(lowValue) ||
      !Number.isFinite(highValue)
    ) {
      return;
    }

    const {
      ctx,
      chartArea,
      scales: { y },
    } = chart;

    const yTop = y.getPixelForValue(
      Math.max(lowValue, highValue)
    );

    const yBottom = y.getPixelForValue(
      Math.min(lowValue, highValue)
    );

    ctx.save();

    ctx.fillStyle =
      band.color || "rgba(255,113,129,.09)";

    ctx.fillRect(
      chartArea.left,
      yTop,
      chartArea.right - chartArea.left,
      Math.max(2, yBottom - yTop)
    );

    if (band.label) {
      ctx.fillStyle =
        band.labelColor || "#FF9DAD";

      ctx.font = "600 10px system-ui";
      ctx.textAlign = "right";

      ctx.fillText(
        band.label,
        chartArea.right - 6,
        yTop + 12
      );
    }

    ctx.restore();
  },
};

/* =========================================================
   REGISTER CHART.JS COMPONENTS AND PLUGINS
   ========================================================= */

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  thresholdBandPlugin
);

ChartJS.defaults.color = "#A9BDD0";
ChartJS.defaults.borderColor = "rgba(57,83,108,.42)";

ChartJS.defaults.font.family =
  "var(--font-plex-sans), Inter, system-ui, sans-serif";

ChartJS.defaults.font.size = 11;

/* =========================================================
   SHARED CHART OPTIONS
   ========================================================= */

const base = {
  responsive: true,
  maintainAspectRatio: false,

  animation: {
    duration: 650,
    easing: "easeOutQuart",
  },

  interaction: {
    mode: "index",
    intersect: false,
  },

  plugins: {
    legend: {
      position: "bottom",

      labels: {
        color: "#A9BDD0",
        boxWidth: 8,
        boxHeight: 8,
        usePointStyle: true,
        pointStyle: "circle",
        padding: 17,

        font: {
          size: 10,
          weight: "600",
        },
      },
    },

    tooltip: {
      enabled: true,

      backgroundColor: "#081624",
      borderColor: "#38536D",
      borderWidth: 1,

      titleColor: "#F0F6FC",
      bodyColor: "#C2D1E0",

      padding: 12,
      cornerRadius: 9,

      displayColors: true,
      usePointStyle: true,
      boxPadding: 5,

      titleFont: {
        size: 11,
        weight: "700",
      },

      bodyFont: {
        size: 11,
        weight: "500",
      },
    },
  },

  scales: {
    x: {
      grid: {
        display: false,
      },

      border: {
        display: false,
      },

      ticks: {
        color: "#91A6BC",
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 8,

        font: {
          size: 10,
        },
      },
    },

    y: {
      beginAtZero: true,

      border: {
        display: false,
        dash: [3, 4],
      },

      grid: {
        color: "rgba(57,83,108,.32)",
        drawTicks: false,
      },

      ticks: {
        color: "#91A6BC",
        precision: 0,
        padding: 8,

        font: {
          size: 10,
        },
      },
    },
  },
};

/* =========================================================
   LINE CHART
   Existing props:
   labels, datasets, height

   Optional new prop:
   thresholdBand

   Example:
   thresholdBand={{
     min: 80,
     max: 100,
     label: "High-risk zone"
   }}
   ========================================================= */

export function LineChart({
  labels,
  datasets,
  height = 260,
  thresholdBand = null,
}) {
  const styledDatasets = datasets.map((dataset) => ({
    ...dataset,

    borderWidth: dataset.borderWidth ?? 2,

    pointRadius: dataset.pointRadius ?? 0,

    pointHoverRadius:
      dataset.pointHoverRadius ?? 4,

    pointHoverBorderWidth: 2,

    tension: dataset.tension ?? 0.32,

    fill: dataset.fill ?? false,

    backgroundColor: dataset.fill
      ? (context) =>
          gradient(
            context,
            dataset.borderColor || COLORS.signal,
            dataset.backgroundColor
          )
      : dataset.backgroundColor,
  }));

  return (
    <div
      style={{
        height,
        minWidth: 0,
      }}
    >
      <Line
        data={{
          labels,
          datasets: styledDatasets,
        }}
        options={{
          ...base,

          interaction: {
            mode: "index",
            intersect: false,
          },

          plugins: {
            ...base.plugins,

            netshieldThresholdBand: {
              band: thresholdBand || null,
            },
          },

          scales: {
            ...base.scales,

            y: {
              ...base.scales.y,
              beginAtZero: true,
            },
          },
        }}
      />
    </div>
  );
}

/* =========================================================
   BAR CHART
   Existing props retained.
   ========================================================= */

export function BarChart({
  labels,
  data,
  colors,
  height = 240,
  horizontal = false,
  label = "Count",
}) {
  const background =
    colors ||
    ((context) => {
      const chart = context.chart;
      const area = chart.chartArea;

      if (!area) {
        return rgba(COLORS.signal, 0.85);
      }

      const fill = chart.ctx.createLinearGradient(
        horizontal ? area.left : 0,
        horizontal ? 0 : area.bottom,
        horizontal ? area.right : 0,
        horizontal ? 0 : area.top
      );

      fill.addColorStop(
        0,
        rgba(COLORS.signal, 0.52)
      );

      fill.addColorStop(
        1,
        rgba(COLORS.signal, 0.95)
      );

      return fill;
    });

  const options = {
    ...base,

    indexAxis: horizontal ? "y" : "x",

    plugins: {
      ...base.plugins,

      legend: {
        display: false,
      },
    },

    scales: horizontal
      ? {
          x: {
            ...base.scales.y,
            beginAtZero: true,
          },

          y: {
            ...base.scales.x,

            grid: {
              display: false,
            },

            ticks: {
              ...base.scales.x.ticks,
              autoSkip: false,
            },
          },
        }
      : base.scales,
  };

  return (
    <div
      style={{
        height,
        minWidth: 0,
      }}
    >
      <Bar
        data={{
          labels,

          datasets: [
            {
              label,
              data,

              backgroundColor: background,

              borderRadius: 7,
              borderSkipped: false,

              maxBarThickness: 30,

              hoverBackgroundColor:
                colors || rgba(COLORS.signal, 0.95),
            },
          ],
        }}
        options={options}
      />
    </div>
  );
}

/* =========================================================
   DOUGHNUT CHART
   Existing props retained.
   ========================================================= */

export function DoughnutChart({
  labels,
  data,
  colors = COLORS.attack,
  height = 240,
}) {
  return (
    <div
      style={{
        height,
        minWidth: 0,
      }}
    >
      <Doughnut
        data={{
          labels,

          datasets: [
            {
              data,

              backgroundColor: colors,

              borderColor: "#102438",
              borderWidth: 3,

              hoverOffset: 7,
              spacing: 2,
            },
          ],
        }}
        options={{
          ...base,

          cutout: "70%",

          plugins: {
            ...base.plugins,

            legend: {
              ...base.plugins.legend,

              position: "right",

              labels: {
                ...base.plugins.legend.labels,
                boxWidth: 7,
                boxHeight: 7,
                padding: 12,
              },
            },
          },
        }}
      />
    </div>
  );
}
