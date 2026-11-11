// src/components/forms.js - Form handlers and journal generation

import { navigateTo } from "../utils/app-navigation.js";
import { validateFormData } from "../utils/data-validation.js";
import { generateId, kindField } from "../utils/common.js";
import { readMoodEditor } from "./mood-editor.js";
import { notify } from "./dialog.js";

/** Description stored with a mood entry, e.g. "Feeling Calm - after a run" */
export function moodContent(mood) {
  return mood.context ? `Feeling ${mood.label} - ${mood.context}` : `Feeling ${mood.label}`;
}

let selectedEmoji = null;
let currentLocalConfig = null;

export function initializeForms(localConfig, preselectedArea, preselectedType) {
  console.log("🔧 Initializing forms with config:", localConfig);
 
  // Store config for later use
  currentLocalConfig = localConfig;

  // Initialize form handlers
  initializeFormHandlers();

  // Auto-select preselected values
  if (preselectedArea || preselectedType) {
    autoSelectPreselectedValues(preselectedArea, preselectedType);
  }

  console.log("✅ Forms initialized successfully");
}

/**
 * Initializes form handlers and preselects values if provided.
 *
 * @param {Object} localConfig - The local configuration object.
 * @param {string} [preselectedArea] - The preselected area.
 * @param {string} [preselectedType] - The preselected type.
 */

function autoSelectPreselectedValues(preselectedArea, preselectedType) {
  if (preselectedArea) {
    setTimeout(() => {
      const areaBtn = document.querySelector(
        `[data-area="${preselectedArea}"]`
      );
      if (areaBtn) {
        console.log(`Auto-selecting area: ${preselectedArea}`);
        areaBtn.click();
      }
    }, 100);
  }

  if (preselectedType) {
    setTimeout(() => {
      const typeBtn = document.querySelector(
        `[data-type="${preselectedType}"]`
      );
      if (typeBtn) {
        console.log(`Auto-selecting type: ${preselectedType}`);
        typeBtn.click();
      }
    }, 200);
  }
}

function initializeFormHandlers() {
  // Back button
  const backButton = document.getElementById("backButton");
  if (backButton) {
    backButton.addEventListener("click", () => navigateTo("home"));
  }

  // Form submission
  const form = document.getElementById("addItemForm");
  if (form) {
    form.addEventListener("submit", handleFormSubmission);
  }

  // Mood: single SAVE button
  const saveMoodButton = document.getElementById("saveMoodOnly");
  saveMoodButton?.addEventListener("click", saveMood);

  // Show the chosen emotion's emoji on the SAVE button
  document.getElementById("emotionPicker")?.addEventListener("click", (event) => {
    const icon = event.target.closest(".emotion-icon");
    if (icon && saveMoodButton) {
      saveMoodButton.textContent = `SAVE ${icon.dataset.emoji || "😊"}`;
    }
  });

  // Enter in the context field saves the mood (instead of submitting the item form)
  document.getElementById("moodCategory")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveMood();
    }
  });
}

function saveMood() {
  const moodData = readMoodEditor();
  if (!moodData) {
    notify("Please select an emotion!");
    return;
  }

  const newItem = {
    id: generateId(),
    area: document.getElementById("itemArea")?.value || "personal",
    type: "mood",
    title: `Mood - ${new Date().toLocaleString()}`,
    content: moodContent(moodData),
    mood: moodData,
    createdAt: new Date().toISOString(),
  };

  saveFormData(newItem);
}

// ===== JOURNAL GENERATION =====

export function generateJournal(journalType, config) {
  console.log("📓 Generating journal:", journalType);

  const container = document.getElementById("journalSections");
  if (!container) {
    console.error("❌ Journal sections container not found");
    return;
  }

  const template = config.journalTemplates?.[journalType];
  if (!template) {
    console.warn(`❌ No journal template found for: ${journalType}`);
    return;
  }

  // Show journal interface
  const journalInterface = document.getElementById("journalInterface");
  if (journalInterface) journalInterface.style.display = "block";

  // Generate based on journal type
  if (journalType === "Today (short)") {
    generateShortForm(template, container);
  } else if (journalType === "Today (long)") {
    generateLongForm(template, container);
  } else {
    generateReviewForm(template, container, journalType);
  }

  // Make regular fields optional for journal, don't hide them
  const titleInput = document.getElementById("itemTitle");
  const contentInput = document.getElementById("itemContent");
  if (titleInput) {
    titleInput.required = false;
    titleInput.placeholder = "Optional - will auto-generate if empty";
  }
  if (contentInput) {
    contentInput.required = false;
    contentInput.placeholder =
      "Optional - journal sections will be used as content";
  }

  console.log("✅ Journal generated successfully");
}

