// Export helpers: file download, Markdown export and Logseq export.

const byNewest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

/** "YYYY-MM-DD" in local time */
function localDay(isoDate) {
  const d = new Date(isoDate);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Markdown export (works well in Obsidian): one heading per day, one bullet
 * block per entry with its properties.
 *
 * @param {Array} items - Entries to export.
 * @param {object} [config] - App config, for area/type labels.
 * @returns {string}
 */
export function generateMarkdownExport(items, config = window.appConfig) {
  const labelOf = (list, key) => {
    const entry = (list || []).find((e) => e.key === key);
    return entry ? `${entry.emoji ? entry.emoji + " " : ""}${entry.label}` : key || "";
  };

  const byDay = {};
  [...items].sort(byNewest).forEach((item) => {
    (byDay[localDay(item.createdAt)] ||= []).push(item);
  });

  const lines = [`# PowerLogger export`, ``, `Exported ${new Date().toLocaleString()} - ${items.length} entries`, ``];
  Object.entries(byDay).forEach(([day, dayItems]) => {
    lines.push(`## ${day}`, ``);
    dayItems.forEach((item) => {
      const time = new Date(item.createdAt).toTimeString().slice(0, 5);
      const title =
        item.type === "mood" && item.mood
          ? `${item.mood.emoji || ""} ${item.mood.secondary || item.mood.label || "Mood"}`.trim()
          : item.title || "(untitled)";
      lines.push(`### ${time} ${title}`);
      lines.push(`- Type: ${labelOf(config?.entryTypes, item.type)}`);
      lines.push(`- Area: ${labelOf(config?.areas, item.area)}`);
      if (item.category) lines.push(`- Category: ${item.category}`);
      if (item.journalType) lines.push(`- Journal type: ${item.journalType}`);
      if (item.status) lines.push(`- Status: ${item.status}`);
      if (item.priority) lines.push(`- Priority: ${item.priority}`);
      if (item.mood) {
        lines.push(`- Mood: ${item.mood.happiness}/100, intensity ${item.mood.intensity}/3`);
        if (item.mood.context) lines.push(`- Context: ${item.mood.context}`);
      }
      if (item.deadline && item.deadline !== "NO_DEADLINE") lines.push(`- Deadline: ${localDay(item.deadline)}`);
      if (item.tags?.length) lines.push(`- Tags: ${item.tags.map((tag) => `#${tag.replace(/\s+/g, "-")}`).join(" ")}`);
      if (item.content && item.type !== "mood") lines.push(``, item.content);
      lines.push(``);
    });
  });
  return lines.join("\n");
}

/**
 * Generates a Logseq export file (JSON with one page per day).
 *
 * @param {Array} items - The entries to export.
 * @param {number} [limit=Infinity] - The maximum number of entries to include.
 * @returns {string} The JSON string for the export.
 */
export function generateLogseqExport(items, limit = Infinity) {
  const recentItems = [...items].sort(byNewest).slice(0, limit);

  // Group items by date, e.g. "Apr 23th, 2025"
  const itemsByDate = recentItems.reduce((acc, item) => {
    const date = new Date(item.createdAt)
      .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      .replace(",", "th,");
    (acc[date] ||= []).push(item);
    return acc;
  }, {});

  const pages = Object.entries(itemsByDate).map(([date, pageItems]) => ({
    id: generateUUID(),
    "page-name": date,
    properties: null,
    children: pageItems.map((item) => {
      let content = `**${item.title}**\n`;
      content += `- Type: #${item.type}\n`;
      content += `- Area: #${item.area}\n`;

      if (item.category) content += `- Category: ${item.category}\n`;
      if (item.journalType) content += `- Journal type: ${item.journalType}\n`;
      if (item.status) content += `- Status: ${item.status}\n`;
      if (item.priority) content += `- Priority: ${item.priority}\n`;

      if (item.mood) {
        content += `- Mood: ${item.mood.emoji} ${item.mood.secondary || item.mood.label || "Unknown"} (${item.mood.happiness}/100)\n`;
      }

      if (item.deadline && item.deadline !== "NO_DEADLINE") {
        content += `- Deadline: [[${new Date(item.deadline).toLocaleDateString()}]]\n`;
      }

      content += `- Content: ${item.content}\n`;

      if (item.tags && item.tags.length > 0) {
        content += `- Tags: ${item.tags.map((tag) => `#${tag}`).join(" ")}\n`;
      }

      return {
        id: generateUUID(),
        properties: null,
        format: "markdown",
        children: [],
        content: content.trim(),
      };
    }),
  }));

  return JSON.stringify({ pages }, null, 2);
}

function generateUUID() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Downloads a file with the given content and filename.
 *
 * @param {string} content - The content of the file.
 * @param {string} filename - The name of the file.
 * @param {string} [mimeType="text/plain"] - The MIME type of the file.
 */
export function downloadFile(content, filename, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
