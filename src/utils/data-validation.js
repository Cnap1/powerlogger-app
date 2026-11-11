import { notify } from "../components/dialog.js";

export function validateFormData(newItem) {
    if (!newItem.area) {
        notify('Please select an area!');
        return false;
    }

    if (!newItem.type) {
        notify('Please select a type!');
        return false;
    }

    if (newItem.type === 'mood' && !newItem.title) {
        const now = new Date();
        // Get selected emotion directly from DOM
        const selectedIcon = document.querySelector('.emotion-icon.selected');
        const emotionLabel = selectedIcon ? ` - ${selectedIcon.dataset.label}` : '';
        newItem.title = `Mood${emotionLabel} - ${now.toLocaleString()}`;
    }

    if (!newItem.title) {
        notify('Title is required!');
        return false;
    }

    // Skip content validation for Journal type since content is generated from journal sections
    if (newItem.type !== 'journal' && !newItem.content) {
        notify('Content is required!');
        return false;
    }

    return true;
}

export function validateConfig(config) {
    const requiredFields = {
        'areas': 'array',
        'entryTypes': 'array',
        'categoriesByArea': 'object',
    };

    for (const [field, type] of Object.entries(requiredFields)) {
        if (!config[field]) {
            throw new Error(`Missing required field: ${field}`);
        }

        if (type === 'array' && !Array.isArray(config[field])) {
            throw new Error(`Field ${field} must be an array, got ${typeof config[field]}`);
        }

        if (type === 'object' && typeof config[field] !== 'object') {
            throw new Error(`Field ${field} must be an object, got ${typeof config[field]}`);
        }
    }

    if (config.areas.length === 0) throw new Error('Areas array is empty');
    if (config.entryTypes.length === 0) throw new Error('EntryTypes array is empty');
    validateCrossReferences(config);
}

export function validateCrossReferences(config) {
    const areaKeys = new Set(config.areas.map(area => area.key));
    const categoryAreaKeys = new Set(Object.keys(config.categoriesByArea));

    const missingCategories = [...areaKeys].filter(key => !categoryAreaKeys.has(key));
    if (missingCategories.length > 0) {
        throw new Error(`Areas missing categories: ${missingCategories.join(', ')}`);
    }

    const orphanedCategories = [...categoryAreaKeys].filter(key => !areaKeys.has(key));
    if (orphanedCategories.length > 0) {
        throw new Error(`Orphaned categories: ${orphanedCategories.join(', ')}`);
    }

    const emptyCategories = Object.entries(config.categoriesByArea)
        .filter(([, cats]) => !cats || cats.length === 0)
        .map(([area]) => area);
    if (emptyCategories.length > 0) {
        throw new Error(`Empty category arrays: ${emptyCategories.join(', ')}`);
    }
}

/**
 * Rewrites each item's `area` and `type` to the exact key used in the config
 * when they only differ in case (e.g. older items saved as "Mood" / "Work"
 * become "mood" / "work"). Unknown values are left untouched.
 *
 * @param {Array<object>} items - Stored items (modified in place).
 * @param {object} config - A validated app config.
 * @returns {number} How many items were changed.
 */
export function normalizeItemKeys(items, config) {
    const keyMap = (list) => new Map(list.map(entry => [String(entry.key).toLowerCase(), entry.key]));
    const areaKeys = keyMap(config.areas);
    const typeKeys = keyMap(config.entryTypes);
    let changed = 0;

    for (const item of items) {
        const area = typeof item.area === 'string' ? areaKeys.get(item.area.toLowerCase()) : undefined;
        const type = typeof item.type === 'string' ? typeKeys.get(item.type.toLowerCase()) : undefined;
        let itemChanged = false;
        if (area && area !== item.area) { item.area = area; itemChanged = true; }
        if (type && type !== item.type) { item.type = type; itemChanged = true; }
        // Todo importance "Medium" was renamed to "Normal"
        if (item.priority === 'Medium' && String(item.type).toLowerCase() === 'todo') { item.priority = 'Normal'; itemChanged = true; }
        // Subcategories were removed: journal kind -> journalType, todo state -> status
        if ('subcategory' in item) {
            const t = String(item.type).toLowerCase();
            if (item.subcategory && t === 'journal' && !item.journalType) item.journalType = item.subcategory;
            if (item.subcategory && t === 'todo' && !item.status) item.status = item.subcategory;
            delete item.subcategory;
            itemChanged = true;
        }
        if (itemChanged) changed++;
    }
    return changed;
}

export function checkTextareaFull(textarea) {
    if (textarea.scrollHeight > textarea.clientHeight) {
        textarea.rows += 1;
    }
}