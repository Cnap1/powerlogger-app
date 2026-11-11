import {drawPieChart, drawBarChart, drawLineChart} from "../utils/charts-tables.js";
import {displayLabel, escapeHtml} from "../utils/common.js";

// Type filter ("" = all types)
const TYPE_FILTERS = [
  { value: "", label: "📋 All types" },
  { value: "note", label: "📝 Notes" },
  { value: "journal", label: "📔 Journals" },
  { value: "todo", label: "✅ Todos" },
  { value: "mood", label: "😊 Mood Stats" },
];

// Period filter: number of days back from today; "" = all time, "custom" = calendar
const PERIODS = [
  { value: "", label: "📅 All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "365", label: "Last year" },
  { value: "custom", label: "Custom range…" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVITY = 300; // happiness (max 100) x intensity (max 3)

/** "YYYY-MM-DD" in local time (what <input type="date"> uses) */
function toDateInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses "YYYY-MM-DD" as a local date; endOfDay gives 23:59:59.999 */
function fromDateInputValue(value, endOfDay = false) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day);
}

/** Config label (with emoji) for an area/type key */
function labelFor(list, key) {
  const entry = (list || []).find((e) => e.key === key);
  return entry ? displayLabel(entry) : key || "Unassigned";
}

export function renderStatsPage() {
  const app = document.getElementById("app");
  if (!app) {
    console.error("App container not found");
    return;
  }

  const localConfig =
    JSON.parse(localStorage.getItem("localAppConfig")) || window.appConfig;
  const items = JSON.parse(localStorage.getItem("logseqItems") || "[]");
  const today = toDateInputValue(new Date());
  const oldest = items.length
    ? toDateInputValue(new Date(Math.min(...items.map((i) => new Date(i.createdAt)))))
    : today;

  app.innerHTML = `
        <div class="container">
            <div class="stats-header">
                <h1>📊 Analytics Dashboard</h1>
            </div>

            <div class="filters-card">
                <div class="filters-header">
                    <h4>Filters <span id="activeFilterSummary" class="filter-summary"></span></h4>
                    <div>
                        <button id="clearFilters" class="btn btn-secondary btn-small">Clear</button>
                        <button id="toggleFilters" class="btn btn-primary btn-small" aria-expanded="false" aria-controls="filtersContent">Show Filters</button>
                    </div>
                </div>
                <div id="filtersContent" class="filters-body" style="display: none;">
                    <div class="stats-filter-row">
                        <label class="stats-filter">
                            <span>Area</span>
                            <select id="statsAreaFilter" class="filter-select">
                                <option value="">🌐 All areas</option>
                                ${localConfig.areas
                                  .map((area) => `<option value="${escapeHtml(area.key)}">${displayLabel(area)}</option>`)
                                  .join("")}
                            </select>
                        </label>
                        <label class="stats-filter">
                            <span>Type</span>
                            <select id="statsTypeFilter" class="filter-select">
                                ${TYPE_FILTERS.map((t) => `<option value="${t.value}">${t.label}</option>`).join("")}
                            </select>
                        </label>
                        <label class="stats-filter">
                            <span>Period</span>
                            <select id="statsPeriodFilter" class="filter-select">
                                ${PERIODS.map((p) => `<option value="${p.value}">${p.label}</option>`).join("")}
                            </select>
                        </label>
                    </div>

                    <div id="customRange" class="date-range" style="display: none;">
                        <label class="date-range-field">
                            <span>From</span>
                            <input type="date" id="dateFrom" class="filter-select" min="${oldest}" max="${today}">
                        </label>
                        <label class="date-range-field">
                            <span>To</span>
                            <input type="date" id="dateTo" class="filter-select" min="${oldest}" max="${today}">
                        </label>
                    </div>
                </div>
            </div>

            <!-- KPI Cards -->
            <div class="kpi-grid" id="kpiCards"></div>

            <!-- Charts Section -->
            <div class="charts-grid">
                <div class="charts-row-2">
                    <div class="chart-card">
                        <div class="chart-header">
                            <h5 class="chart-title">Entry Type Distribution</h5>
                        </div>
                        <div class="chart-body">
                            <canvas id="typeChart" class="chart-canvas" width="600" height="400"></canvas>
                        </div>
                    </div>

                    <div class="chart-card">
                        <div class="chart-header">
                            <h5 class="chart-title">Area Distribution</h5>
                        </div>
                        <div class="chart-body">
                            <canvas id="areaChart" class="chart-canvas" width="600" height="400"></canvas>
                        </div>
                    </div>
                </div>

                <div class="chart-card">
                    <div class="chart-header">
                        <h5 class="chart-title" id="timeChartTitle">Entries Over Time</h5>
                    </div>
                    <div class="chart-body">
                        <canvas id="timeChart" class="chart-canvas" width="1000" height="400"></canvas>
                    </div>
                </div>

                <div id="moodCharts" class="mood-charts" style="display: none;">
                    <div class="chart-card">
                        <div class="chart-header mood-calendar-header">
                            <button type="button" id="calPrev" class="cal-nav" aria-label="Previous month">‹</button>
                            <h5 class="chart-title" id="calTitle">📅 Mood Calendar</h5>
                            <button type="button" id="calNext" class="cal-nav" aria-label="Next month">›</button>
                        </div>
                        <div class="chart-body mood-calendar-body">
                            <div id="moodCalendar" class="mood-calendar" role="grid" aria-labelledby="calTitle"></div>
                            <div class="mood-calendar-legend">
                                <span>Low</span><span class="legend-scale" aria-hidden="true"></span><span>High</span>
                                <span class="legend-note">average happiness per day</span>
                            </div>
                            <p id="calDayDetail" class="cal-day-detail" aria-live="polite"></p>
                        </div>
                    </div>

                    <div class="chart-card">
                        <div class="chart-header">
                            <h5 class="chart-title">💡 What Affects Your Mood</h5>
                            <p class="chart-subtitle">Average happiness per context (contexts used at least twice), compared with your overall average</p>
                        </div>
                        <div class="chart-body context-insights-body">
                            <div id="contextInsights" class="context-insights"></div>
                        </div>
                    </div>

                    <div class="chart-card">
                        <div class="chart-header">
                            <h5 class="chart-title">🏆 Top 5 Moods</h5>
                        </div>
                        <div class="chart-body">
                            <canvas id="topMoodsChart" class="chart-canvas" width="1000" height="300"></canvas>
                        </div>
                    </div>

                    <div class="chart-card">
                        <div class="chart-header">
                            <h5 class="chart-title" id="moodChartTitle">⚡ Emotional Activity Over Time</h5>
                            <p class="chart-subtitle">Happiness (1–100) × intensity (1–3), averaged per period - higher means stronger, more positive feelings</p>
                        </div>
                        <div class="chart-body">
                            <canvas id="moodChart" class="chart-canvas" width="1000" height="400"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <div id="noDataMessage" class="no-data-message" style="display: none;">
                <h4>No data available</h4>
                <p>Adjust your filters or add some entries to see statistics.</p>
            </div>
        </div>
    `;

  initializeStatsHandlers(localConfig);
  updateStats(localConfig);
}

function initializeStatsHandlers(config) {
  const areaSelect = document.getElementById("statsAreaFilter");
  const typeSelect = document.getElementById("statsTypeFilter");
  const periodSelect = document.getElementById("statsPeriodFilter");
  const customRange = document.getElementById("customRange");
  const dateFrom = document.getElementById("dateFrom");
  const dateTo = document.getElementById("dateTo");
  const refresh = () => updateStats(config);

  areaSelect.addEventListener("change", refresh);
  typeSelect.addEventListener("change", refresh);

  // Period: presets fill the From/To dates; "Custom range" shows the calendar
  periodSelect.addEventListener("change", () => {
    const value = periodSelect.value;
    customRange.style.display = value === "custom" ? "" : "none";
    if (value === "custom") {
      dateFrom.focus();
    } else {
      const days = value ? Number(value) : null;
      dateFrom.value = days ? toDateInputValue(new Date(Date.now() - (days - 1) * DAY_MS)) : "";
      dateTo.value = days ? toDateInputValue(new Date()) : "";
    }
    refresh();
  });

  // Custom range: keep From <= To
  const onDateChange = () => {
    if (dateFrom.value && dateTo.value && dateFrom.value > dateTo.value) {
      [dateFrom.value, dateTo.value] = [dateTo.value, dateFrom.value];
    }
    refresh();
  };
  dateFrom.addEventListener("change", onDateChange);
  dateTo.addEventListener("change", onDateChange);

  // Show / hide filters (hidden by default)
  const toggleBtn = document.getElementById("toggleFilters");
  const filtersContent = document.getElementById("filtersContent");
  toggleBtn.addEventListener("click", () => {
    const show = filtersContent.style.display === "none";
    filtersContent.style.display = show ? "" : "none";
    toggleBtn.textContent = show ? "Hide Filters" : "Show Filters";
    toggleBtn.setAttribute("aria-expanded", String(show));
  });

  // Clear: all areas, all types, all time
  document.getElementById("clearFilters").addEventListener("click", () => {
    areaSelect.value = "";
    typeSelect.value = "";
    periodSelect.value = "";
    dateFrom.value = "";
    dateTo.value = "";
    customRange.style.display = "none";
    refresh();
  });
}

function readFilters() {
  return {
    area: document.getElementById("statsAreaFilter")?.value || "",
    type: document.getElementById("statsTypeFilter")?.value || "",
    from: fromDateInputValue(document.getElementById("dateFrom")?.value),
    to: fromDateInputValue(document.getElementById("dateTo")?.value, true),
  };
}

function updateStats(config) {
  const items = JSON.parse(localStorage.getItem("logseqItems") || "[]");
  const filters = readFilters();

  const filteredData = filterStatsData(items, filters);
  filters.timeGroup = pickTimeGroup(filteredData, filters);
  calendarMonth = null; // calendar opens at the newest month of the new selection

  updateFilterSummary(config);
  updateKPICards(filteredData);

  // Empty selection: show the message instead of stale charts
  const hasData = filteredData.length > 0;
  document.getElementById("noDataMessage").style.display = hasData ? "none" : "block";
  document.querySelector(".charts-grid").style.display = hasData ? "" : "none";
  if (hasData) updateStatsCharts(filteredData, filters, config);
}

/** Short summary next to "Filters" so active filters are visible while collapsed */
function updateFilterSummary(config) {
  const summary = document.getElementById("activeFilterSummary");
  if (!summary) return;
  const parts = [];
  const area = document.getElementById("statsAreaFilter").value;
  const type = document.getElementById("statsTypeFilter");
  const period = document.getElementById("statsPeriodFilter");
  if (area) parts.push(labelFor(config.areas, area));
  if (type.value) parts.push(type.options[type.selectedIndex].text);
  if (period.value === "custom") {
    const from = document.getElementById("dateFrom").value;
    const to = document.getElementById("dateTo").value;
    if (from || to) parts.push(`${from || "…"} → ${to || "…"}`);
  } else if (period.value) {
    parts.push(period.options[period.selectedIndex].text);
  }
  summary.textContent = parts.length ? `· ${parts.join(" · ")}` : "";
}

function filterStatsData(items, filters) {
  return items.filter((item) => {
    if (filters.area && item.area !== filters.area) return false;
    if (filters.type && item.type !== filters.type) return false;
    const created = new Date(item.createdAt);
    if (filters.from && created < filters.from) return false;
    if (filters.to && created > filters.to) return false;
    return true;
  });
}

/** Chart grouping that suits the period shown: days, weeks or months */
function pickTimeGroup(data, filters) {
  const times = data.map((item) => new Date(item.createdAt).getTime());
  const start = filters.from?.getTime() ?? (times.length ? Math.min(...times) : Date.now());
  const end = filters.to?.getTime() ?? (times.length ? Math.max(...times) : Date.now());
  const days = (end - start) / DAY_MS;
  if (days <= 45) return "day";
  if (days <= 270) return "week";
  return "month";
}

/** Period key for a date: "2026-11-05" (day / week start) or "2026-11" (month) */
function periodKey(dateString, timeGroup) {
  const date = new Date(dateString);
  if (timeGroup === "week") date.setDate(date.getDate() - date.getDay());
  if (timeGroup === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return toDateInputValue(date);
}

const GROUP_NAMES = { day: "daily", week: "weekly", month: "monthly" };

function updateKPICards(filteredData) {
  const total = filteredData.length;
  const todayString = new Date().toDateString();
  const todayItems = filteredData.filter(
    (item) => new Date(item.createdAt).toDateString() === todayString
  );

  const moodItems = filteredData.filter(
    (item) => item.type === "mood" && item.mood?.happiness
  );
  const todoItems = filteredData.filter((item) => item.type === "todo");
  const avgMood =
    moodItems.length > 0
      ? Math.round(
          moodItems.reduce((acc, item) => acc + (item.mood?.happiness || 0), 0) /
            moodItems.length
        )
      : null;

  const kpiContainer = document.getElementById("kpiCards");
  kpiContainer.innerHTML = `
        <div class="kpi-card">
            <div class="kpi-title">Total Entries</div>
            <h3 class="kpi-value primary">${total.toLocaleString()}</h3>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Today's Entries</div>
            <h3 class="kpi-value success">${todayItems.length}</h3>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Avg Mood Score</div>
            <h3 class="kpi-value warning" title="${avgMood === null ? "No mood entries in this selection" : ""}">${
              avgMood === null ? "–" : `${avgMood}<span class="kpi-unit">/100</span>`
            }</h3>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Total Todos</div>
            <h3 class="kpi-value info">${todoItems.length}</h3>
        </div>
    `;
}

function updateStatsCharts(filteredData, filters, config) {
  const areaCard = document.querySelector("#areaChart").closest(".chart-card");
  const typeCard = document.querySelector("#typeChart").closest(".chart-card");

  // A chart of a single filtered value adds nothing: hide it
  areaCard.style.display = filters.area ? "none" : "";
  typeCard.style.display = filters.type ? "none" : "";
  if (!filters.area) createAreaChart(filteredData, config);
  if (!filters.type) createTypeChart(filteredData, config);

  createTimeChart(filteredData, filters.timeGroup);
  createMoodCharts(filteredData, filters.timeGroup);
}

/** { label: count }, biggest first */
function countBy(data, keyOf, labelOf) {
  const counts = {};
  data.forEach((item) => {
    const label = labelOf(keyOf(item));
    counts[label] = (counts[label] || 0) + 1;
  });
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function createTypeChart(data, config) {
  const typeData = countBy(data, (item) => item.type, (key) => labelFor(config.entryTypes, key));
  drawPieChart(document.getElementById("typeChart").getContext("2d"), typeData);
}

function createAreaChart(data, config) {
  const areaData = countBy(data, (item) => item.area, (key) => labelFor(config.areas, key));
  drawBarChart(document.getElementById("areaChart").getContext("2d"), areaData, { label: "Entries" });
}

function createTimeChart(data, timeGroup) {
  const counts = {};
  data.forEach((item) => {
    const key = periodKey(item.createdAt, timeGroup);
    counts[key] = (counts[key] || 0) + 1;
  });
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));

  document.getElementById("timeChartTitle").textContent =
    `Entries Over Time (${GROUP_NAMES[timeGroup] || timeGroup})`;
  drawLineChart(document.getElementById("timeChart").getContext("2d"), sorted, { label: "Entries" });
}

/** Top 5 chosen moods + emotional activity (happiness x intensity) over time */
function createMoodCharts(data, timeGroup) {
  const moods = data.filter((item) => item.type === "mood" && item.mood);
  const container = document.getElementById("moodCharts");
  container.style.display = moods.length ? "" : "none";
  if (!moods.length) return;

  renderMoodCalendar(moods);
  renderContextInsights(moods);

  // Top 5 moods by how often they were chosen
  const counts = {};
  moods.forEach(({ mood }) => {
    const name = mood.secondary || mood.label || "Unknown";
    const key = `${mood.emoji || "🤔"} ${name}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  const top5 = Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5));
  drawBarChart(document.getElementById("topMoodsChart").getContext("2d"), top5, {
    horizontal: true,
    label: "Times chosen",
  });

  // Emotional activity = happiness x intensity, averaged per period
  const sums = {};
  moods.forEach(({ createdAt, mood }) => {
    const happiness = Number(mood.happiness) || 0;
    const intensity = Number(mood.intensity) || 1;
    const key = periodKey(createdAt, timeGroup);
    sums[key] = sums[key] || { total: 0, count: 0 };
    sums[key].total += happiness * intensity;
    sums[key].count += 1;
  });
  const activity = Object.fromEntries(
    Object.entries(sums)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { total, count }]) => [key, Math.round(total / count)])
  );

  document.getElementById("moodChartTitle").textContent =
    `⚡ Emotional Activity Over Time (${GROUP_NAMES[timeGroup] || timeGroup})`;
  drawLineChart(document.getElementById("moodChart").getContext("2d"), activity, {
    label: "Emotional activity",
    color: "280, 60%, 55%",
    yMax: MAX_ACTIVITY,
    yTitle: "Happiness × intensity",
  });
}

// ===== Mood calendar =====

let calendarMonth = null; // first day of the month shown
let calendarMoods = [];

/** Red (low) -> yellow -> green (high) for a 1-100 happiness value */
function moodColor(happiness) {
  const hue = Math.round((Math.max(0, Math.min(100, happiness)) / 100) * 120);
  return `hsl(${hue}, 70%, 55%)`;
}

function renderMoodCalendar(moods) {
  calendarMoods = moods;
  if (!calendarMonth) {
    // Start at the month of the newest mood in the selection
    const newest = new Date(Math.max(...moods.map((m) => new Date(m.createdAt))));
    calendarMonth = new Date(newest.getFullYear(), newest.getMonth(), 1);
  }

  // Group the moods per local day
  const byDay = {};
  moods.forEach((item) => {
    (byDay[toDateInputValue(new Date(item.createdAt))] ||= []).push(item);
  });

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday first
  const todayKey = toDateInputValue(new Date());

  document.getElementById("calTitle").textContent =
    "📅 " + calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const weekdayNames = [...Array(7)].map((_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)
  );

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(`<div class="cal-cell empty" role="gridcell"></div>`);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = toDateInputValue(new Date(year, month, day));
    const entries = byDay[key] || [];
    const isToday = key === todayKey ? " today" : "";
    if (!entries.length) {
      cells.push(`<div class="cal-cell${isToday}" role="gridcell"><span class="cal-day">${day}</span></div>`);
      continue;
    }
    const avg = Math.round(entries.reduce((sum, e) => sum + (Number(e.mood.happiness) || 0), 0) / entries.length);
    // Most chosen emoji of the day
    const emojiCounts = {};
    entries.forEach((e) => (emojiCounts[e.mood.emoji] = (emojiCounts[e.mood.emoji] || 0) + 1));
    const topEmoji = Object.entries(emojiCounts).sort((a, b) => b[1] - a[1])[0][0];
    const names = [...new Set(entries.map((e) => e.mood.secondary || e.mood.label))].slice(0, 3).join(", ");
    const detail = `${new Date(year, month, day).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}: ${entries.length} mood${entries.length > 1 ? "s" : ""}, average ${avg}/100 (${names})`;
    cells.push(`
      <button type="button" class="cal-cell has-mood${isToday}" role="gridcell" style="--mood-color: ${moodColor(avg)}"
              title="${escapeHtml(detail)}" data-detail="${escapeHtml(detail)}" aria-label="${escapeHtml(detail)}">
          <span class="cal-day">${day}</span>
          <span class="cal-emoji">${escapeHtml(topEmoji)}</span>
      </button>`);
  }

  const calendar = document.getElementById("moodCalendar");
  calendar.innerHTML =
    weekdayNames.map((name) => `<div class="cal-weekday" role="columnheader">${name}</div>`).join("") + cells.join("");

  const detailLine = document.getElementById("calDayDetail");
  detailLine.textContent = "";
  calendar.querySelectorAll(".cal-cell.has-mood").forEach((cell) => {
    cell.addEventListener("click", () => {
      calendar.querySelectorAll(".cal-cell.selected").forEach((c) => c.classList.remove("selected"));
      cell.classList.add("selected");
      detailLine.textContent = cell.dataset.detail;
    });
  });

  // Month navigation (bound once per page render)
  const prev = document.getElementById("calPrev");
  const next = document.getElementById("calNext");
  if (!prev.dataset.bound) {
    prev.dataset.bound = next.dataset.bound = "1";
    prev.addEventListener("click", () => {
      calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
      renderMoodCalendar(calendarMoods);
    });
    next.addEventListener("click", () => {
      calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
      renderMoodCalendar(calendarMoods);
    });
  }
  const now = new Date();
  next.disabled = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth());
}

// ===== Context insights =====

function renderContextInsights(moods) {
  const target = document.getElementById("contextInsights");
  const overall = moods.reduce((sum, m) => sum + (Number(m.mood.happiness) || 0), 0) / moods.length;

  const groups = {};
  moods.forEach(({ mood }) => {
    const context = (mood.context || "").trim();
    if (!context) return;
    const key = context.toLowerCase();
    groups[key] ||= { label: context, total: 0, count: 0 };
    groups[key].total += Number(mood.happiness) || 0;
    groups[key].count += 1;
  });

  const ranked = Object.values(groups)
    .filter((g) => g.count >= 2)
    .map((g) => ({ ...g, avg: Math.round(g.total / g.count) }))
    .sort((a, b) => b.avg - a.avg);

  if (ranked.length < 2) {
    target.innerHTML = `<p class="insight-empty">Not enough data yet. Add a context (e.g. "after a run") when you log a mood - once a context has been used twice, it shows up here.</p>`;
    return;
  }

  const row = (g) => {
    const diff = Math.round(g.avg - overall);
    const sign = diff > 0 ? "+" : "";
    return `
      <li class="context-row">
          <span class="context-dot" style="background: ${moodColor(g.avg)}"></span>
          <span class="context-label">${escapeHtml(g.label)}</span>
          <span class="context-avg">${g.avg} avg <span class="context-diff ${diff >= 0 ? "up" : "down"}">(${sign}${diff})</span></span>
          <span class="context-count">${g.count}×</span>
      </li>`;
  };

  const best = ranked.slice(0, 3);
  const worst = ranked.slice(-3).reverse().filter((g) => !best.includes(g));

  target.innerHTML = `
      <p class="context-overall">Your overall average: <strong>${Math.round(overall)}/100</strong> over ${moods.length} moods</p>
      <div class="context-columns">
          <div>
              <h6>😊 Lifts your mood</h6>
              <ul class="context-list">${best.map(row).join("")}</ul>
          </div>
          ${worst.length ? `
          <div>
              <h6>😟 Brings it down</h6>
              <ul class="context-list">${worst.map(row).join("")}</ul>
          </div>` : ""}
      </div>`;
}
