// NetShield AI — Chart.js wrappers with the dashboard's colours
// Developed by Krish | SKK Projects
"use client";
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend,
  LinearScale, LineElement, PointElement, Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler);
ChartJS.defaults.color = "#8DA2B8";
ChartJS.defaults.borderColor = "#25394F";
ChartJS.defaults.font.family = "var(--font-plex-sans), system-ui, sans-serif";

export const COLORS = {
  signal: "#4FB3C9", low: "#7FB685", medium: "#E3B341", high: "#E8833A", critical: "#E5484D",
  attack: ["#E5484D", "#E8833A", "#E3B341", "#B48EDB", "#4FB3C9", "#7FB685"],
};

const base = {
  responsive: true, maintainAspectRatio: false, animation: false,
  plugins: { legend: { labels: { boxWidth: 12, boxHeight: 12 } } },
};

export function LineChart({ labels, datasets, height = 260 }) {
  return (
    <div style={{ height }}>
      <Line data={{ labels, datasets }} options={{
        ...base, interaction: { mode: "index", intersect: false },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { maxTicksLimit: 8 } } },
      }} />
    </div>
  );
}

export function BarChart({ labels, data, colors, height = 240, horizontal = false, label = "Count" }) {
  return (
    <div style={{ height }}>
      <Bar data={{ labels, datasets: [{ label, data, backgroundColor: colors || COLORS.signal, borderRadius: 3 }] }}
        options={{ ...base, indexAxis: horizontal ? "y" : "x", plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
    </div>
  );
}

export function DoughnutChart({ labels, data, colors = COLORS.attack, height = 240 }) {
  return (
    <div style={{ height }}>
      <Doughnut data={{ labels, datasets: [{ data, backgroundColor: colors, borderColor: "#15263A", borderWidth: 2 }] }}
        options={{ ...base, cutout: "62%", plugins: { legend: { position: "right", labels: { boxWidth: 12 } } } }} />
    </div>
  );
}
