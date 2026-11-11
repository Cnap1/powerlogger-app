// src/pages/app-settings.js - Settings page

import { navigateTo } from "../utils/app-navigation.js";
import { displayLabel, escapeHtml } from "../utils/common.js";
import { validateConfig } from "../utils/data-validation.js";
import { createMockData } from "../utils/create-mockdata.js";
import { downloadFile, generateLogseqExport, generateMarkdownExport } from "../utils/data-processing.js";
import { downloadBackup, describeLastBackup, backupIsDue, parseBackup, restoreBackup, USER_CONFIG_KEY } from "../utils/backup.js";
import { getReminderSettings, saveReminderSettings, requestReminderPermission } from "../utils/reminder.js";
import { notify, confirmDialog } from "../components/dialog.js";

// Export formats that are actually implemented
const EXPORT_FORMATS = [
  { value: "json", label: "JSON (all fields)" },
  { value: "markdown", label: "Markdown (Obsidian-friendly)" },
  { value: "logseq", label: "Logseq" },
];

// Settings-page limits
const MAX_AREAS = 5;
const MAX_TYPES = 8;

/**
 * Renders the application settings page.
 */
export async function renderSettingsPage() {
  const app = document.getElementById("app");
  if (!app) {
    console.error("App container not found");
    return;
  }

  // The config loaded at startup (saved settings or appconfig.json)
  const localConfig =
    JSON.parse(localStorage.getItem("localAppConfig")) || window.appConfig;
  const reminder = getReminderSettings();
  const backupDue = backupIsDue();

  app.innerHTML = `
        <div class="container">
            <div class="settings-header">
                <h1>Settings</h1>
            </div>

            <form id="settingsForm" novalidate>
                <div class="settings-section${backupDue ? "" : " collapsed"}">
                    <h2>💾 Backup &amp; Restore</h2>
                    <div class="settings-content${backupDue ? "" : " collapsed"}">
                        <p class="backup-status${backupDue ? " due" : ""}">
                            Last backup: <strong id="lastBackupText">${describeLastBackup()}</strong>
                            ${backupDue ? " - your data only lives in this browser, download a backup." : ""}
                        </p>
                        <div class="backup-actions">
                            <button type="button" id="downloadBackupBtn" class="btn btn-primary">⬇️ Download backup</button>
                            <button type="button" id="restoreBackupBtn" class="btn btn-secondary">⬆️ Restore from file</button>
                            <input type="file" id="restoreFileInput" accept="application/json,.json" hidden>
                        </div>
                        <label class="backup-option">
                            <input type="checkbox" id="restoreReplace">
                            Replace my current entries (instead of adding the missing ones)
                        </label>
                        <label class="backup-option">
                            <input type="checkbox" id="restoreSettings">
                            Also restore settings from the backup
                        </label>
                    </div>
                </div>

                <div class="settings-section collapsed">
                    <h2>⏰ Daily Mood Reminder</h2>
                    <div class="settings-content collapsed">
                        <label class="backup-option">
                            <input type="checkbox" id="reminderEnabled" ${reminder.enabled ? "checked" : ""}>
                            Remind me to log my mood every day
                        </label>
                        <div class="setting-row">
                            <label class="setting-label" for="reminderTime">At:</label>
                            <input type="time" id="reminderTime" class="setting-input" value="${escapeHtml(reminder.time)}">
                        </div>
                        <p class="help-text">
                            Shows a reminder on the home page after this time if you haven't logged a mood today,
                            and a notification while PowerLogger is open (if you allow notifications).
                        </p>
                    </div>
                </div>


                <div class="settings-section collapsed">
                    <h2>Development Tools</h2>
                    <div class="settings-content collapsed">
                        <div class="dev-tools">
                            <button type="button" id="generateMockBtn" class="btn btn-info">Generate 500 Mock Entries</button>
                            <button type="button" id="clearDataBtn" class="btn btn-warning">Clear All Data</button>
                        </div>
                    </div>
                </div>
                
                <div class="settings-section collapsed">
                    <h2>Areas (Max ${MAX_AREAS}, Min 1)</h2>
                    <div class="settings-content collapsed">
                        <div class="settings-grid">
                            ${localConfig.areas
                              .map(
                                (area, index) => `
                                <div class="setting-row">
                                    <label class="setting-label">${
                                      area.label
                                    }</label>
                                    <input type="text" 
                                           class="area-input setting-input" 
                                           data-index="${index}" 
                                           value="${escapeHtml(plainName(area))}" 
                                           pattern="[A-Za-z \\-]+" 
                                           title="Letters, spaces and hyphens"
                                           required>
                                    ${
                                      localConfig.areas.length > 1
                                        ? `<button type="button" class="remove-btn" data-type="area" data-index="${index}">×</button>`
                                        : ""
                                    }
                                </div>
                            `
                              )
                              .join("")}
                            ${
                              localConfig.areas.length < MAX_AREAS
                                ? `<button type="button" id="addAreaBtn" class="btn btn-secondary btn-small">+ Add Area</button>`
                                : ""
                            }
                        </div>
                    </div>
                </div>
                
                <div class="settings-section collapsed">
                    <h2>Categories by Area</h2>
                    <div class="settings-content collapsed">
                        ${localConfig.areas
                          .map(
                            (area) => `
                            <div class="category-area-section">
                                <h3 class="collapsed">${displayLabel(area)} Categories</h3>
                                <div class="category-content collapsed">
                                    <div class="settings-grid">
                                        ${(
                                          localConfig.categoriesByArea[
                                            area.key
                                          ] || []
                                        )
                                          .map(
                                            (category, index) => `
                                            <div class="setting-row">
                                                <label class="setting-label">${
                                                  category.label || category
                                                }</label>
                                                <input type="text" 
                                                       class="category-input setting-input" 
                                                       data-area="${area.key}" 
                                                       data-index="${index}" 
                                                       value="${escapeHtml(plainName(category))}" 
                                                       pattern="[A-Za-z \\-]+" 
                                                       title="Letters, spaces and hyphens"
                                                       required>
                                                <button type="button" class="remove-btn" data-type="category" data-area="${
                                                  area.key
                                                }" data-index="${index}">×</button>
                                            </div>
                                        `
                                          )
                                          .join("")}
                                        <button type="button" class="add-category-btn btn btn-secondary btn-small" data-area="${
                                          area.key
                                        }">+ Add Category</button>
                                    </div>
                                </div>
                            </div>
                        `
                          )
                          .join("")}
                    </div>
                </div>

                <div class="settings-section collapsed">
                    <h2>Entry Types (Max ${MAX_TYPES}, Min 1)</h2>
                    <div class="settings-content collapsed">
                        <div class="settings-grid">
                            ${localConfig.entryTypes
                              .map(
                                (type, index) => `
                                <div class="setting-row">
                                    <label class="setting-label">${
                                      type.label
                                    }</label>
                                    <input type="text" 
                                        class="type-input setting-input" 
                                        data-index="${index}" 
                                        value="${escapeHtml(plainName(type))}" 
                                        pattern="[A-Za-z \\-]+" 
                                        title="Letters, spaces and hyphens"
                                        required>
                                    ${
                                      localConfig.entryTypes.length > 1
                                        ? `<button type="button" class="remove-btn" data-type="type" data-index="${index}">×</button>`
                                        : ""
                                    }
                                </div>
                            `
                              )
                              .join("")}
                            ${
                              localConfig.entryTypes.length < MAX_TYPES
                                ? `<button type="button" id="addTypeBtn" class="btn btn-secondary btn-small">+ Add Type</button>`
                                : ""
                            }
                        </div>
                    </div>
                </div>

                
                <div class="settings-section collapsed">
                    <h2>Export Options</h2>
                    <div class="settings-content collapsed">
                        <div class="export-grid">
                            ${EXPORT_FORMATS.map(
                              (f, index) => `
                                    <label class="export-item">
                                        <input type="checkbox" value="${f.value}" ${index === 0 ? "checked" : ""}>
                                        ${f.label}
                                    </label>`
                            ).join("")}
                        </div>
                        <p class="help-text">Exports contain all your entries. To move your data to another browser, use Backup &amp; Restore.</p>
                        <button type="button" id="exportDataBtn" class="btn btn-primary">Export Data</button>
                    </div>
                </div>

                <div class="form-actions settings-save-bar">
                    <button type="button" id="resetSettingsBtn" class="btn btn-warning">Reset to Default</button>
                    <span id="unsavedNote" class="unsaved-note" hidden>● Unsaved changes</span>
                    <button type="submit" class="btn btn-primary">Save Settings</button>
                </div>
            </form>
        </div>
    `;

  initializeSettingsHandlers(localConfig);
}

