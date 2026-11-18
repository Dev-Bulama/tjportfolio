import {
  Chart,
  LineController,
  BarController,
  DoughnutController,
  LineElement,
  BarElement,
  ArcElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

Chart.register(LineController, BarController, DoughnutController, LineElement, BarElement, ArcElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

export function initCharts(): void {
  const dark = document.documentElement.dataset.theme === "dark";
  const colors = [dark ? css("--gold") : css("--navy"), dark ? css("--teal") : css("--gold"), css("--teal"), css("--muted")];
  for (const canvas of document.querySelectorAll<HTMLCanvasElement>("canvas[data-chart]")) {
    const holder = canvas.closest("section, [data-chart-wrap]");
    const raw = holder?.querySelector("[data-chart-data]")?.textContent ?? "{}";
    const data = JSON.parse(raw) as { labels: string[]; datasets: Array<{ label: string; data: number[] }> };
    const kind = canvas.dataset.chart as "line" | "bar" | "doughnut";
    new Chart(canvas, {
      type: kind,
      data: {
        labels: data.labels,
        datasets: (data.datasets ?? []).map((d, i) => ({
          ...d,
          borderColor: kind === "doughnut" ? css("--surface") : colors[i % colors.length],
          backgroundColor: kind === "line" ? `${colors[i % colors.length]}22` : kind === "doughnut" ? colors : colors[i % colors.length],
          fill: kind === "line" && i === 0,
          tension: 0.35,
          pointRadius: 2,
          borderWidth: 2,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { labels: { color: css("--body"), boxWidth: 12 } } },
        scales:
          kind === "doughnut"
            ? {}
            : {
                x: { ticks: { color: css("--muted") }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: css("--muted"), precision: 0 }, grid: { color: css("--line") } },
              },
      },
    });
  }
}
