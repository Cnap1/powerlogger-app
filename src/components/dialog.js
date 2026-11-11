// In-page replacements for window.confirm() / window.alert().
// Native dialogs are blocked in some browsers and embedded views (they return
// "Cancel" instantly without showing anything), which made buttons like Delete
// silently do nothing. These work everywhere and match the app's style.

import { escapeHtml } from "../utils/common.js";

/**
 * Asks a yes/no question in a modal dialog.
 * @param {string} message - The question (new lines are kept).
 * @param {{okLabel?: string, cancelLabel?: string, danger?: boolean}} [options]
 * @returns {Promise<boolean>} true when the user confirms.
 */
export function confirmDialog(message, { okLabel = "OK", cancelLabel = "Cancel", danger = false } = {}) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "app-dialog-overlay";
    overlay.innerHTML = `
      <div class="app-dialog" role="alertdialog" aria-modal="true" aria-labelledby="appDialogText">
        <p id="appDialogText" class="app-dialog-text">${escapeHtml(message)}</p>
        <div class="app-dialog-actions">
          <button type="button" class="btn btn-secondary" data-answer="no">${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-answer="yes">${escapeHtml(okLabel)}</button>
        </div>
      </div>`;

    const close = (answer) => {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      previousFocus?.focus?.();
      resolve(answer);
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(false); }
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) return close(false); // click outside = cancel
      const btn = e.target.closest("[data-answer]");
      if (btn) close(btn.dataset.answer === "yes");
    });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-answer="yes"]').focus();
  });
}

/**
 * Shows a short message at the bottom of the screen. It stays visible across
 * page changes and disappears by itself (tap to close sooner).
 * @param {string} message - Text; a leading ❌ shows it as an error.
 * @param {{duration?: number, action?: {label: string, onClick: Function}}} [options]
 *   action: a button in the message (e.g. Undo); clicking it runs onClick and closes the message.
 */
export function notify(message, { duration, action } = {}) {
  let area = document.getElementById("appToasts");
  if (!area) {
    area = document.createElement("div");
    area.id = "appToasts";
    area.className = "app-toasts";
    area.setAttribute("role", "status");
    area.setAttribute("aria-live", "polite");
    document.body.appendChild(area);
  }
  const text = String(message ?? "");
  const toast = document.createElement("div");
  toast.className = "app-toast" + (text.startsWith("❌") ? " app-toast-error" : "") + (action ? " app-toast-action" : "");
  const textEl = document.createElement("span");
  textEl.textContent = text;
  toast.appendChild(textEl);

  const remove = () => toast.remove();
  if (action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "app-toast-btn";
    btn.textContent = action.label;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      remove();
      action.onClick();
    });
    toast.appendChild(btn);
  }
  area.appendChild(toast);

  // Longer messages stay up a little longer; give time to reach an action button
  const ms = duration ?? Math.min(9000, (action ? 6000 : 2500) + text.length * 40);
  toast.addEventListener("click", remove);
  setTimeout(remove, ms);
}
