// Auto-save: keeps a JSON file on disk up to date with every change.
//
// Uses the File System Access API (Chrome / Edge on a computer). The user picks
// the file once; its handle is kept in IndexedDB so it survives restarts. The
// file has the backup format, so "Restore from file" can read it back.
// Browsers without the API (phones, Firefox, Safari) fall back to the backup reminder.
import { createBackup } from "./backup.js";

export const AUTOSAVE_KEY = "powerloggerAutosave"; // file name while auto-save is on
const WATCHED_KEYS = ["logseqItems", "powerloggerUserConfig"];
const DB_NAME = "powerlogger";
const STORE = "handles";
const HANDLE_ID = "autosaveFile";
const DELAY_MS = 800;

let timer = null;
let lastError = null;
const listeners = new Set();

export function autosaveSupported() {
  return typeof window !== "undefined" && "showSaveFilePicker" in window && "indexedDB" in window;
}

/** File name while auto-save is on, else null. */
export function autosaveFileName() {
  try {
    return localStorage.getItem(AUTOSAVE_KEY);
  } catch {
    return null;
  }
}

/** Called with the status after every save attempt (for the settings page / home banner). */
export function onAutosaveStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(status) {
  listeners.forEach((fn) => fn(status));
}

// ----- handle storage (IndexedDB) -----

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbRequest(mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = action(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

const loadHandle = () => dbRequest("readonly", (s) => s.get(HANDLE_ID));
const storeHandle = (handle) => dbRequest("readwrite", (s) => s.put(handle, HANDLE_ID));
const clearHandle = () => dbRequest("readwrite", (s) => s.delete(HANDLE_ID));

// ----- saving -----

/**
 * "on" (saving works), "needs-permission" (browser restarted; one click needed),
 * "off" or "unsupported".
 */
export async function autosaveStatus() {
  if (!autosaveSupported()) return "unsupported";
  if (!autosaveFileName()) return "off";
  const handle = await loadHandle().catch(() => null);
  if (!handle) return "off";
  const permission = await handle.queryPermission({ mode: "readwrite" });
  return permission === "granted" ? "on" : "needs-permission";
}

/** Writes all entries + settings to the chosen file now. Returns true when saved. */
export async function saveNow() {
  clearTimeout(timer);
  timer = null;
  if (!autosaveSupported() || !autosaveFileName()) return false;
  try {
    const handle = await loadHandle();
    if (!handle) return false;
    if ((await handle.queryPermission({ mode: "readwrite" })) !== "granted") {
      emit({ state: "needs-permission" });
      return false;
    }
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(createBackup(), null, 2));
    await writable.close();
    lastError = null;
    localStorage.setItem("powerloggerLastBackup", new Date().toISOString());
    emit({ state: "saved", at: new Date() });
    return true;
  } catch (error) {
    lastError = error;
    console.error("Auto-save failed:", error);
    emit({ state: "error", error });
    return false;
  }
}

/** Saves a moment after the last change, so a burst of changes is one write. */
export function scheduleSave() {
  if (!autosaveFileName()) return;
  clearTimeout(timer);
  timer = setTimeout(saveNow, DELAY_MS);
}

/** Lets the user pick (or create) the file; must be called from a click. */
export async function chooseAutosaveFile() {
  const handle = await window.showSaveFilePicker({
    suggestedName: "powerlogger-entries.json",
    types: [{ description: "PowerLogger data", accept: { "application/json": [".json"] } }],
  });
  await storeHandle(handle);
  localStorage.setItem(AUTOSAVE_KEY, handle.name);
  return saveNow();
}

/** After a browser restart Chrome asks once more for access; must be called from a click. */
export async function resumeAutosave() {
  const handle = await loadHandle();
  if (!handle) return false;
  const permission = await handle.requestPermission({ mode: "readwrite" });
  return permission === "granted" ? saveNow() : false;
}

export async function stopAutosave() {
  clearTimeout(timer);
  timer = null;
  localStorage.removeItem(AUTOSAVE_KEY);
  await clearHandle().catch(() => {});
  emit({ state: "off" });
}

export function lastAutosaveError() {
  return lastError;
}

/**
 * Starts watching for changes. Entries are written to localStorage from many
 * places, so this listens at the storage level instead of at each of them.
 */
export function startAutosave() {
  if (!autosaveSupported() || startAutosave.started) return;
  startAutosave.started = true;

  const proto = Object.getPrototypeOf(localStorage);
  const originalSet = proto.setItem;
  const originalRemove = proto.removeItem;
  proto.setItem = function (key, value) {
    originalSet.call(this, key, value);
    if (this === localStorage && WATCHED_KEYS.includes(key)) scheduleSave();
  };
  proto.removeItem = function (key) {
    originalRemove.call(this, key);
    if (this === localStorage && WATCHED_KEYS.includes(key)) scheduleSave();
  };

  // Don't lose the last change when the tab is closed or hidden
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && timer) saveNow();
  });

  // Save once at start-up (also refreshes the file after an app update)
  saveNow();
}
