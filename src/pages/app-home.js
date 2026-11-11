// Import utilities
import {navigateTo} from "../utils/app-navigation.js";
import {getAppStats} from "../utils/app-stats.js";
import {initializeDateUtils} from "../utils/date.js";
import {escapeHtml, displayLabel} from "../utils/common.js";
import {backupIsDue, downloadBackup, describeLastBackup} from "../utils/backup.js";
import {reminderIsDue, dismissReminderToday} from "../utils/reminder.js";
import {notify, confirmDialog} from "../components/dialog.js";
import {refreshCurrentPage} from "../utils/app-navigation.js";
import {readItems, deleteItem, restoreItem, toggleTodoDone, isOverdue, isFinishedTodo, matchesSearch} from "../utils/items.js";

// Initialize date utilities
const {getTimeAgo, getTodayStreak} = initializeDateUtils();

// "Later" on the backup banner hides it until the app is reopened
let backupBannerDismissed = false;

// Recent Items filters, sort and search; kept while the app is open so a
// redraw (after delete, Undo or ticking a todo) does not reset them
const recentState = { area: "", type: "", order: "desc", query: "" };

/**
 * Renders the home page of the application.
 */
export function renderHomePage() {
  const app = document.getElementById("app");
  if (!app) {
    console.error("App container not found");
    return;
  }

  const items = JSON.parse(localStorage.getItem("logseqItems") || "[]");
  const stats = getAppStats(items);
  const todayItems = getTodayItems(items);
  const pendingTodos = getPendingTodos(items);
  const overdueTodos = items.filter((item) => isOverdue(item));
  const week = getWeeklyMoodSummary(items);
  const showReminder = reminderIsDue();
  const showBackup = !backupBannerDismissed && backupIsDue();

  app.innerHTML = `
        <div class="container">
            <div class="header-row">
                <h1>PowerLogger</h1>
                <div class="stats-mini">
                    <span class="mini-stat">${items.length} items</span>
                    <span class="mini-stat">${todayItems.length} today</span>
                    ${
                      pendingTodos.length > 0
                        ? `<span class="mini-stat pending">${pendingTodos.length} pending</span>`
                        : ""
                    }
                </div>
            </div>

            ${showReminder ? `
            <div class="home-banner reminder-banner" role="status">
                <span class="banner-text">⏰ You haven't logged your mood today. How are you feeling?</span>
                <div class="banner-actions">
                    <button type="button" id="reminderLogMood" class="btn btn-primary btn-small">🧠 Log mood</button>
                    <button type="button" id="reminderDismiss" class="btn btn-secondary btn-small">Not today</button>
                </div>
            </div>` : ""}

            ${showBackup ? `
            <div class="home-banner backup-banner" role="status">
                <span class="banner-text">💾 Last backup: <strong>${describeLastBackup()}</strong>. Your entries only live in this browser.</span>
                <div class="banner-actions">
                    <button type="button" id="bannerBackup" class="btn btn-primary btn-small">Download backup</button>
                    <button type="button" id="bannerBackupLater" class="btn btn-secondary btn-small">Later</button>
                </div>
            </div>` : ""}

            ${overdueTodos.length ? `
            <div class="home-banner overdue-banner" role="status">
                <span class="banner-text">⚠️ <strong>${overdueTodos.length}</strong> overdue todo${overdueTodos.length === 1 ? "" : "s"}.</span>
                <div class="banner-actions">
                    <button type="button" id="showOverdue" class="btn btn-primary btn-small">Show todos</button>
                </div>
            </div>` : ""}

            ${week.moodsThisWeek || week.streak ? `
            <div class="week-summary" aria-label="This week">
                <div class="week-stat">
                    <span class="week-value">🔥 ${week.streak}</span>
                    <span class="week-label">day mood streak</span>
                </div>
                <div class="week-stat">
                    <span class="week-value">${week.avgThisWeek === null ? "–" : `${week.avgEmoji} ${week.avgThisWeek}`}
                        ${week.change === null ? "" : `<span class="week-change ${week.change >= 0 ? "up" : "down"}">${week.change >= 0 ? "▲" : "▼"} ${Math.abs(week.change)}</span>`}
                    </span>
                    <span class="week-label">avg mood this week${week.change === null ? "" : " vs last week"}</span>
                </div>
                <div class="week-stat">
                    <span class="week-value">🧠 ${week.moodsThisWeek}</span>
                    <span class="week-label">moods this week</span>
                </div>
            </div>` : ""}

            <div class="main-actions">
                <div class="quick-buttons">
                    <button type="button" class="quick-btn" data-type="note">📝 Add Note</button>
                    <button type="button" class="quick-btn quick-btn-mood" data-type="mood">🧠 Add Mood</button>
                    <button type="button" class="quick-btn" data-type="todo">✅ Add Todo</button>
                    <button type="button" class="quick-btn" data-type="journal">📓 Add Journal</button>
                </div>
            </div>
            
            <div class="bottom-section">
                ${
                  items.length > 0
                    ? `
                    <div class="recent-section">
                        <div class="recent-header">
                            <h3 class="section-title">📝 Recent Items <span id="recentCount" class="recent-count">(${items.length})</span></h3>
                            <div class="recent-controls">
                                <button id="statsButton" class="btn btn-primary btn-small">📊 View Stats</button>
                            </div>
                        </div>
                        <div class="recent-search">
                            <input type="search" id="recentSearch" class="recent-search-input" placeholder="🔍 Search title, content, tags, mood…"
                                   value="${escapeHtml(recentState.query)}" aria-label="Search recent items" autocomplete="off">
                        </div>

                        <div class="table-responsive recent-scroll">
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th class="area-col">
                                        <select id="recentAreaFilter" class="th-filter" aria-label="Filter by area">
                                            <option value="">Area ▾</option>
                                            ${(window.appConfig?.areas || [])
                                              .map((area) => `<option value="${escapeHtml(area.key)}" ${recentState.area === area.key ? "selected" : ""}>${displayLabel(area)}</option>`)
                                              .join("")}
                                        </select>
                                    </th>
                                    <th class="type-col">
                                        <select id="recentTypeFilter" class="th-filter" aria-label="Filter by type">
                                            <option value="">Type ▾</option>
                                            ${(window.appConfig?.entryTypes || [])
                                              .map((type) => `<option value="${escapeHtml(type.key)}" ${recentState.type === type.key ? "selected" : ""}>${displayLabel(type)}</option>`)
                                              .join("")}
                                        </select>
                                    </th>
                                    <th class="title-col">Title</th>
                                    <th class="content-col">Content</th>
                                    <th class="time-col" aria-sort="${recentState.order === "asc" ? "ascending" : "descending"}">
                                        <button type="button" id="recentTimeSort" class="th-sort" data-order="${recentState.order}" title="Sort by date">Time ${recentState.order === "asc" ? "▲" : "▼"}</button>
                                    </th>
                                    <th class="actions-col">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="recentItemsBody">
                                ${renderRecentItems(items, recentState)}
                            </tbody>
                        </table>
                    </div>
                    </div>
                    
                    <div class="insights-section">
                        <h3 class="section-title">📊 Your Insights</h3>
                        <div class="insights-grid">
                            <div class="insight-card">
                                <div class="insight-icon">🔥</div>
                                <div class="insight-content">
                                    <div class="insight-value">${getTodayStreak(items)}</div>
                                    <div class="insight-label">Day Streak</div>
                                </div>
                            </div>
                            <div class="insight-card">
                                <div class="insight-icon">${getTypeEmoji(stats.mostUsedType)}</div>
                                <div class="insight-content">
                                    <div class="insight-value">${escapeHtml(getTypeLabel(stats.mostUsedType))}</div>
                                    <div class="insight-label">Top Type</div>
                                </div>
                            </div>
                            <div class="insight-card">
                                <div class="insight-icon">🎯</div>
                                <div class="insight-content">
                                    <div class="insight-value">${stats.productivityScore}</div>
                                    <div class="insight-label">This Week</div>
                                </div>
                            </div>
                            <div class="insight-card mood-insight">
                                <div class="insight-icon">${escapeHtml(stats.latestMood?.emoji || "🤔")}</div>
                                <div class="insight-content">
                                    <div class="insight-value">${escapeHtml(
                                      stats.latestMood?.secondary || stats.latestMood?.label || "No mood yet"
                                    )}</div>
                                    <div class="insight-label">Latest Mood</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `
                    : `
                    <div class="welcome-section">
                        <h3 class="section-title">🌟 Welcome to PowerLogger</h3>
                        <div class="welcome-cards">
                            <div class="welcome-card">
                                <div class="welcome-icon">📝</div>
                                <h4>Track Everything</h4>
                                <p>Notes, moods, tasks, and journals all in one place</p>
                            </div>
                            <div class="welcome-card">
                                <div class="welcome-icon">🧠</div>
                                <h4>Mood Insights</h4>
                                <p>Understand your emotions with our advanced mood tracking</p>
                            </div>
                            <div class="welcome-card">
                                <div class="welcome-icon">📊</div>
                                <h4>Personal Analytics</h4>
                                <p>Discover patterns and insights from your daily entries</p>
                            </div>
                        </div>
                    </div>
                `
                }
            </div>
        </div>
    `;

  // Banners
  document.getElementById("reminderLogMood")?.addEventListener("click", () => navigateTo("add", null, "mood"));
  document.getElementById("reminderDismiss")?.addEventListener("click", () => {
    dismissReminderToday();
    document.querySelector(".reminder-banner")?.remove();
  });
  document.getElementById("bannerBackup")?.addEventListener("click", () => {
    const count = downloadBackup();
    document.querySelector(".backup-banner")?.remove();
    notify(`✅ Backup downloaded (${count} entries). Keep the file somewhere safe, e.g. your cloud drive.`);
  });
  document.getElementById("bannerBackupLater")?.addEventListener("click", () => {
    backupBannerDismissed = true;
    document.querySelector(".backup-banner")?.remove();
  });

  // Event listeners
  document
    .getElementById("statsButton")
    ?.addEventListener("click", () => navigateTo("stats"));
  // New entry buttons: area falls back to the default area (personal)
  document.querySelectorAll(".quick-btn[data-type]").forEach((btn) => {
    btn.addEventListener("click", () => navigateTo("add", null, btn.dataset.type));
  });

  // Overdue banner: show the todos in Recent Items
  document.getElementById("showOverdue")?.addEventListener("click", () => {
    Object.assign(recentState, { area: "", type: "todo", query: "" });
    renderHomePage();
    document.querySelector(".recent-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Area / Type header filters, Time sort and search
  const areaFilter = document.getElementById("recentAreaFilter");
  const typeFilter = document.getElementById("recentTypeFilter");
  const timeSort = document.getElementById("recentTimeSort");
  const search = document.getElementById("recentSearch");
  areaFilter?.addEventListener("change", () => { recentState.area = areaFilter.value; applyRecentFilters(); });
  typeFilter?.addEventListener("change", () => { recentState.type = typeFilter.value; applyRecentFilters(); });
  // Time header: newest first (▼) <-> oldest first (▲)
  timeSort?.addEventListener("click", () => {
    recentState.order = recentState.order === "desc" ? "asc" : "desc";
    const desc = recentState.order === "desc";
    timeSort.dataset.order = recentState.order;
    timeSort.textContent = desc ? "Time ▼" : "Time ▲";
    timeSort.title = desc ? "Newest first (click for oldest first)" : "Oldest first (click for newest first)";
    timeSort.closest("th")?.setAttribute("aria-sort", desc ? "descending" : "ascending");
    applyRecentFilters();
  });
  let searchTimer = null;
  search?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { recentState.query = search.value; applyRecentFilters(); }, 150);
  });

  if (items.length > 0) applyRecentFilters();
}

