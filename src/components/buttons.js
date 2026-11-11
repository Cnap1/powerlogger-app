// Import UI functions directly (we need to make them accessible)

import {initializeDateUtils} from "../utils/date.js";
import {initMoodEditor, renderEmotionPicker} from "./mood-editor.js";
import {escapeHtml, kindOptions} from "../utils/common.js";

let dateUtils = null;

export function Buttons() {
  /**
   * Initializes button event handlers for the application.
   */

  if (!dateUtils) {
    dateUtils = initializeDateUtils();
  }

  AreaButtons();
  TypeButtons();
  MoodSliders();
  // PriorityButtons(); // REMOVE THIS LINE
  DateButtons();
}
// ===== RENDER BUTTONS =====

function renderButtons(containerId, items, buttonClass, dataAttr) {
  const container = document.getElementById(containerId);
  if (container && items?.length) {
    container.innerHTML = items
      .map(
        (item) =>
          `<button type="button" class="${buttonClass}" data-${dataAttr}="${item}">${item}</button>`
      )
      .join("");
  }
}

// ===== AREA BUTTONS =====

function AreaButtons() {
  document.querySelectorAll(".area-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document
        .querySelectorAll(".area-btn")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      const selectedArea = this.dataset.area;

      // Support both itemArea and editArea
      const areaInput =
        document.getElementById("itemArea") ||
        document.getElementById("editArea");
      if (areaInput) areaInput.value = selectedArea;

      // Show type
      const typeGroup = document.getElementById("typeGroup");
      if (typeGroup) typeGroup.style.display = "block";

      // Reset other selections
      resetSelections();

      // Show categories for this area
      CategoryButtons(selectedArea);

      // Re-apply the selected type so its fields (mood editor, journal, deadline) come back
      document.querySelector(".type-btn.active")?.click();
    });
  });
}

// ===== TYPE BUTTONS =====

