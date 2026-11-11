// Shared mood editor (sliders + emotion picker + context) used by the
// "New Mood" form and the "Edit Item" page, so both behave the same.
import { escapeHtml } from "../utils/common.js";

const INTENSITY_LABELS = ["Low", "Medium", "High"];

/**
 * Markup for the mood editor. Uses the same ids/classes as before
 * (#moodFields, #moodSlider, #intensitySlider, #emotionPicker, #moodCategory),
 * so the existing styling applies.
 *
 * @param {object|null} mood - Existing mood to start from (edit), or null (new).
 * @param {object} [options]
 * @param {boolean} [options.hidden=false] - Render hidden (shown later by the form logic).
 * @param {string} [options.footer=""] - Extra HTML at the bottom (e.g. the SAVE button).
 */
export function moodEditorHTML(mood = null, { hidden = false, footer = "" } = {}) {
  const happiness = mood?.happiness ?? 50;
  const intensity = [1, 2, 3].includes(mood?.intensity) ? mood.intensity : 2;
  return `
    <div id="moodFields" class="form-group" style="${hidden ? "display: none;" : ""}">
        <label>Mood Tracking:</label>

        <div class="mood-sliders">
            <div class="slider-group">
                <label for="moodSlider">Happiness: <span id="moodValue">${happiness}</span>/100</label>
                <input type="range" id="moodSlider" min="1" max="100" value="${happiness}" class="mood-slider">
            </div>

            <div class="slider-group">
                <label for="intensitySlider">Intensity: <span id="intensityValue">${INTENSITY_LABELS[intensity - 1]}</span></label>
                <input type="range" id="intensitySlider" min="1" max="3" value="${intensity}" class="intensity-slider">
            </div>
        </div>

        <div class="emotion-container">
            <div class="emotion-icons" id="emotionPicker" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;"></div>
        </div>

        <div class="form-group">
            <label for="moodCategory">Context:</label>
            <input type="text" id="moodCategory" maxlength="200" value="${escapeHtml(mood?.context || "")}"
                   placeholder="What's going on? e.g. after a run, busy day at work">
        </div>
        ${footer}
    </div>
  `;
}

// The emotion chosen when editing; kept visible in the picker even if the
// sliders move away from it, until another emotion is picked.
let pinnedEmotion = null;

/**
 * Wires up the sliders and fills the emotion picker.
 * @param {object|null} initialMood - Mood whose emotion should start selected (edit page).
 */
export function initMoodEditor(initialMood = null) {
  const moodSlider = document.getElementById("moodSlider");
  const intensitySlider = document.getElementById("intensitySlider");
  const moodValue = document.getElementById("moodValue");
  const intensityValue = document.getElementById("intensityValue");
  if (!moodSlider || !intensitySlider) return;

  const label = initialMood?.secondary || initialMood?.label;
  pinnedEmotion = initialMood?.emoji && label ? { emoji: initialMood.emoji, label } : null;

  moodSlider.addEventListener("input", () => {
    if (moodValue) moodValue.textContent = moodSlider.value;
    renderEmotionPicker();
  });
  intensitySlider.addEventListener("input", () => {
    if (intensityValue) intensityValue.textContent = INTENSITY_LABELS[intensitySlider.value - 1];
    renderEmotionPicker();
  });

  renderEmotionPicker();
}

/** Shows the emotions matching the current slider values (keeps the selection). */
export function renderEmotionPicker() {
  const moodSlider = document.getElementById("moodSlider");
  const intensitySlider = document.getElementById("intensitySlider");
  const picker = document.getElementById("emotionPicker");
  if (!moodSlider || !intensitySlider || !picker) return;

  const selected = picker.querySelector(".emotion-icon.selected");
  const selectedLabel = selected?.dataset.label || pinnedEmotion?.label;

  const match = window.getMatchingEmoticonsByIntensity; // defined in app.js
  const matches = typeof match === "function"
    ? match(parseInt(moodSlider.value, 10), parseInt(intensitySlider.value, 10)) || []
    : [];

  const emotions = matches.map((e) => ({ emoji: e.emoji, label: e.secondary || e.name }));
  // Keep the current / saved emotion in the list so it stays selectable
  const keep = selected ? { emoji: selected.dataset.emoji, label: selected.dataset.label } : pinnedEmotion;
  if (keep && !emotions.some((e) => e.label === keep.label)) emotions.unshift(keep);

  if (emotions.length === 0) {
    picker.innerHTML = "<p>No matching emotions - move the sliders</p>";
    return;
  }

  picker.innerHTML = emotions
    .map(
      (e) => `
        <div class="emotion-icon${e.label === selectedLabel ? " selected" : ""}" role="button" tabindex="0"
             data-emoji="${escapeHtml(e.emoji)}" data-label="${escapeHtml(e.label)}">
            <span class="emoji">${escapeHtml(e.emoji)}</span>
            <span class="emotion-label">${escapeHtml(e.label)}</span>
        </div>`
    )
    .join("");

  picker.querySelectorAll(".emotion-icon").forEach((icon) => {
    const choose = () => {
      picker.querySelectorAll(".emotion-icon").forEach((i) => i.classList.remove("selected"));
      icon.classList.add("selected");
      pinnedEmotion = { emoji: icon.dataset.emoji, label: icon.dataset.label };
      window.selectedEmoji = icon.dataset.emoji;
    };
    icon.addEventListener("click", choose);
    icon.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        choose();
        icon.click(); // lets other listeners (e.g. the SAVE label) react too
      }
    });
  });
}

/**
 * Reads the editor. Returns null when no emotion is selected.
 * @returns {{happiness:number,intensity:number,emoji:string,label:string,secondary:string,context:string|null}|null}
 */
export function readMoodEditor() {
  const selected = document.querySelector("#emotionPicker .emotion-icon.selected");
  if (!selected) return null;
  const label = selected.dataset.label;
  const context = document.getElementById("moodCategory")?.value.trim() || "";
  return {
    happiness: parseInt(document.getElementById("moodSlider").value, 10),
    intensity: parseInt(document.getElementById("intensitySlider").value, 10),
    emoji: selected.dataset.emoji,
    label,
    secondary: label,
    context: context || null,
  };
}
