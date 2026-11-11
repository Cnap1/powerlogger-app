// src/pages/item-editor.js - Complete add item page

import { initializeForms, generateJournal, moodContent } from '../components/forms.js';
import { Buttons } from '../components/buttons.js';
import { navigateTo, goBack } from '../utils/app-navigation.js';
import { initializeUIComponents } from '../components/ui.js';
import { displayLabel, escapeHtml, kindField, kindOptions } from '../utils/common.js';
import { moodEditorHTML, initMoodEditor, readMoodEditor } from '../components/mood-editor.js';
import { notify, confirmDialog } from '../components/dialog.js';

// Types that can't be created from the New Item page (existing items of these types can still be edited)
const HIDDEN_NEW_ITEM_TYPES = ['meeting', 'project', 'template'];

let selectedEmoji = null;


export function renderAddItemPage(preselectedArea = null, preselectedType = null) {
    console.log('🔄 renderAddItemPage called with:', { preselectedArea, preselectedType });
    
    // Dependency validation
    if (!window.navigateTo || !window.appConfig || !window.emotionData) {
        console.error('❌ Missing global dependencies');
        renderDependencyError();
        return;
    }
    
    if (!window.getMatchingEmoticonsByIntensity || !window.getMatchingEmoticons) {
        console.error('❌ Missing emotion functions');
        renderDependencyError();
        return;
    }

    console.log('✅ All dependencies validated, proceeding with form generation');
    
    const localConfig = JSON.parse(localStorage.getItem('localAppConfig')) || window.appConfig;
    const app = document.getElementById('app');

    // Defaults from appconfig.json (defaultSettings): personal / note
    const defaults = localConfig.defaultSettings || {};
    preselectedArea = preselectedArea || defaults.defaultArea || null;
    preselectedType = preselectedType || defaults.defaultType || null;

    // Generate and render form HTML
    console.log('🏗️ Generating form HTML');
    app.innerHTML = generateFormHTML(localConfig);
    console.log('✅ Form HTML rendered');

    // Mood tracker: the mood form only shows the mood fields (no area/type/title/content/tags)
    // (Mood fields are toggled by the selected type: see TypeButtons in components/buttons.js)

    // Back/menu navigation is handled by the shared top bar (components/top-nav.js)
    document.getElementById('cancelButton')?.addEventListener('click', () => navigateTo('home'));
    
    // Initialize components after DOM is created
    console.log('🔧 Initializing components');
    try {
        Buttons();
        initializeForms(localConfig, preselectedArea, preselectedType);
        const uiComponents = initializeUIComponents();
        console.log('✅ Components initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing components:', error);
    }
        
    console.log('🎉 renderAddItemPage completed successfully');
}

