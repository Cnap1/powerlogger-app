// Backup & restore of all PowerLogger data (items + settings) as one JSON file.
import { downloadFile } from "./data-processing.js";
import { validateConfig, normalizeItemKeys } from "./data-validation.js";

const ITEMS_KEY = "logseqItems";
export const USER_CONFIG_KEY = "powerloggerUserConfig"; // settings saved by the user (see app.js)
const LAST_BACKUP_KEY = "powerloggerLastBackup";
const BACKUP_FORMAT = "powerlogger-backup";
export const BACKUP_REMINDER_DAYS = 14;

function readItems() {
  try {
    return JSON.parse(localStorage.getItem(ITEMS_KEY) || "[]");
  } catch {
    return [];
  }
}

/** Builds the backup object (all items + current settings). */
export function createBackup() {
  // The settings currently in use (user settings, or appconfig.json defaults)
  const config = window.appConfig || null;
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    items: readItems(),
    config,
  };
}

/** Downloads a backup file and remembers when it was made. */
export function downloadBackup() {
  const backup = createBackup();
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(JSON.stringify(backup, null, 2), `powerlogger-backup-${stamp}.json`, "application/json");
  localStorage.setItem(LAST_BACKUP_KEY, backup.exportedAt);
  return backup.items.length;
}

/** Date of the last backup, or null */
export function getLastBackupDate() {
  const value = localStorage.getItem(LAST_BACKUP_KEY);
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/** Whole days since the last backup (Infinity if never) */
export function daysSinceBackup() {
  const last = getLastBackupDate();
  return last ? Math.floor((Date.now() - last.getTime()) / 86400000) : Infinity;
}

/** "today", "3 days ago", "never" */
export function describeLastBackup() {
  const days = daysSinceBackup();
  if (days === Infinity) return "never";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** Days between backup reminders: 14 with auto-save to a file, daily without it. */
export function backupReminderDays() {
  return localStorage.getItem("powerloggerAutosave") ? BACKUP_REMINDER_DAYS : 1;
}

/** True when there is data and the last backup is missing or older than the reminder period */
export function backupIsDue() {
  return readItems().length > 0 && daysSinceBackup() >= backupReminderDays();
}

/**
 * Parses and checks a backup file's text.
 * Accepts a PowerLogger backup ({format, items, config}) or a plain array of items
 * (e.g. the JSON export).
 * @returns {{items: object[], config: object|null}}
 */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }

  const items = Array.isArray(data) ? data : data?.items;
  if (!Array.isArray(items)) {
    throw new Error("No entries found in this file. Is it a PowerLogger backup?");
  }

  const valid = items.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      item.id !== undefined &&
      typeof item.type === "string" &&
      !Number.isNaN(new Date(item.createdAt).getTime())
  );
  if (items.length > 0 && valid.length === 0) {
    throw new Error("The entries in this file are not in PowerLogger format.");
  }

  let config = Array.isArray(data) ? null : data?.config || null;
  if (config) {
    try {
      validateConfig(config);
    } catch {
      config = null; // ignore broken settings, still restore the entries
    }
  }

  return { items: valid, config, skipped: items.length - valid.length };
}

/**
 * Restores a parsed backup.
 * @param {{items: object[], config: object|null}} backup
 * @param {object} options
 * @param {boolean} [options.replace=false] - Replace all current entries instead of merging.
 * @param {boolean} [options.restoreSettings=false] - Also restore the settings from the backup.
 * @returns {{added: number, kept: number, total: number}}
 */
export function restoreBackup(backup, { replace = false, restoreSettings = false } = {}) {
  const current = replace ? [] : readItems();
  const existingIds = new Set(current.map((item) => String(item.id)));
  const toAdd = backup.items.filter((item) => !existingIds.has(String(item.id)));

  const merged = [...current, ...toAdd].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const config = (restoreSettings && backup.config) || window.appConfig;
  if (config) normalizeItemKeys(merged, config);

  localStorage.setItem(ITEMS_KEY, JSON.stringify(merged));
  if (restoreSettings && backup.config) {
    localStorage.setItem(USER_CONFIG_KEY, JSON.stringify(backup.config));
  }

  return {
    added: toAdd.length,
    kept: backup.items.length - toAdd.length,
    total: merged.length,
  };
}
