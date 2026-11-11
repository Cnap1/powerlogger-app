// Small helpers for the stored entries (localStorage "logseqItems").

const ITEMS_KEY = "logseqItems";

export function readItems() {
  try {
    return JSON.parse(localStorage.getItem(ITEMS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function writeItems(items) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

/**
 * Removes an entry. Returns what restoreItem() needs to put it back, or null
 * when there is no entry with that id.
 * @returns {{item: object, index: number} | null}
 */
export function deleteItem(id) {
  const items = readItems();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const [item] = items.splice(index, 1);
  writeItems(items);
  return { item, index };
}

/** Puts a deleted entry back at its old position (Undo). Does nothing if it is already there. */
export function restoreItem({ item, index }) {
  const items = readItems();
  if (items.some((existing) => existing.id === item.id)) return;
  items.splice(Math.min(index, items.length), 0, item);
  writeItems(items);
}

/** Todo states that count as finished (not pending, never overdue). */
export const FINISHED_TODO_STATUSES = ["DONE", "CANCELLED"];

export function isFinishedTodo(item) {
  return FINISHED_TODO_STATUSES.includes(item?.status);
}

/** A todo that is not finished and whose deadline has passed. */
export function isOverdue(item, now = Date.now()) {
  if (item?.type !== "todo" || isFinishedTodo(item)) return false;
  if (!item.deadline || item.deadline === "NO_DEADLINE") return false;
  const due = new Date(item.deadline).getTime();
  return !Number.isNaN(due) && due < now;
}

/**
 * Marks a todo DONE, or back to TODO when it already is DONE.
 * @returns {string|null} the new status, or null when it is not a todo.
 */
export function toggleTodoDone(id) {
  const items = readItems();
  const item = items.find((i) => i.id === id);
  if (!item || item.type !== "todo") return null;
  item.status = item.status === "DONE" ? "TODO" : "DONE";
  item.updatedAt = new Date().toISOString();
  writeItems(items);
  return item.status;
}

/** Case-insensitive search in the text of an entry (title, content, category, tags, mood). */
export function matchesSearch(item, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const text = [
    item.title,
    item.content,
    item.category,
    ...(item.tags || []),
    item.mood?.secondary,
    item.mood?.tertiary,
    item.mood?.primary,
    item.mood?.context,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((word) => text.includes(word));
}