function renderDependencyError() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="container">
            <h1>Loading Error</h1>
            <p>Required components not loaded. Refreshing...</p>
        </div>
    `;
    setTimeout(() => location.reload(), 2000);
}



export function renderEditItemPage(itemId) {
    const app = document.getElementById('app');
    const items = JSON.parse(localStorage.getItem('logseqItems') || '[]');
    const item = items.find(i => i.id === itemId);
    
    if (!item) {
        notify('Item not found!');
        navigateTo('home');
        return;
    }

    const localConfig = JSON.parse(localStorage.getItem('localAppConfig')) || window.appConfig;
    const isMood = item.type === 'mood';

    app.innerHTML = `
    <div class="container">
        <div class="edit-header">
            <h1>${isMood ? 'Edit Mood' : 'Edit Item'}</h1>
            <div class="edit-actions">
                <button type="button" id="deleteItem" class="btn btn-warning">🗑️ Delete</button>
            </div>
        </div>

        <form id="editItemForm">
            <!-- Entry date: native calendar + time picker -->
            <div class="edit-field-full edit-date-field">
                <label for="editCreatedAt">📅 Date</label>
                <input type="datetime-local" id="editCreatedAt" value="${formatDateForInput(item.createdAt)}"
                       max="${formatDateForInput(new Date().toISOString())}" required>
                ${item.updatedAt ? `<span class="timestamp-updated">Last updated: ${new Date(item.updatedAt).toLocaleString()}</span>` : ''}
            </div>

            ${isMood ? moodEditorHTML(item.mood) : `
            <div class="edit-field-full">
                <select id="editArea" required>
                    ${localConfig.areas.map(area =>
                        `<option value="${area.key}" ${item.area === area.key ? 'selected' : ''}>${displayLabel(area)}</option>`
                    ).join('')}
                </select>
            </div>

            <!-- Importance: same buttons as the New Item page -->
            <div class="edit-field-full" id="editPriorityGroup" style="display: ${shouldShowPriority(item) ? 'block' : 'none'};">
                <label class="edit-label">Importance</label>
                <div class="priority-buttons" id="editPriorityButtons">
                    ${priorityButtonsHTML(localConfig, item.type, item.priority)}
                </div>
                <input type="hidden" id="editPriority" value="${escapeHtml(pickPriority(localConfig, item.type, item.priority))}">
            </div>

            <!-- Type, then Journal type / Status (journal and todo only) -->
            <div class="edit-field-full">
                <select id="editType" required>
                    ${localConfig.entryTypes.map(type =>
                        `<option value="${type.key}" ${item.type === type.key ? 'selected' : ''}>${displayLabel(type)}</option>`
                    ).join('')}
                </select>
            </div>

            <div class="edit-field-full" id="editKindGroup" style="display: ${kindField(item.type) ? 'block' : 'none'};">
                <select id="editKind">
                    ${generateKindOptions(localConfig, item.type, item[kindField(item.type)])}
                </select>
            </div>

            <!-- Category full width -->
            <div class="edit-field-full" id="editCategoryGroup" style="display: ${shouldShowCategories(item) ? 'block' : 'none'};">
                <select id="editCategory">
                    <option value="">Select category...</option>
                    ${generateCategoryOptions(localConfig, item.area, item.type, item.category)}
                </select>
            </div>

            <!-- Todo deadline -->
            <div class="edit-field-full" id="editDateGroup" style="display: ${item.type === 'todo' ? 'block' : 'none'};">
                <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="datetime-local" id="editDeadline" value="${formatDateForInput(item.deadline)}" style="flex: 1;">
                    <button type="button" id="clearDeadline" class="btn btn-small">Clear</button>
                </div>
            </div>
            
            <!-- FIXED: Journal interface -->
            ${item.type === 'journal' ? `
            <div id="editJournalInterface" class="journal-interface">
                <div class="journal-header">
                    <h3>📓 Journal Content</h3>
                    <button type="button" id="recreateJournal" class="btn btn-secondary btn-small">Recreate Journal Structure</button>
                </div>
                
                <div id="journalSections" style="display: none;">
                    <!-- Will be populated by recreateJournal button -->
                </div>
            </div>
            ` : ''}
            
            <!-- Title full width -->
            <div class="edit-field-full">
                <input type="text" id="editTitle" value="${escapeHtml(item.title)}" placeholder="Title..." required>
            </div>
            
            <!-- Content full width -->
            <div class="edit-field-full">
                <textarea id="editContent" rows="8" placeholder="Content..." required>${escapeHtml(item.content)}</textarea>
            </div>

            <!-- Tags below content -->
            <div class="edit-field-full">
                <input type="text" id="editTags" value="${escapeHtml((item.tags || []).join(', '))}" placeholder="Tags (comma separated)">
            </div>
            `}

            <div class="form-actions">
                <button type="button" id="cancelEdit" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary">💾 Save</button>
            </div>
        </form>
    </div>
    `;
    
    // Initialize dropdown change handlers
    initializeEditHandlers(item, items, localConfig);
}

// Helper functions
function shouldShowCategories(item) {
    return !['journal', 'mood'].includes(item.type);
}

// Same as the New Item page: no importance for moods and journals
function shouldShowPriority(item) {
    return !['mood', 'journal'].includes(item.type);
}

function generateCategoryOptions(config, selectedArea, selectedType, currentCategory) {
    if (selectedType === 'todo') {
        const categories = config.todoCategories || [];
        return categories.map(cat => 
            `<option value="${cat}" ${cat === currentCategory ? 'selected' : ''}>${cat}</option>`
        ).join('');
    } else {
        // Area categories are {key, label} objects (older configs: plain strings)
        const categories = config.categoriesByArea?.[selectedArea] || [];
        return categories.map(cat => {
            const key = cat?.key ?? cat;
            const label = cat?.label ?? cat;
            return `<option value="${escapeHtml(key)}" ${key === currentCategory ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        }).join('');
    }
}