function TypeButtons() {
  document.querySelectorAll(".type-btn").forEach((btn) => {
    btn.addEventListener("click", function (event) {
      const typeMenu = this.closest(".type-buttons");
      // Tapping the chosen type while collapsed just opens the list again
      if (event?.isTrusted && typeMenu?.classList.contains("collapsed") && this.classList.contains("active")) {
        typeMenu.classList.remove("collapsed");
        return;
      }
      typeMenu?.classList.add("collapsed");
      document
        .querySelectorAll(".type-btn")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      const selectedType = this.dataset.type.toLowerCase();

      const typeInput =
        document.getElementById("itemType") ||
        document.getElementById("editType");
      if (typeInput) typeInput.value = selectedType;

      // Mood uses the mood editor + SAVE button instead of title/content/tags
      document.getElementById("addItemForm")?.classList.toggle("type-mood", selectedType === "mood");

      // Leaving Journal: remove its sections. Hidden "required" journal boxes
      // would otherwise silently block saving a note/todo.
      if (selectedType !== "journal") {
        const journalSections = document.getElementById("journalSections");
        if (journalSections) journalSections.innerHTML = "";
        const itemKind = document.getElementById("itemKind");
        if (itemKind) itemKind.value = "";
      }

      // Always show title and content fields first
      showTitleAndContentFields();

      // Reset all special interfaces
      resetAllInterfaces();

      // Hide/show labels based on type
      const areaLabel = document.getElementById("areaLabel");
      const typeLabel = document.getElementById("typeLabel");

      // Type-specific handling
      if (selectedType === "journal") {
        if (areaLabel) areaLabel.style.display = "none";
        if (typeLabel) typeLabel.style.display = "none";
        hidePriorityGroup();
        hideCategoryAndPriority();
        KindButtons(selectedType);
        const titleInput = document.getElementById("itemTitle");
        if (titleInput) titleInput.placeholder = "Title...";
      } else if (selectedType === "mood") {
        if (areaLabel) areaLabel.style.display = "none";
        if (typeLabel) typeLabel.style.display = "none";
        const moodFields = document.getElementById("moodFields");
        if (moodFields) moodFields.style.display = "block";
        hideCategoryAndPriority();
        // Ensure emoji picker is updated
        setTimeout(updateMoodSelection, 50);
        const titleInput = document.getElementById("itemTitle");
        if (titleInput) titleInput.placeholder = "Title...";
      } else if (selectedType === "todo") {
        if (areaLabel) areaLabel.style.display = "none";
        if (typeLabel) typeLabel.style.display = "none";
        const todoDateGroup = document.getElementById("todoDateGroup");
        if (todoDateGroup) todoDateGroup.style.display = "block";
        updatePriorityButtons("todo");
        TodoCategories();
        KindButtons(selectedType);
        showCategoryFields();
        const priorityGroup = document.getElementById("priorityGroup");
        if (priorityGroup) {
          priorityGroup.style.display = "block";
          const typeGroup = document.getElementById("typeGroup");
          if (typeGroup && typeGroup.nextSibling !== priorityGroup) {
            typeGroup.parentNode.insertBefore(
              priorityGroup,
              typeGroup.nextSibling
            );
          }
        }
        const titleInput = document.getElementById("itemTitle");
        if (titleInput) titleInput.placeholder = "Title...";
      } else if (selectedType === "note") {
        if (areaLabel) areaLabel.style.display = "block";
        if (typeLabel) typeLabel.style.display = "block";
        updatePriorityButtons("default");
        const selectedArea =
          (
            document.getElementById("itemArea") ||
            document.getElementById("editArea")
          )?.value?.toLowerCase() || "personal";
        if (selectedArea) {
          CategoryButtons(selectedArea);
        }
        KindButtons(selectedType);
        showCategoryFields();
        const priorityGroup = document.getElementById("priorityGroup");
        if (priorityGroup) {
          priorityGroup.style.display = "block";
          const typeGroup = document.getElementById("typeGroup");
          if (typeGroup && typeGroup.nextSibling !== priorityGroup) {
            typeGroup.parentNode.insertBefore(
              priorityGroup,
              typeGroup.nextSibling
            );
          }
        }
        const titleInput = document.getElementById("itemTitle");
        if (titleInput) titleInput.placeholder = "Title...";
        const contentInput = document.getElementById("itemContent");
        if (contentInput) contentInput.required = true;
        // Default to Personal only when no area is chosen yet (keeps the user's pick)
        const personalButton = document.querySelector('.area-btn[data-area="personal"]');
        if (personalButton && !document.querySelector(".area-btn.active")) {
          personalButton.classList.add("active");
          const areaInput =
            document.getElementById("itemArea") ||
            document.getElementById("editArea");
          if (areaInput) areaInput.value = "personal";
        }
      } else {
        if (areaLabel) areaLabel.style.display = "block";
        if (typeLabel) typeLabel.style.display = "block";
        updatePriorityButtons("default");
        const selectedArea = (
          document.getElementById("itemArea") ||
          document.getElementById("editArea")
        )?.value?.toLowerCase();
        if (selectedArea) {
          CategoryButtons(selectedArea);
        }
        KindButtons(selectedType);
        showCategoryFields();
        const titleInput = document.getElementById("itemTitle");
        if (titleInput) titleInput.placeholder = "Title...";
      }
    });
  });
}

function resetAllInterfaces() {
  const elements = ["journalInterface", "moodFields", "todoDateGroup"];
  elements.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.style.display = "none";
  });
}
function showTitleAndContentFields() {
  const titleGroup = document
    .getElementById("itemTitle")
    ?.closest(".form-group");
  const contentGroup = document
    .getElementById("itemContent")
    ?.closest(".form-group");

  if (titleGroup) titleGroup.style.display = "block";
  if (contentGroup) contentGroup.style.display = "block";
}

function hidePriorityGroup() {
  const priorityGroup = document.getElementById("priorityGroup");
  if (priorityGroup) priorityGroup.style.display = "none";
}

function hideCategoryAndPriority() {
  const categoryGroup = document.getElementById("categoryGroup");
  const kindGroup = document.getElementById("kindGroup");
  const priorityGroup = document.getElementById("priorityGroup");

  if (categoryGroup) categoryGroup.style.display = "none";
  if (kindGroup) kindGroup.style.display = "none";
  if (priorityGroup) priorityGroup.style.display = "none";
}