function initializeCollapsible() {
  // Main sections
  document.querySelectorAll(".settings-section h2").forEach((header) => {
    header.addEventListener("click", function () {
      const section = this.parentElement;
      const content = section.querySelector(".settings-content");

      if (content) {
        section.classList.toggle("collapsed");
        content.classList.toggle("collapsed");
      }
    });
  });

  // Category subsections
  document
    .querySelectorAll(".category-area-section h3")
    .forEach((header) => {
      header.addEventListener("click", function () {
        const content = header.nextElementSibling;
        if (
          content &&
          content.classList.contains("category-content")
        ) {
          header.classList.toggle("collapsed");
          content.classList.toggle("collapsed");
        }
      });
    });
}

// Call this in initializeSettingsHandlers

function initializeSettingsHandlers(localConfig) {
  // Back/menu navigation is handled by the shared top bar (components/top-nav.js)
  initializeCollapsible();

  // Add area button
  document.getElementById("addAreaBtn")?.addEventListener("click", function () {
    if (document.querySelectorAll(".area-input").length >= MAX_AREAS) return;

    const settingsGrid = this.parentElement;
    const newIndex = document.querySelectorAll(".area-input").length;

    const newRow = document.createElement("div");
    newRow.className = "setting-row";
    newRow.innerHTML = `
            <label class="setting-label">New Area</label>
            <input type="text" class="area-input setting-input" data-index="${newIndex}" value="" pattern="[A-Za-z \\-]+" title="Letters, spaces and hyphens" required>
            <button type="button" class="remove-btn" data-type="area" data-index="${newIndex}">×</button>
        `;

    settingsGrid.insertBefore(newRow, this);
    newRow.querySelector(".remove-btn").addEventListener("click", removeItem);

    if (document.querySelectorAll(".area-input").length >= MAX_AREAS) {
      this.style.display = "none";
    }
  });

  // Add type button
  document.getElementById("addTypeBtn")?.addEventListener("click", function () {
    if (document.querySelectorAll(".type-input").length >= MAX_TYPES) return;

    const settingsGrid = this.parentElement;
    const newIndex = document.querySelectorAll(".type-input").length;

    const newRow = document.createElement("div");
    newRow.className = "setting-row";
    newRow.innerHTML = `
            <label class="setting-label">New Type</label>
            <input type="text" class="type-input setting-input" data-index="${newIndex}" value="" pattern="[A-Za-z \\-]+" title="Letters, spaces and hyphens" required>
            <button type="button" class="remove-btn" data-type="type" data-index="${newIndex}">×</button>
        `;

    settingsGrid.insertBefore(newRow, this);
    newRow.querySelector(".remove-btn").addEventListener("click", removeItem);

    if (document.querySelectorAll(".type-input").length >= MAX_TYPES) {
      this.style.display = "none";
    }
  });

  // Add category buttons
  document.querySelectorAll(".add-category-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const area = this.dataset.area;
      const settingsGrid = this.parentElement;
      const newIndex = settingsGrid.querySelectorAll(".category-input").length;

      const newRow = document.createElement("div");
      newRow.className = "setting-row";
      newRow.innerHTML = `
                <label class="setting-label">New Category</label>
                <input type="text" class="category-input setting-input" data-area="${area}" data-index="${newIndex}" value="" pattern="[A-Za-z \\-]+" title="Letters, spaces and hyphens" required>
                <button type="button" class="remove-btn" data-type="category" data-area="${area}" data-index="${newIndex}">×</button>
            `;

      settingsGrid.insertBefore(newRow, this);
      newRow.querySelector(".remove-btn").addEventListener("click", removeItem);
    });
  });

  // Remove item functionality
  function removeItem() {
    const type = this.dataset.type;

    if (
      type === "area" &&
      document.querySelectorAll(".area-input").length <= 1
    ) {
      notify("You must have at least one area.");
      return;
    }

    if (
      type === "type" &&
      document.querySelectorAll(".type-input").length <= 1
    ) {
      notify("You must have at least one entry type.");
      return;
    }

    this.parentElement.remove();

    // Show add buttons if below max
    if (
      type === "area" &&
      document.querySelectorAll(".area-input").length < MAX_AREAS
    ) {
      const addBtn = document.getElementById("addAreaBtn");
      if (addBtn) addBtn.style.display = "block";
    }

    if (
      type === "type" &&
      document.querySelectorAll(".type-input").length < MAX_TYPES
    ) {
      const addBtn = document.getElementById("addTypeBtn");
      if (addBtn) addBtn.style.display = "block";
    }
  }

  // Add event listeners to existing remove buttons
  document.querySelectorAll(".remove-btn").forEach((button) => {
    button.addEventListener("click", removeItem);
  });

  // ===== Export =====
  document.getElementById("exportDataBtn").addEventListener("click", function () {
    const items = JSON.parse(localStorage.getItem("logseqItems") || "[]");
    if (items.length === 0) {
      notify("No data to export!");
      return;
    }

    const checkedFormats = Array.from(
      document.querySelectorAll(".export-grid input:checked")
    ).map((cb) => cb.value);

    if (checkedFormats.length === 0) {
      notify("Please select at least one export format!");
      return;
    }

    const stamp = new Date().toISOString().slice(0, 10);
    checkedFormats.forEach((format) => {
      switch (format) {
        case "json":
          downloadFile(JSON.stringify(items, null, 2), `powerlogger-export-${stamp}.json`, "application/json");
          break;
        case "markdown":
          downloadFile(generateMarkdownExport(items, localConfig), `powerlogger-export-${stamp}.md`, "text/markdown");
          break;
        case "logseq":
          downloadFile(generateLogseqExport(items), `powerlogger-logseq-${stamp}.json`, "application/json");
          break;
      }
    });
  });

  // ===== Backup & restore =====
  document.getElementById("downloadBackupBtn").addEventListener("click", () => {
    const count = downloadBackup();
    document.getElementById("lastBackupText").textContent = describeLastBackup();
    document.querySelector(".backup-status")?.classList.remove("due");
    notify(`✅ Backup downloaded (${count} entries). Keep the file somewhere safe, e.g. your cloud drive.`);
  });

  const restoreInput = document.getElementById("restoreFileInput");
  document.getElementById("restoreBackupBtn").addEventListener("click", () => restoreInput.click());
  restoreInput.addEventListener("change", async () => {
    const file = restoreInput.files?.[0];
    restoreInput.value = ""; // allow picking the same file again
    if (!file) return;

    let backup;
    try {
      backup = parseBackup(await file.text());
    } catch (error) {
      notify(`❌ Could not read "${file.name}": ${error.message}`);
      return;
    }

    const replace = document.getElementById("restoreReplace").checked;
    const restoreSettings = document.getElementById("restoreSettings").checked && Boolean(backup.config);
    const question = replace
      ? `Replace ALL your current entries with the ${backup.items.length} entries from "${file.name}"?\n\nYour current entries will be removed.`
      : `Add the entries from "${file.name}" that you don't have yet?\n(${backup.items.length} entries in the file)`;
    const ok = await confirmDialog(question + (restoreSettings ? "\n\nSettings will also be restored." : ""), {
      okLabel: replace ? "Replace" : "Restore",
      danger: replace,
    });
    if (!ok) return;

    try {
      const result = restoreBackup(backup, { replace, restoreSettings });
      const skipped = backup.skipped ? `\n${backup.skipped} invalid entries were skipped.` : "";
      notify(`✅ Restored: ${result.added} entries added, ${result.kept} already present. You now have ${result.total} entries.${skipped}`);
      if (restoreSettings) location.reload();
      else navigateTo("home");
    } catch (error) {
      console.error("Restore failed:", error);
      notify(
        error.name === "QuotaExceededError"
          ? "❌ Browser storage is full; the backup could not be restored."
          : `❌ Restore failed: ${error.message}`
      );
    }
  });

  // ===== Daily mood reminder =====
  const reminderEnabled = document.getElementById("reminderEnabled");
  const reminderTime = document.getElementById("reminderTime");
  const saveReminder = async () => {
    saveReminderSettings({ enabled: reminderEnabled.checked, time: reminderTime.value });
    if (reminderEnabled.checked) {
      const permission = await requestReminderPermission();
      if (permission === "denied") {
        notify("Notifications are blocked for this site, so you'll only see the reminder on the home page.");
      }
    }
  };
  reminderEnabled.addEventListener("change", saveReminder);
  reminderTime.addEventListener("change", saveReminder);

  // ===== Reset to default =====
  document.getElementById("resetSettingsBtn").addEventListener("click", async function () {
    if (await confirmDialog("Reset all settings to the defaults from appconfig.json? Your entries are kept.", { okLabel: "Reset", danger: true })) {
      localStorage.removeItem(USER_CONFIG_KEY);
      localStorage.removeItem("localAppConfig");
      notify("Settings reset to default!");
      location.reload();
    }
  });

  // ===== Mock data =====
  document.getElementById("generateMockBtn").addEventListener("click", async function () {
    if (!(await confirmDialog("Generate 500 random entries? They are added to your existing data.", { okLabel: "Generate" }))) {
      return;
    }
    try {
      const mockItems = createMockData(500);
      const existing = JSON.parse(localStorage.getItem("logseqItems") || "[]");
      const allItems = [...mockItems, ...existing].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      localStorage.setItem("logseqItems", JSON.stringify(allItems));
      notify(`✅ Added ${mockItems.length} mock entries (${allItems.length} in total).`);
    } catch (error) {
      console.error("Mock data generation failed:", error);
      notify(
        error.name === "QuotaExceededError"
          ? "❌ Browser storage is full; clear some data first."
          : "❌ Could not generate mock data."
      );
    }
  });

  // ===== Clear all data =====
  document.getElementById("clearDataBtn").addEventListener("click", async function () {
    if (await confirmDialog("Clear ALL entries? This cannot be undone!\n\nTip: download a backup first.", { okLabel: "Clear all", danger: true })) {
      localStorage.removeItem("logseqItems");
      notify("All data cleared!");
      navigateTo("home");
    }
  });

  // ===== Unsaved changes indicator =====
  // Only the fields that "Save Settings" stores (backup and reminder save themselves)
  const settingsForm = document.getElementById("settingsForm");
  const markDirty = () => {
    const note = document.getElementById("unsavedNote");
    if (note) note.hidden = false;
    settingsForm.classList.add("dirty");
  };
  const SAVED_FIELDS = ".area-input, .type-input, .category-input";
  settingsForm.addEventListener("input", (e) => { if (e.target.matches(SAVED_FIELDS)) markDirty(); });
  settingsForm.addEventListener("change", (e) => { if (e.target.matches(SAVED_FIELDS)) markDirty(); });
  settingsForm.addEventListener("click", (e) => {
    if (e.target.closest(".remove-btn, .add-category-btn, #addAreaBtn, #addTypeBtn")) markDirty();
  });

  // ===== Save settings =====
  settingsForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const result = buildConfigFromForm(localConfig);
    if (result.error) {
      notify(`❌ ${result.error}`);
      return;
    }

    try {
      validateConfig(result.config);
    } catch (error) {
      notify(`❌ These settings are not valid: ${error.message}`);
      return;
    }

    // Renamed areas/types: update the entries that use the old key
    const renamedCount = applyRenamesToItems(result.renames);

    localStorage.setItem(USER_CONFIG_KEY, JSON.stringify(result.config));
    localStorage.setItem("localAppConfig", JSON.stringify(result.config));
    window.appConfig = result.config;
    notify(`✅ Settings saved!${renamedCount ? `\n${renamedCount} entries were updated to the new names.` : ""}`);
    navigateTo("home");
  });
}

