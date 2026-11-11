import {renderHomePage} from "../pages/app-home.js";
import {renderAddItemPage, renderEditItemPage} from "../pages/item-editor.js";
import {renderStatsPage} from "../pages/app-analytics.js";
import {renderSettingsPage} from "../pages/app-settings.js";

/** Fired on window after every page change: detail = { page, args, canGoBack } */
export const NAVIGATE_EVENT = "powerlogger:navigate";

const MAX_HISTORY = 50;
const history = []; // previously visited pages, most recent last
let current = null; // { page, args }

function renderPage(page, args) {
  switch (page) {
    case "add":
      renderAddItemPage(...args);
      break;
    case "edit":
      renderEditItemPage(...args);
      break;
    case "stats":
      renderStatsPage();
      break;
    case "settings":
      renderSettingsPage();
      break;
    case "home":
    default:
      renderHomePage();
  }
  window.scrollTo(0, 0);
  window.dispatchEvent(
    new CustomEvent(NAVIGATE_EVENT, {
      detail: { page, args, canGoBack: history.length > 0 },
    })
  );
}

/**
 * Navigates to a specific page in the application and remembers the page
 * we came from, so goBack() can return to it.
 *
 * @param {string} page - The page to navigate to.
 * @param {...any} args - Additional arguments for the page.
 */
export function navigateTo(page, ...args) {
  if (current) {
    history.push(current);
    if (history.length > MAX_HISTORY) history.shift();
  }
  current = { page, args };
  renderPage(page, args);
}

/** Returns to the previous page (or home when there is none). */
export function goBack() {
  const previous = history.pop() || { page: "home", args: [] };
  current = previous;
  renderPage(previous.page, previous.args);
}