/**
 * Generates a short journal form inside a specified container element using a provided template.
 *
 * @param {Array<Object>} template - An array of objects representing the journal sections.
 * Each object should have the following properties:
 *   - {string} title - The title of the journal section.
 *   - {string} icon - An emoji or icon representing the section.
 * @param {HTMLElement} container - The DOM element where the generated form will be rendered.
 *
 * @example
 * const template = [
 *   { title: "Gratitude", icon: "🙏" },
 *   { title: "Goals", icon: "🎯" }
 * ];
 * const container = document.getElementById("journal-container");
 * generateShortForm(template, container);
 */
function generateShortForm(template, container) {
  container.innerHTML = `
        <div class="journal-container short-form">
            <div class="journal-header">
                <h3>📓 Today's Quick Journal</h3>
                <p class="journal-subtitle">Brief daily reflection</p>
            </div>
            <div class="journal-sections">
                ${template
                  .map(
                    (section) => `
                    <div class="journal-section-short" data-section="${section.title}">
                        <div class="journal-input-row">
                            <span class="journal-emoji" title="${section.title}">${section.icon}</span>
                            <textarea class="journal-textarea" data-section="${section.title}"
                                      rows="${section.rows || 2}" placeholder="${section.title}..."
                                      aria-label="${section.title}"></textarea>
                        </div>
                    </div>
                `
                  )
                  .join("")}
            </div>
        </div>`;

  attachJournalHandlers(container);
}

/**
 * Generates a detailed journal form based on a provided template and appends it to a container element.
 *
 * @param {Array<Object>} template - An array of section objects defining the structure of the journal.
 * @param {string} template[].title - The title of the journal section.
 * @param {string} template[].icon - The icon representing the journal section.
 * @param {Array<string>} [template[].prompts] - An optional array of prompts for the section.
 * @param {number} [template[].rows] - The number of rows for the textarea if prompts are not provided.
 * @param {HTMLElement} container - The container element where the journal form will be rendered.
 */
function generateLongForm(template, container) {
  container.innerHTML = `
        <div class="journal-container long-form">
            <div class="journal-header">
                <h3>📖 Today's Detailed Journal</h3>
                <p class="journal-subtitle">Comprehensive daily reflection</p>
            </div>
            <div class="journal-sections">
                ${template
                  .map(
                    (section) => `
                    <div class="journal-section" data-section="${
                      section.title
                    }">
                        <div class="section-header">
                            <span class="section-icon">${section.icon}</span>
                            <span class="section-title">${section.title}</span>
                        </div>
                        ${
                          section.prompts
                            ? section.prompts
                                .map(
                                  (prompt, index) =>
                                    `<textarea class="journal-textarea" data-section="${
                                      section.title
                                    }" rows="2" placeholder="${prompt}..." ${
                                      index === 0 ? "required" : ""
                                    }></textarea>`
                                )
                                .join("")
                            : `<textarea class="journal-textarea" data-section="${
                                section.title
                              }" rows="${
                                section.rows || 4
                              }" placeholder="Reflect on ${section.title.toLowerCase()}..." required></textarea>`
                        }
                    </div>
                `
                  )
                  .join("")}
            </div>
        </div>`;

  attachJournalHandlers(container);
}

function generateReviewForm(template, container, journalType) {
  container.innerHTML = `
        <div class="journal-container review-form">
            <div class="journal-header">
                <h3>📋 ${journalType}</h3>
                <p class="journal-subtitle">Structured reflection format</p>
            </div>
            <div class="journal-sections">
                ${template
                  .map(
                    (section) => `
                    <div class="journal-section" data-section="${
                      section.title
                    }">
                        <div class="section-header">
                            <span class="section-icon">${section.icon}</span>
                            <span class="section-title">${section.title}</span>
                        </div>
                        <textarea class="journal-textarea" data-section="${
                          section.title
                        }" rows="${
                      section.rows || 4
                    }" placeholder="Reflect on ${section.title.toLowerCase()}..." required></textarea>
                    </div>
                `
                  )
                  .join("")}
            </div>
        </div>`;

  attachJournalHandlers(container);
}

function attachJournalHandlers(container) {
  container.querySelectorAll(".journal-textarea").forEach((textarea, index) => {
    textarea.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
    });

    // Long/review forms: first textarea in each section is required.
    // Quick (short) journal: nothing is required per section - at least one
    // filled section is checked on submit instead.
    const section = textarea.closest(".journal-section");
    const isFirstInSection =
      section && section.querySelector(".journal-textarea") === textarea;
    textarea.required = Boolean(isFirstInSection);

    // Initial height adjustment
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  });
}

// ===== FORM DATA COLLECTION =====