/** Redraws the Recent Items rows from the stored entries and the current filters/search. */
function applyRecentFilters() {
  const tbody = document.getElementById("recentItemsBody");
  if (!tbody) return;
  const items = readItems();
  tbody.innerHTML = renderRecentItems(items, recentState);
  document.getElementById("recentAreaFilter")?.classList.toggle("active", !!recentState.area);
  document.getElementById("recentTypeFilter")?.classList.toggle("active", !!recentState.type);
  document.getElementById("recentSearch")?.classList.toggle("active", !!recentState.query.trim());
  const shown = tbody.querySelectorAll("tr[data-id]").length;
  const count = document.getElementById("recentCount");
  if (count) count.textContent = shown === items.length ? `(${items.length})` : `(${shown} of ${items.length})`;
  attachItemEventListeners(); // Re-attach listeners after content update
}

// Helper functions
// Helper functions
const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** Average happiness -> a fitting emoji */
function moodEmojiFor(avg) {
  if (avg >= 80) return "😄";
  if (avg >= 60) return "🙂";
  if (avg >= 40) return "😐";
  if (avg >= 20) return "🙁";
  return "😞";
}

/**
 * Mood streak (consecutive days with at least one mood, ending today, or
 * yesterday if nothing is logged yet today), average mood of the last 7 days
 * and the change compared with the 7 days before.
 */