function showCategoryFields() {
  const categoryGroup = document.getElementById("categoryGroup");

  if (categoryGroup) categoryGroup.style.display = "block";
}

function updatePriorityButtons(priorityType) {
  const localConfig =
    JSON.parse(localStorage.getItem("localAppConfig")) || window.appConfig;
  const priorities = localConfig.priorities?.[priorityType] || [];
  const container = document.getElementById("priorityButtons");
  const group = document.getElementById("priorityGroup");

  if (container && priorities.length > 0) {
    container.innerHTML = priorities
      .map(
        (priority) =>
          `<button type="button" class="priority-btn" data-priority="${priority.value}">
                ${priority.emoji} ${priority.label}
            </button>`
      )
      .join("");

    // Add event listeners to new priority buttons
    container.querySelectorAll(".priority-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        document
          .querySelectorAll(".priority-btn")
          .forEach((b) => b.classList.remove("active"));
        this.classList.add("active");
        const priorityInput = document.getElementById("itemPriority");
        if (priorityInput) priorityInput.value = this.dataset.priority;
      });
    });

    // Start on "Normal" (older saved settings call it "Medium")
    const defaultBtn =
      container.querySelector('.priority-btn[data-priority="Normal"]') ||
      container.querySelector('.priority-btn[data-priority="Medium"]');
    defaultBtn?.click();

    if (group) group.style.display = "block";
  }
}
// ===== CATEGORY BUTTONS =====

function CategoryButtons(area) {
  const localConfig =
    JSON.parse(localStorage.getItem("localAppConfig")) || window.appConfig;
  const areaKey = area.toLowerCase();
  const categories = (localConfig.categoriesByArea?.[areaKey] || []).map(cat =>
    typeof cat === "string"
      ? { key: cat, label: cat }
      : cat
  );
  renderButtons("categoryButtons", categories.map(c => c.key), "category-btn", "category");

  document.querySelectorAll(".category-btn").forEach((btn, idx) => {
    // Use label or shortcode for display, fallback to key
    btn.textContent = categories[idx]?.label || categories[idx]?.shortcode || categories[idx]?.key || btn.textContent;
    btn.addEventListener("click", function () {
      document
        .querySelectorAll(".category-btn")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      const categoryInput =
        document.getElementById("itemCategory") ||
        document.getElementById("editCategory");
      if (categoryInput) categoryInput.value = this.dataset.category;
    });
  });
}

// Journal type (journal) or Status (todo); other types have neither.
function KindButtons(selectedType) {
  const localConfig =
    JSON.parse(localStorage.getItem("localAppConfig")) || window.appConfig;
  const typeKey = selectedType.toLowerCase();
  const options = kindOptions(localConfig, typeKey);

  if (typeKey === "note") {
    const categoryInput = document.getElementById("itemCategory");
    if (categoryInput) categoryInput.value = "General";
  }

  const container = document.getElementById("kindButtons");
  const group = document.getElementById("kindGroup");
  const label = document.getElementById("kindLabel");
  const kindInput = document.getElementById("itemKind");
  if (kindInput) kindInput.value = "";

  if (container && options.length) {
    if (label) label.textContent = typeKey === "todo" ? "Status:" : "Journal type:";
    container.innerHTML = options
      .map((opt) => `<button type="button" class="kind-btn" data-kind="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`)
      .join("");

    container.querySelectorAll(".kind-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        document
          .querySelectorAll(".kind-btn")
          .forEach((b) => b.classList.remove("active"));
        this.classList.add("active");
        if (kindInput) kindInput.value = this.dataset.kind;

        if (typeKey === "journal") {
          import("../components/forms.js").then(({generateJournal}) => {
            generateJournal(this.dataset.kind, localConfig);
          });
        }
        if (typeKey === "todo") {
          updateTodoTitle();
        }
      });
    });

    if (group) group.style.display = "block";
    // New todos start as the first status (TODO)
    if (typeKey === "todo") container.querySelector(".kind-btn")?.click();
  } else {
    if (container) container.innerHTML = "";
    if (group) group.style.display = "none";
  }
}