/**
 * Builds a config from the settings form, keeping the labels/emoji of
 * existing areas, types and categories (matched by their original key).
 * @returns {{config?: object, error?: string}}
 */
export function buildConfigFromForm(localConfig) {
  // The inputs hold the visible name ("Relationships"). Unchanged names keep the
  // entry as it is; a changed name becomes the new label, and the internal key
  // follows it (lowercase letters), so stored entries are migrated on rename.
  const toKey = (name) => name.toLowerCase().replace(/[^a-z]/g, "");
  const toCategoryKey = (name) => name.toLowerCase().replace(/[^a-z\s-]/g, "").trim().replace(/\s+/g, "-");
  const tidy = (name) => name.trim().replace(/\s+/g, " ").replace(/^./, (c) => c.toUpperCase());

  const readRows = (selector, originals) =>
    Array.from(document.querySelectorAll(selector))
      .map((input) => ({ name: tidy(input.value), original: originals[Number(input.dataset.index)] }))
      .filter((row) => row.name !== "")
      .map((row) => {
        const unchanged = row.original && plainName(row.original) === row.name;
        return { ...row, unchanged, key: unchanged ? row.original.key : toKey(row.name) };
      });

  // data-index points at the original area/type (renames keep its categories)
  const areaRows = readRows(".area-input", localConfig.areas);
  const typeRows = readRows(".type-input", localConfig.entryTypes);

  if (areaRows.length === 0) return { error: "You must have at least one area." };
  if (typeRows.length === 0) return { error: "You must have at least one entry type." };
  if (areaRows.length > MAX_AREAS) return { error: `At most ${MAX_AREAS} areas.` };
  if (typeRows.length > MAX_TYPES) return { error: `At most ${MAX_TYPES} entry types.` };

  const badName = [...areaRows, ...typeRows].find((row) => !row.key);
  if (badName) return { error: `"${badName.name}" is not valid: use letters (a-z).` };
  const duplicate = (rows) => rows.find((row, i) => rows.findIndex((r) => r.key === row.key) !== i);
  if (duplicate(areaRows)) return { error: `Area "${duplicate(areaRows).name}" is listed twice.` };
  if (duplicate(typeRows)) return { error: `Type "${duplicate(typeRows).name}" is listed twice.` };

  const toEntry = ({ key, name, original, unchanged }, defaultEmoji) =>
    unchanged ? original : { ...(original || {}), key, label: name, emoji: original?.emoji || defaultEmoji };
  const areas = areaRows.map((row) => toEntry(row, "📁"));
  const entryTypes = typeRows.map((row) => toEntry(row, "📝"));

  // Categories: inputs are tagged with the area's original key
  const categoriesByArea = {};
  const categoryRenames = []; // {area, from, to} for renamed categories
  for (const { key, original } of areaRows) {
    const sourceKey = original?.key ?? key;
    const existing = localConfig.categoriesByArea?.[sourceKey] || [];
    const categories = Array.from(document.querySelectorAll(`.category-input[data-area="${sourceKey}"]`))
      .map((input) => ({
        name: tidy(input.value),
        // data-index points at the original category (new rows point past the end)
        original: existing[Number(input.dataset.index)],
      }))
      .filter(({ name }) => name !== "")
      .map(({ name, original }) => {
        if (original && plainName(original) === name) {
          return typeof original === "object" ? original : { key: original, label: name };
        }
        // Renamed (or new): keep the old emoji in front of the new name
        const catKey = toCategoryKey(name);
        const emoji = typeof original === "object" ? original.emoji || emojiPrefix(original.label) : "";
        const origKey = original?.key ?? original;
        if (origKey && origKey !== catKey) categoryRenames.push({ area: key, from: origKey, to: catKey });
        return emoji ? { key: catKey, label: `${emoji} ${name}`, emoji } : { key: catKey, label: name };
      })
      .filter((cat) => cat.key);
    // Every area needs at least one category
    categoriesByArea[key] = categories.length ? categories : [{ key: "general", label: "📌 General" }];
  }

  // old key -> new key, for areas/types that were renamed
  const renameMap = (rows) =>
    Object.fromEntries(
      rows.filter(({ key, original }) => original && original.key !== key).map(({ key, original }) => [original.key, key])
    );

  return {
    config: {
      ...withoutSubcategories(localConfig),
      areas,
      entryTypes,
      categoriesByArea,
    },
    renames: { area: renameMap(areaRows), type: renameMap(typeRows), category: categoryRenames },
  };
}