function handleFormSubmission(e) {
  e.preventDefault();
  console.log("📝 Form submitted");

  const newItem = collectFormData();
  console.log("📋 Collected form data:", newItem);

  // Journal: at least one section must be filled in
  const journalBoxes = [...document.querySelectorAll("#journalSections .journal-textarea")];
  if (newItem.type === "journal" && journalBoxes.length > 0 && !journalBoxes.some((t) => t.value.trim())) {
    notify("Please write something in at least one journal section.");
    journalBoxes[0].focus();
    return;
  }

  // Validate form data
  if (!validateFormData(newItem)) {
    console.log("❌ Form validation failed");
    return;
  }

  // Handle special item types
  if (!handleSpecialItemTypes(newItem)) {
    console.log("❌ Special item type handling failed");
    return;
  }

  // Save regular items
  saveFormData(newItem);
}

function collectFormData() {
  const itemArea = document.getElementById("itemArea")?.value;
  const itemType = document.getElementById("itemType")?.value;
  const itemCategory = document.getElementById("itemCategory")?.value;
  const itemKind =
    document.getElementById("itemKind")?.value || null;
  const itemPriority = document.getElementById("itemPriority")?.value || null;
  let title = document.getElementById("itemTitle")?.value?.trim() || "";
  let content = document.getElementById("itemContent")?.value || "";
  const tags =
    document
      .getElementById("itemTags")
      ?.value?.split(",")
      ?.map((tag) => tag.trim())
      ?.filter((tag) => tag !== "") || [];

  // Handle journal content collection
  if (itemType === "journal") {
    const journalSections = document.querySelectorAll(".journal-textarea");
    if (journalSections.length > 0) {
      content = Array.from(journalSections)
        .map((textarea) => {
          const section = textarea.dataset.section;
          const sectionContent = textarea.value.trim();
          return sectionContent ? `**${section}:**\n${sectionContent}` : "";
        })
        .filter((section) => section !== "")
        .join("\n\n");
    }

    // Auto-generate title for journal
    if (!title) {
      const now = new Date();
      const journalType = itemKind || "Journal";
      title = `${journalType} - ${now.toLocaleDateString()}`;
    }
  }

  // Auto-generate titles for other types
  if (!title) {
    const now = new Date();
    const timeStr = now.toLocaleString();

    switch (itemType) {
      case "todo":
        const firstLine = content.split("\n")[0].substring(0, 50);
        title = firstLine || `Todo - ${timeStr}`;
        break;
      case "mood":
        const emotionLabel = selectedEmoji ? " - Mood tracked" : "";
        title = `Mood${emotionLabel} - ${timeStr}`;
        break;
      case "note":
        const notePreview = content.substring(0, 50);
        title = notePreview || `Note - ${timeStr}`;
        break;
      case "event":
        const eventPreview = content.split("\n")[0].substring(0, 50);
        title = eventPreview || `Event - ${timeStr}`;
        break;
      default:
        title = `${itemType} - ${timeStr}`;
    }
  }

  const baseItem = {
    id: generateId(),
    area: itemArea,
    type: itemType,
    category: itemCategory,
    ...(kindField(itemType) && itemKind ? { [kindField(itemType)]: itemKind } : {}),
    title,
    content,
    tags,
    priority: itemPriority,
    createdAt: new Date().toISOString(),
  };

  // Add mood data if it's a mood entry
  if (itemType === "mood") {
    const moodSlider = document.getElementById("moodSlider");
    const intensitySlider = document.getElementById("intensitySlider");
    const moodCategory = document.getElementById("moodCategory");

    if (moodSlider && intensitySlider) {
      baseItem.mood = {
        happiness: parseInt(moodSlider.value),
        intensity: parseInt(intensitySlider.value),
        emoji: selectedEmoji || "😐",
        context: moodCategory?.value || null,
      };
    }
  }

  // Add deadline if it's a todo
  if (itemType === "todo") {
    const deadlineValue = document.getElementById("todoDeadlineValue");
    baseItem.deadline = deadlineValue?.value || "NO_DEADLINE";
  }

  return baseItem;
}

function handleSpecialItemTypes(newItem) {
  // Handle mood type
  if (newItem.type === "mood" && !newItem.mood) {
    notify("Please set your mood using the sliders");
    return false;
  }

  // Journal is already handled in collectFormData
  // Todo deadline is already handled in collectFormData

  return true;
}

function saveFormData(newItem) {
  try {
    const items = JSON.parse(localStorage.getItem("logseqItems") || "[]");
    items.unshift(newItem);
    localStorage.setItem("logseqItems", JSON.stringify(items));
    console.log("✅ Item saved successfully");
    notify("✅ Item saved successfully!");
    navigateTo("home");
  } catch (error) {
    console.error("❌ Save failed:", error);
    notify("❌ Failed to save item. Please try again.");
  }
}