function getWeeklyMoodSummary(items) {
  const moods = items.filter((item) => item.type === "mood" && item.mood);
  const moodDays = new Set(moods.map((m) => dayKey(new Date(m.createdAt))));

  let streak = 0;
  const day = new Date();
  if (!moodDays.has(dayKey(day))) day.setDate(day.getDate() - 1); // today still open
  while (moodDays.has(dayKey(day))) {
    streak++;
    day.setDate(day.getDate() - 1);
  }

  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const average = (list) =>
    list.length ? Math.round(list.reduce((sum, m) => sum + (Number(m.mood.happiness) || 0), 0) / list.length) : null;
  const thisWeek = moods.filter((m) => now - new Date(m.createdAt) < WEEK);
  const lastWeek = moods.filter((m) => {
    const age = now - new Date(m.createdAt);
    return age >= WEEK && age < 2 * WEEK;
  });

  const avgThisWeek = average(thisWeek);
  const avgLastWeek = average(lastWeek);
  return {
    streak,
    moodsThisWeek: thisWeek.length,
    avgThisWeek,
    avgEmoji: avgThisWeek === null ? "" : moodEmojiFor(avgThisWeek),
    change: avgThisWeek !== null && avgLastWeek !== null ? avgThisWeek - avgLastWeek : null,
  };
}