// Journal type (journal) or Status (todo) options; the first is the default
function generateKindOptions(config, selectedType, current) {
    const options = kindOptions(config, selectedType);
    const values = current && !options.includes(current) ? [current, ...options] : options;
    return values.map(value =>
        `<option value="${escapeHtml(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(value)}</option>`
    ).join('');
}

function prioritiesFor(config, selectedType) {
    return (selectedType === 'todo' ? config.priorities?.todo : config.priorities?.default) || [];
}

// The item's own importance when it is on this type's scale, otherwise Normal
// (older settings call it Medium), otherwise the first one
function pickPriority(config, selectedType, current) {
    const values = prioritiesFor(config, selectedType).map(p => p.value);
    return [current, 'Normal', 'Medium'].find(v => values.includes(v)) || values[0] || '';
}

function priorityButtonsHTML(config, selectedType, current) {
    const active = pickPriority(config, selectedType, current);
    return prioritiesFor(config, selectedType).map(p =>
        `<button type="button" class="priority-btn ${p.value === active ? 'active' : ''}" data-priority="${escapeHtml(p.value)}">${p.emoji || ''} ${escapeHtml(p.label || p.value)}</button>`
    ).join('');
}

/**
 * ISO date -> "YYYY-MM-DDTHH:MM" in LOCAL time for <input type="datetime-local">.
 * (toISOString() would give UTC and shift the time by the timezone offset on every save.)
 */
