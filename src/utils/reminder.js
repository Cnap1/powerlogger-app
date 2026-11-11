// Daily mood reminder.
// A web page can't wake the phone at a set time without a push server, so this:
//  - shows a banner on the home page after the chosen time if no mood was logged today
//  - shows a system notification at that time while PowerLogger is open (if allowed)

const SETTINGS_KEY = "powerloggerReminder";
const DISMISSED_KEY = "powerloggerReminderDismissed"; // "YYYY-MM-DD"
const NOTIFIED_KEY = "powerloggerReminderNotified";   // "YYYY-MM-DD"
const DEFAULTS = { enabled: false, time: "20:00" };

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function getReminderSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    const time = /^\d{2}:\d{2}$/.test(saved?.time) ? saved.time : DEFAULTS.time;
    return { enabled: Boolean(saved?.enabled), time };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveReminderSettings({ enabled, time }) {
  const settings = {
    enabled: Boolean(enabled),
    time: /^\d{2}:\d{2}$/.test(time) ? time : DEFAULTS.time,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}

/** Asks for notification permission (only when not decided yet). Returns the permission. */
export async function requestReminderPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }
  return Notification.permission;
}

function hasMoodToday() {
  try {
    const items = JSON.parse(localStorage.getItem("logseqItems") || "[]");
    const today = new Date().toDateString();
    return items.some((item) => item.type === "mood" && new Date(item.createdAt).toDateString() === today);
  } catch {
    return false;
  }
}

function pastReminderTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes;
}

/** True when the reminder should be shown now */
export function reminderIsDue() {
  const settings = getReminderSettings();
  return (
    settings.enabled &&
    pastReminderTime(settings.time) &&
    localStorage.getItem(DISMISSED_KEY) !== todayKey() &&
    !hasMoodToday()
  );
}

/** Hide the reminder for the rest of today */
export function dismissReminderToday() {
  localStorage.setItem(DISMISSED_KEY, todayKey());
}

let watcher = null;

/**
 * Checks every minute while the app is open and shows one notification per day
 * when the reminder is due. `onOpen` runs when the notification is clicked.
 */
export function startReminderWatcher(onOpen) {
  if (watcher) return;
  const check = () => {
    if (!reminderIsDue()) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (localStorage.getItem(NOTIFIED_KEY) === todayKey()) return;
    localStorage.setItem(NOTIFIED_KEY, todayKey());
    try {
      const notification = new Notification("PowerLogger", {
        body: "How are you feeling? Take a moment to log your mood.",
        tag: "powerlogger-mood-reminder",
        icon: "./icons/icon-192.png",
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
        onOpen?.();
      };
    } catch (error) {
      console.warn("Could not show reminder notification:", error);
    }
  };
  check();
  watcher = setInterval(check, 60 * 1000);
}
