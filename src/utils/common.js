/**
 * Escapes a value for safe insertion into HTML (text or quoted attribute).
 * @param {*} value - Any value; null/undefined become an empty string.
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Display text for a config entry (area, entry type, ...): "<emoji> <label>".
 * Uses the entry's `emoji` field; if the label already starts with that emoji
 * (or there is none) the label is returned as-is, so nothing is doubled.
 * @param {{key?: string, label?: string, emoji?: string}} entry
 * @returns {string}
 */
export function displayLabel(entry) {
  const label = entry?.label ?? entry?.key ?? "";
  const emoji = entry?.emoji;
  if (!emoji || label.startsWith(emoji)) return label;
  return `${emoji} ${label}`;
}

let lastId = 0;

/**
 * Returns a unique numeric item id. Based on Date.now(), but never returns
 * the same value twice, even when called within the same millisecond.
 * Ids stay numeric so existing stored items and id comparisons keep working.
 * @returns {number}
 */
export function generateId() {
  lastId = Math.max(Date.now(), lastId + 1);
  return lastId;
}

// ===== Journal type / todo status =====
// These used to be stored as "subcategory"; they are now their own fields.

export const DEFAULT_JOURNAL_TYPES = ["Today (short)", "Today (long)", "Weekly Review", "Monthly Review", "Yearly Review"];
export const DEFAULT_TODO_STATUSES = ["TODO", "DOING", "BLOCKED", "DONE", "CANCELLED"];

/** Item field that holds the journal type / todo status, or null for other types. */
export function kindField(type) {
  const key = String(type || "").toLowerCase();
  if (key === "journal") return "journalType";
  if (key === "todo") return "status";
  return null;
}

/** Choices for a type's kind field (journal types or todo statuses); [] for other types. */
export function kindOptions(config, type) {
  const key = String(type || "").toLowerCase();
  if (key === "journal") return config?.journalTypes?.length ? config.journalTypes : DEFAULT_JOURNAL_TYPES;
  if (key === "todo") return config?.todoStatuses?.length ? config.todoStatuses : DEFAULT_TODO_STATUSES;
  return [];
}