function formatDateForInput(isoDate) {
    if (!isoDate || isoDate === 'NO_DEADLINE') return '';
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// FIXED: Add missing populateJournalFromContent function
function populateJournalFromContent(content) {
    // Try to parse structured journal content back into sections
    const sections = content.split('\n\n');
    
        sections.forEach(section => {
            const match = section.match(/^\*\*(.*?):\*\*\n([\s\S]*)/);
            if (match) {
                const sectionTitle = match[1];
                const sectionContent = match[2];
                
                const textarea = document.querySelector(`.journal-textarea[data-section="${sectionTitle}"]`);
                if (textarea) {
                    textarea.value = sectionContent;
                }
            }

        });
}

function initializeEditHandlers(item, items, config) {

    // Delete button
    document.getElementById('deleteItem')?.addEventListener('click', async function() {
        if (await confirmDialog('Delete this item? This cannot be undone.', { okLabel: 'Delete', danger: true })) {
            const itemIndex = items.findIndex(i => i.id === item.id);
            if (itemIndex !== -1) {
                items.splice(itemIndex, 1);
                localStorage.setItem('logseqItems', JSON.stringify(items));
                notify('Item deleted successfully!');
                goBack();
            }
        }
    });

    // Recreate journal button handler
    document.getElementById('recreateJournal')?.addEventListener('click', function() {
        const journalType = document.getElementById('editKind')?.value || item.journalType;
        if (journalType && config.journalTemplates?.[journalType]) {
            const journalSections = document.getElementById('journalSections');
            const titleField = document.getElementById('editTitle').closest('.edit-field-full');
            const contentField = document.getElementById('editContent').closest('.edit-field-full');
            
            if (this.textContent === 'Recreate Journal Structure') {
                titleField.style.display = 'none';
                contentField.style.display = 'none';
                journalSections.style.display = 'block';
                
                import('../components/forms.js').then(({ generateJournal }) => {
                    generateJournal(journalType, config);
                    populateJournalFromContent(item.content);
                });
                
                this.textContent = 'Use Regular Editing';
            } else {
                titleField.style.display = 'block';
                contentField.style.display = 'block';
                journalSections.style.display = 'none';
                this.textContent = 'Recreate Journal Structure';
            }
        } else {
            notify('No journal template found for this journal type');
        }
    });

    // Area change handler
    document.getElementById('editArea')?.addEventListener('change', function() {
        const selectedArea = this.value;
        const categorySelect = document.getElementById('editCategory');
        
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">Select category...</option>' + 
                generateCategoryOptions(config, selectedArea, document.getElementById('editType').value, '');
        }
    });

    // Type change handler  
    document.getElementById('editType')?.addEventListener('change', function() {
        const selectedType = this.value;
        const kindSelect = document.getElementById('editKind');
        const kindGroup = document.getElementById('editKindGroup');
        const priorityGroup = document.getElementById('editPriorityGroup');
        const priorityButtons = document.getElementById('editPriorityButtons');
        const priorityInput = document.getElementById('editPriority');
        const categoryGroup = document.getElementById('editCategoryGroup');
        const dateGroup = document.getElementById('editDateGroup');

        if (categoryGroup) categoryGroup.style.display = shouldShowCategories({type: selectedType}) ? 'block' : 'none';
        if (kindGroup) kindGroup.style.display = kindField(selectedType) ? 'block' : 'none';
        if (priorityGroup) priorityGroup.style.display = shouldShowPriority({type: selectedType}) ? 'block' : 'none';
        if (dateGroup) dateGroup.style.display = selectedType === 'todo' ? 'block' : 'none';

        if (kindSelect) kindSelect.innerHTML = generateKindOptions(config, selectedType, '');

        // Importance scale differs per type (todo: Low..Critical); keep the value when it still fits
        if (priorityButtons && priorityInput) {
            priorityButtons.innerHTML = priorityButtonsHTML(config, selectedType, priorityInput.value);
            priorityInput.value = pickPriority(config, selectedType, priorityInput.value);
        }
    });

    // Importance buttons
    document.getElementById('editPriorityButtons')?.addEventListener('click', function(e) {
        const btn = e.target.closest('.priority-btn');
        if (!btn) return;
        this.querySelectorAll('.priority-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.getElementById('editPriority').value = btn.dataset.priority;
    });

    // Mood items: same mood editor as the "New Mood" form, starting from the saved mood
    const isMood = item.type === 'mood';
    if (isMood) {
        initMoodEditor(item.mood);
    }

    // Clear deadline button
    document.getElementById('clearDeadline')?.addEventListener('click', function() {
        document.getElementById('editDeadline').value = '';
    });

    // Cancel: back to where the user came from (home, item list, ...)
    document.getElementById('cancelEdit')?.addEventListener('click', () => goBack());

    // Form submission (SINGLE handler)
    document.getElementById('editItemForm')?.addEventListener('submit', function(e) {
        e.preventDefault();

        // Entry date from the calendar ("YYYY-MM-DDTHH:MM" is read as local time)
        const createdAtValue = document.getElementById('editCreatedAt').value;
        const createdAtDate = createdAtValue ? new Date(createdAtValue) : null;
        if (!createdAtDate || Number.isNaN(createdAtDate.getTime())) {
            notify('Please pick a valid date!');
            return;
        }
        if (createdAtDate > new Date()) {
            notify('The date cannot be in the future.');
            return;
        }
        // Keep the original seconds when only the minutes/date changed
        if (formatDateForInput(item.createdAt) === createdAtValue) {
            createdAtDate.setTime(new Date(item.createdAt).getTime());
        }

        let updatedItem;

        if (isMood) {
            const mood = readMoodEditor();
            if (!mood) {
                notify('Please select an emotion!');
                return;
            }
            updatedItem = {
                ...item,
                mood: {
                    ...item.mood,
                    ...mood,
                    // primary belongs to the old emotion; drop it when another emotion was picked
                    primary: mood.label === (item.mood?.secondary || item.mood?.label) ? item.mood?.primary ?? null : null,
                },
                title: `Mood - ${createdAtDate.toLocaleString()}`,
                content: moodContent(mood),
                createdAt: createdAtDate.toISOString(),
                updatedAt: new Date().toISOString()
            };
        } else {
            const deadline = document.getElementById('editDeadline')?.value;
            let content = document.getElementById('editContent').value;
            let title = document.getElementById('editTitle').value.trim();

            // Handle journal content collection if journal interface is active
            const journalSections = document.querySelectorAll('.journal-textarea');
            if (journalSections.length > 0 && document.getElementById('journalSections')?.style.display !== 'none') {
                content = Array.from(journalSections)
                    .map(textarea => {
                        const section = textarea.dataset.section;
                        const sectionContent = textarea.value.trim();
                        return sectionContent ? `**${section}:**\n${sectionContent}` : '';
                    })
                    .filter(section => section !== '')
                    .join('\n\n');

                const journalType = document.getElementById('editKind')?.value || item.journalType;
                if (journalType && !title.includes(journalType)) {
                    title = `${journalType} - ${createdAtDate.toLocaleDateString()}`;
                }
            }

            updatedItem = {
                ...item,
                area: document.getElementById('editArea').value,
                type: document.getElementById('editType').value,
                category: document.getElementById('editCategory')?.value || null,
                priority: shouldShowPriority({ type: document.getElementById('editType').value }) ? (document.getElementById('editPriority')?.value || null) : null,
                title: title,
                content: content,
                tags: document.getElementById('editTags').value
                    .split(',')
                    .map(t => t.trim())
                    .filter(t => t !== ''),
                deadline: deadline ? new Date(deadline).toISOString() : 'NO_DEADLINE',
                createdAt: createdAtDate.toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Journal type / todo status live in their own field
            if (kindField(item.type)) delete updatedItem[kindField(item.type)];
            delete updatedItem.subcategory;
            const kindKey = kindField(updatedItem.type);
            const kindValue = document.getElementById('editKind')?.value;
            if (kindKey && kindValue) updatedItem[kindKey] = kindValue;

            // Validate required fields
            if (!updatedItem.title.trim()) {
                notify('Title is required!');
                return;
            }

            if (!updatedItem.content.trim()) {
                notify('Content is required!');
                return;
            }
        }

        // Update item in array
        const itemIndex = items.findIndex(i => i.id === item.id);
        if (itemIndex !== -1) {
            items[itemIndex] = updatedItem;
            localStorage.setItem('logseqItems', JSON.stringify(items));
            notify(isMood ? 'Mood updated!' : 'Item updated successfully!');
            goBack();
        } else {
            notify('Error: Item not found for update!');
        }
    });
}


function generateFormHTML(localConfig, item = null) {
    return `
        <div class="container">
            <div class="add-item-header">
                <h1>${item ? 'Edit Item' : 'New Item'}</h1>
            </div>
            
           <form id="${item ? 'editItemForm' : 'addItemForm'}">
                <div class="form-group" id="areaGroup">
                    <label id="areaLabel">Area:</label>
                    <div class="area-buttons">
                        ${localConfig.areas.map(area => 
                            `<button type="button" class="area-btn" data-area="${area.key}" title="${escapeHtml(area.label ?? area.key)}">${area.emoji ? `<span class="area-emoji">${area.emoji}</span> ` : ""}<span class="area-name">${escapeHtml(area.label ?? area.key)}</span></button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="itemArea" name="area" required>
                </div>
                
                <div id="typeGroup" class="form-group" style="display: none;">
                    <label id="typeLabel">Type:</label>
                    <div class="type-buttons">
                        ${localConfig.entryTypes
                            .filter(type => !HIDDEN_NEW_ITEM_TYPES.includes(type.key))
                            .map(type =>
                            `<button type="button" class="type-btn" data-type="${type.key}">${displayLabel(type)}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="itemType" name="type" required>
                </div>
                
                <div id="priorityGroup" class="form-group" style="display: none;">
                    <label>Importance:</label>
                    <div class="priority-buttons" id="priorityButtons">
                        <!-- Will be populated by JavaScript based on type -->
                    </div>
                    <input type="hidden" id="itemPriority" name="priority" value="Normal">
                </div>
                
                <div id="categoryGroup" class="form-group" style="display: none;">
                    <label>Category:</label>
                    <div class="category-buttons" id="categoryButtons"></div>
                    <input type="hidden" id="itemCategory" name="category" value="General">
                </div>
                
                <div id="kindGroup" class="form-group" style="display: none;">
                    <label id="kindLabel">Journal type:</label>
                    <div class="kind-buttons" id="kindButtons"></div>
                    <input type="hidden" id="itemKind" name="kind">
                </div>
                
                <div id="journalInterface" class="journal-interface" style="display: none;">
                    <div class="journal-header">
                        <h3>📓 Journal Sections</h3>
                        <button type="button" id="toggleJournalSections" class="btn btn-secondary btn-small">Show All (0/9)</button>
                    </div>
                    <div id="journalSections"></div>
                </div>
                
                <div id="todoDateGroup" class="form-group" style="display: none;">
                    <label>Deadline:</label>
                    <div class="date-picker-container">
                        <div class="todo-main-dates">
                            <button type="button" class="main-date-btn no-deadline" data-type="none">No Deadline</button>
                            <button type="button" class="main-date-btn" data-type="day">DAY</button>
                            <button type="button" class="main-date-btn" data-type="week">WEEK</button>
                            <button type="button" class="main-date-btn" data-type="month">MONTH</button>
                            <button type="button" class="main-date-btn" data-type="custom">Custom</button>
                        </div>
                        
                        <div id="dayOptions" class="sub-date-options" style="display: none;">
                            <div class="sub-date-buttons">
                                <button type="button" class="sub-date-btn" data-days="0">Today</button>
                                <button type="button" class="sub-date-btn" data-days="1">Tomorrow</button>
                                <button type="button" class="sub-date-btn" data-days="2">Day after tomorrow</button>
                            </div>
                        </div>
                        
                        <div id="weekOptions" class="sub-date-options" style="display: none;">
                            <div class="sub-date-buttons">
                                <button type="button" class="sub-date-btn" data-action="end-this-week">End of week</button>
                                <button type="button" class="sub-date-btn" data-action="same-next-week">Same day next week</button>
                                <button type="button" class="sub-date-btn" data-action="end-next-week">End of next week</button>
                            </div>
                        </div>

                        <div id="monthOptions" class="sub-date-options" style="display: none;">
                            <div class="sub-date-buttons">
                                <button type="button" class="sub-date-btn" data-action="end-of-month">End of month</button>
                                <button type="button" class="sub-date-btn" data-action="wk1-next-month">Wk1 next month</button>
                                <button type="button" class="sub-date-btn" data-action="plus-one-month">+ 1 full month</button>
                                <button type="button" class="sub-date-btn" data-action="end-of-next-month">End of next month</button>
                            </div>
                        </div>
                        
                        <div id="customDatePicker" class="custom-date-picker" style="display: none;">
                            <input type="date" id="todoDeadline" class="date-input">
                            <input type="time" id="todoTime" class="time-input" value="09:00">
                        </div>
                        
                        <div id="selectedDeadline" class="selected-deadline"></div>
                        <input type="hidden" id="todoDeadlineValue" name="deadline">
                    </div>
                </div>
                
                ${moodEditorHTML(null, { hidden: true, footer: `
                    <div class="mood-save-options">
                        <button type="button" id="saveMoodOnly" class="btn btn-primary">SAVE 😊</button>
                    </div>` })}
                <div class="form-group" id="titleGroup">
                    <label for="itemTitle" id="titleLabel">Title:</label>
                    <input type="text" id="itemTitle" name="title" placeholder="Title..." required>
                    <div class="help-text">Required field</div>
                </div>
                
                <div class="form-group" id="contentGroup">
                    <label for="itemContent">Content:</label>
                    <textarea id="itemContent" name="content" rows="6" placeholder="Enter your content here..." required></textarea>
                </div>
                
                <div class="form-group" id="tagsGroup">
                    <label for="itemTags">Tags:</label>
                    <input type="text" id="itemTags" name="tags" placeholder="Enter tags separated by commas...">
                    <div class="help-text">Separate multiple tags with commas</div>
                </div>
                
                <div class="form-actions">
                    <button type="button" id="cancelButton" class="btn btn-secondary">← Cancel</button>
                    <div class="spacer"></div>
                    ${item && item.type === 'mood' ? '' : `
                        <button type="submit" class="btn btn-primary">💾 ${item ? 'Update Item' : 'Save Item'}</button>
                    `}
                </div>
            </form>
        </div>
    `;
}