function getTodayItems(items) {
  const today = new Date().toDateString();
  return items.filter(
    (item) => new Date(item.createdAt).toDateString() === today
  );
}

function getTypeEmoji(type) {
  if (!window.appConfig?.entryTypes) return "📄";
  const typeConfig = window.appConfig.entryTypes.find((t) => t.key === type);
  return typeConfig?.emoji || "📄";
}

function getTypeLabel(type) {
  const typeConfig = window.appConfig?.entryTypes?.find((t) => t.key === type);
  return typeConfig?.label || type || "None";
}

function getAreaLabel(area) {
  const areaConfig = window.appConfig?.areas?.find((a) => a.key === area);
  return areaConfig?.label || area || "";
}

function getAreaEmoji(area) {
  if (!window.appConfig?.areas) return "📁";
  const areaConfig = window.appConfig.areas.find((a) => a.key === area);
  return areaConfig?.emoji || "📁";
}

/** Todos that still need doing (not DONE or CANCELLED) */
function getPendingTodos(items) {
  return items.filter((item) => item.type === "todo" && !isFinishedTodo(item));
}

/** "due today", "2 days overdue", "due in 3 days" for a todo deadline */
function describeDeadline(item) {
  if (!item.deadline || item.deadline === "NO_DEADLINE") return "";
  const due = new Date(item.deadline);
  if (Number.isNaN(due.getTime())) return "";
  const DAY = 24 * 60 * 60 * 1000;
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(due) - startOfDay(new Date())) / DAY);
  if (isOverdue(item)) {
    return days < 0 ? `${-days} day${days === -1 ? "" : "s"} overdue` : "overdue";
  }
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return days > 1 ? `due in ${days} days` : "";
}