/** Updates stored entries for renamed areas, types and categories. Returns how many entries changed. */
export function applyRenamesToItems(renames) {
  const categoryRenames = renames?.category || [];
  if (!renames || (!Object.keys(renames.area).length && !Object.keys(renames.type).length && !categoryRenames.length)) return 0;
  const items = JSON.parse(localStorage.getItem("logseqItems") || "[]");
  let changed = 0;
  items.forEach((item) => {
    const area = renames.area[item.area];
    const type = renames.type[item.type];
    if (area || type) {
      if (area) item.area = area;
      if (type) item.type = type;
      changed++;
    }
    // Renamed category (matched on the area, after any area rename)
    const cat = categoryRenames.find((r) => r.area === item.area && r.from === item.category);
    if (cat) {
      item.category = cat.to;
      if (!area && !type) changed++;
    }
  });
  if (changed) localStorage.setItem("logseqItems", JSON.stringify(items));
  return changed;
}

// Subcategories were removed from the app; drop them from older saved configs
function withoutSubcategories(config) {
  const { subcategories, ...rest } = config;
  return rest;
}

// Leading emoji/symbols of a label ("💭 Thought" -> "💭"), or "" when there are none
function emojiPrefix(label) {
  return String(label ?? "").match(/^[^\p{L}\p{N}]*/u)[0].trim();
}

/** Name shown in the settings inputs: the label without its emoji ("💭 Thought" -> "Thought"). */
function plainName(entry) {
  const label = typeof entry === "object" ? entry?.label ?? entry?.key : entry;
  const text = String(label ?? "");
  return text.slice(text.match(/^[^\p{L}\p{N}]*/u)[0].length).trim() || text.trim();
}
