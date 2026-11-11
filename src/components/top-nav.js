// Shared top bar: back button (left) + hamburger menu (right).
// Lives in index.html outside #app, so pages re-rendering #app don't remove it.
import { navigateTo, goBack, NAVIGATE_EVENT } from "../utils/app-navigation.js";

const MENU_ITEMS = [
  { page: "home", label: "🏠 Home", args: [] },
  { page: "add", label: "➕ New Entry", args: ["personal", "mood"] },
  { page: "stats", label: "📊 View Stats", args: [] },
  { page: "settings", label: "⚙️ Settings", args: [] },
];

export function initTopNav() {
  const nav = document.getElementById("topNav");
  if (!nav) return;

  nav.innerHTML = `
      <button type="button" id="navBack" class="nav-btn nav-back" aria-label="Go back">← Back</button>
      <div class="nav-menu-wrap">
          <button type="button" id="navMenuToggle" class="nav-btn nav-hamburger"
                  aria-label="Open menu" aria-haspopup="true" aria-expanded="false" aria-controls="navMenu">☰</button>
          <div id="navMenu" class="nav-menu" role="menu" hidden>
              ${MENU_ITEMS.map(
                (item) =>
                  `<button type="button" class="nav-menu-item" role="menuitem" data-page="${item.page}">${item.label}</button>`
              ).join("")}
          </div>
      </div>
  `;

  const backBtn = nav.querySelector("#navBack");
  const toggle = nav.querySelector("#navMenuToggle");
  const menu = nav.querySelector("#navMenu");

  const setMenuOpen = (open) => {
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };

  backBtn.addEventListener("click", () => goBack());

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setMenuOpen(menu.hidden);
    if (!menu.hidden) menu.querySelector(".nav-menu-item")?.focus();
  });

  menu.addEventListener("click", (event) => {
    const button = event.target.closest(".nav-menu-item");
    if (!button) return;
    const item = MENU_ITEMS.find((entry) => entry.page === button.dataset.page);
    setMenuOpen(false);
    if (item) navigateTo(item.page, ...item.args);
  });

  // Close on outside click or Escape
  document.addEventListener("click", (event) => {
    if (!menu.hidden && !nav.contains(event.target)) setMenuOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      setMenuOpen(false);
      toggle.focus();
    }
  });

  // Keep back-button visibility and the active menu item in sync with navigation
  window.addEventListener(NAVIGATE_EVENT, (event) => {
    const { page, canGoBack } = event.detail;
    backBtn.style.visibility = canGoBack ? "visible" : "hidden";
    menu.querySelectorAll(".nav-menu-item").forEach((button) => {
      const active = button.dataset.page === page;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    setMenuOpen(false);
  });
}