/**
 * Rows for Recent Items: filtered by { area, type, query }, sorted by date
 * (order "desc" = newest first).
 */
function renderRecentItems(items, { area = "", type = "", order = "desc", query = "" } = {}) {
  const filteredItems = items.filter(
    (item) => (!area || item.area === area) && (!type || item.type === type) && matchesSearch(item, query)
  );

  if (filteredItems.length === 0) {
    return `<tr class="empty-row"><td colspan="6">${query.trim() ? "Nothing found for this search." : "No items match these filters."}</td></tr>`;
  }

  return [...filteredItems]
    .sort((a, b) => (new Date(b.createdAt) - new Date(a.createdAt)) * (order === "asc" ? -1 : 1))
    .map((item) => {
      const isTodo = item.type === "todo";
      const done = isTodo && item.status === "DONE";
      const overdue = isOverdue(item);
      const deadlineText = isTodo && !isFinishedTodo(item) ? describeDeadline(item) : "";
      const rowClass = [done ? "todo-done" : "", overdue ? "todo-overdue" : ""].filter(Boolean).join(" ");
      return `
            <tr data-id="${item.id}"${rowClass ? ` class="${rowClass}"` : ""}>
                <td class="area-cell" title="${escapeHtml(getAreaLabel(item.area))}">${getAreaEmoji(item.area)}</td>
                <td class="type-cell" title="${escapeHtml(getTypeLabel(item.type))}">${getTypeEmoji(item.type)}</td>
                <td class="title-cell">
                    <button class="title-link" data-id="${item.id}" title="Open to edit">
                        ${escapeHtml(
                          item.type === "mood"
                            ? (item.mood?.emoji || "🤔") + " " + (item.mood?.secondary || "Mood")
                            : item.title
                        )}
                    </button>
                    ${deadlineText ? `<span class="deadline-badge${overdue ? " overdue" : ""}">⏰ ${deadlineText}</span>` : ""}
                </td>
                <td class="content-cell" title="${escapeHtml(item.content)}">${escapeHtml((item.content || "").replace(/\s+/g, " "))}</td>
                <td class="date-cell">${getTimeAgo(item.createdAt)}</td>
                <td class="actions-cell">
                    ${isTodo ? `<button type="button" class="todo-done-btn btn-sm${done ? " checked" : ""}" data-id="${item.id}"
                        aria-pressed="${done}" title="${done ? "Done (click to reopen)" : "Mark as done"}">${done ? "☑" : "☐"}</button>` : ""}
                    <button type="button" class="delete-item btn-sm" data-id="${item.id}" title="Delete">×</button>
                </td>
            </tr>`;
    })
    .join("");
}

function attachItemEventListeners() {
  document.querySelectorAll(".delete-item").forEach((button) => {
    button.addEventListener("click", async function (e) {
      e.stopPropagation();
      const itemId = parseInt(this.dataset.id);
      if (await confirmDialog("Delete this item?", { okLabel: "Delete", danger: true })) {
        const removed = deleteItem(itemId);
        if (!removed) return;
        renderHomePage();
        notify("🗑️ Item deleted.", {
          action: { label: "Undo", onClick: () => { restoreItem(removed); refreshCurrentPage(); notify("↩️ Item restored."); } },
        });
      }
    });
  });

  // Tick a todo done (or reopen it)
  document.querySelectorAll(".todo-done-btn").forEach((button) => {
    button.addEventListener("click", function (e) {
      e.stopPropagation();
      const status = toggleTodoDone(parseInt(this.dataset.id));
      if (!status) return;
      renderHomePage(); // updates the row, the pending count and the overdue banner
      notify(status === "DONE" ? "✅ Todo done." : "↩️ Todo reopened.");
    });
  });

  // Clicking a title opens the item in the edit page
  document.querySelectorAll(".title-link").forEach((button) => {
    button.addEventListener("click", function (e) {
      e.stopPropagation();
      const itemId = parseInt(this.dataset.id);
      navigateTo("edit", itemId);
    });
  });
}