function updateTodoTitle() {
  const status = document.getElementById("itemKind")?.value;
  const category = document.getElementById("itemCategory")?.value;
  const titleInput = document.getElementById("itemTitle");

  if (titleInput && status && category) {
    titleInput.placeholder = `${status} - ${category.toUpperCase()} - Title...`;
  }
}

// ===== TODO CATEGORIES =====

function TodoCategories() {
  const localConfig =
    JSON.parse(localStorage.getItem("localAppConfig")) || window.appConfig;
  const todoCategories = localConfig.todoCategories || [];
  const container = document.getElementById("categoryButtons");
  const group = document.getElementById("categoryGroup");

  if (container && todoCategories.length > 0) {
    container.innerHTML = todoCategories
      .map(
        (category) =>
          `<button type="button" class="category-btn" data-category="${category}">${category}</button>`
      )
      .join("");

    container.querySelectorAll(".category-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        document
          .querySelectorAll(".category-btn")
          .forEach((b) => b.classList.remove("active"));
        this.classList.add("active");
        const categoryInput = document.getElementById("itemCategory");
        if (categoryInput) categoryInput.value = this.dataset.category;
      });
    });

    if (group) group.style.display = "block";
  } else {
    if (group) group.style.display = "none";
  }
}

// ===== MOOD SLIDERS + EMOTION PICKER =====
// Shared with the Edit page: see components/mood-editor.js

function MoodSliders() {
  initMoodEditor();
}

function updateMoodSelection() {
  renderEmotionPicker();
}

// ===== DATE BUTTONS =====

function DateButtons() {
  const {
    handleMainDateSelection,
    handleSubDateSelection,
    initializeCustomDatePicker,
  } = dateUtils || initializeDateUtils();

  // Main date type handlers
  document.addEventListener("click", function (e) {
    if (e.target.classList.contains("main-date-btn")) {
      e.preventDefault();

      // Remove active from all main buttons
      document
        .querySelectorAll(".main-date-btn")
        .forEach((btn) => btn.classList.remove("active"));
      // Hide all sub-options
      document
        .querySelectorAll(".sub-date-options")
        .forEach((opt) => (opt.style.display = "none"));
      // Clear selected sub-buttons
      document
        .querySelectorAll(".sub-date-btn")
        .forEach((btn) => btn.classList.remove("selected"));

      // Activate clicked button
      e.target.classList.add("active");

      const type = e.target.dataset.type;
      handleMainDateSelection(type);

      // Show appropriate sub-options
      if (type === "day") {
        document.getElementById("dayOptions").style.display = "block";
      } else if (type === "week") {
        document.getElementById("weekOptions").style.display = "block";
      } else if (type === "month") {
        document.getElementById("monthOptions").style.display = "block";
      }
    }

    if (e.target.classList.contains("sub-date-btn")) {
      e.preventDefault();

      // Clear previously selected sub-buttons
      document
        .querySelectorAll(".sub-date-btn")
        .forEach((btn) => btn.classList.remove("selected"));
      e.target.classList.add("selected");

      const action = e.target.dataset.action;
      const days = e.target.dataset.days;
      handleSubDateSelection(action, days, e.target.textContent);
    }
  });

  // Initialize custom date picker
  initializeCustomDatePicker();
  const customDatePicker = document.getElementById("customDatePicker");
  if (customDatePicker) {
    customDatePicker.addEventListener("change", function () {
      const selectedDate = this.value;
      if (selectedDate) {
        handleMainDateSelection("custom", selectedDate);
      }
    });
  }
}

// ===== RESET SELECTIONS =====

function resetSelections() {
  const elementsToHide = [
    "categoryGroup",
    "kindGroup",
    "journalInterface",
    "moodFields",
    "todoDateGroup",
  ];
  elementsToHide.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.style.display = "none";
  });

  // Clear hidden inputs
  const inputsToReset = ["itemCategory", "itemKind", "itemPriority"];
  inputsToReset.forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });

  // Clear active buttons
  document
    .querySelectorAll(".category-btn, .kind-btn, .priority-btn")
    .forEach((btn) => {
      btn.classList.remove("active");
    });
}
