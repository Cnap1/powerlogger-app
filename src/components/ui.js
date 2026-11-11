// src/components/ui.js - UI components with all exports

import { initializeDateUtils } from '../utils/date.js';
import { initializeForms } from './forms.js';
import { Buttons } from './buttons.js';
import { validateFormData } from '../utils/data-validation.js';

// ===== MAIN UI COMPONENTS EXPORT =====



/**
 * Initializes UI components and their event handlers.
 *
 * @returns {Object} An object containing UI component functions.
 */
export function initializeUIComponents() {
    console.log('🔧 Initializing UI components');
    
    // Initialize all UI components and their event handlers
    const components = {
        // Toggle UI elements
        toggleElement: (elementId, isVisible) => {
            const element = document.getElementById(elementId);
            if (!element) {
                console.warn(`Element with ID "${elementId}" not found.`);
                return;
            }
            element.style.display = isVisible ? 'block' : 'none';
        },
               
        toggleState: (stateType, isVisible) => {
            const titleInput = document.getElementById('itemTitle');
            const contentLabel = document.querySelector('label[for="itemContent"]');

            if (stateType === 'mood') {
                if (contentLabel) contentLabel.textContent = isVisible ? 'Comment:' : 'Content:';
                ['categoryGroup', 'kindGroup', 'priorityGroup'].forEach(id =>
                    components.toggleElement(id, !isVisible)
                );
                if (titleInput) {
                    titleInput.required = !isVisible;
                    titleInput.placeholder = isVisible
                        ? 'Optional - will auto-generate if empty'
                        : 'Enter a descriptive title...';
                }
            } else if (stateType === 'journal') {
                components.toggleElement('journalInterface', isVisible);
                if (titleInput) {
                    titleInput.placeholder = isVisible
                        ? 'Enter a journal title...'
                        : 'Enter a descriptive title...';
                }
                ['categoryGroup', 'priorityGroup'].forEach(id =>
                    components.toggleElement(id, !isVisible)
                );
                if (isVisible) {
                    toggleInputFields(['itemTitle', 'itemContent', 'itemTags'], false);
                }
            }
        },


        // Show/hide form groups
        toggleFormGroup: (groupId, isVisible) => {
            const group = document.getElementById(groupId);
            if (group) {
                group.style.display = isVisible ? 'block' : 'none';
            }
        },

        // Initialize priority buttons (if not handled by Buttons())
        initializePriorityButtons: () => {
            document.querySelectorAll('.priority-btn').forEach(btn => {
                if (!btn.dataset.initialized) {
                    btn.addEventListener('click', function () {
                        document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                        const priorityInput = document.getElementById('itemPriority');
                        if (priorityInput) {
                            priorityInput.value = this.dataset.priority;
                        }
                    });
                    btn.dataset.initialized = true; // Mark as initialized
                }
            });
        }
    };

    // Initialize priority buttons if not already handled
    setTimeout(() => {
        const priorityButtons = document.querySelectorAll('.priority-btn');
        if (priorityButtons.length > 0) {
            components.initializePriorityButtons();
        }
    }, 100);

    console.log('✅ UI components initialized');
    return components;
}




initializeUIComponents

// ===== UTILITY FUNCTIONS =====

function getConfig() {
    try {
        return JSON.parse(localStorage.getItem('localAppConfig')) || window.appConfig || {};
    } catch (error) {
        console.error('Failed to load configuration:', error);
        return {};
    }
}


function toggleInputFields(fields, isVisible) {
    const config = getConfig();
    const fieldIds = config.fieldIds || {};

    fields.forEach(field => {
        const fieldId = fieldIds[field] || field;
        const fieldElement = document.getElementById(fieldId);
        const fieldGroup = fieldElement?.parentElement;

        if (fieldElement) fieldElement.style.display = isVisible ? 'block' : 'none';
        if (fieldGroup?.classList.contains('form-group')) {
            fieldGroup.style.display = isVisible ? 'block' : 'none';
        }
    });

    if (isVisible) {
        const titleInput = document.getElementById(fieldIds.title || 'itemTitle');
        if (titleInput) titleInput.required = true;
    }
}

// ===== FORM INITIALIZERS =====

// function attachHandlers(buttonClass, inputId, callback, dataAttr = 'category') {
//     const buttons = document.querySelectorAll(`.${buttonClass}`);
//     if (buttons.length === 0) {
//         console.warn(`No buttons found with class "${buttonClass}".`);
//         return;
//     }

//     buttons.forEach(btn => {
//         // Prevent duplicate event listeners
//         if (btn.dataset.initialized) return;

//         btn.addEventListener('click', function () {
//             // Remove active class from all buttons
//             buttons.forEach(b => b.classList.remove('active'));
//             this.classList.add('active');

//             // Update the input field
//             const value = this.dataset[dataAttr];
//             const inputElement = document.getElementById(inputId);
//             if (inputElement) {
//                 inputElement.value = value;
//             } else {
//                 console.warn(`Input element with ID "${inputId}" not found.`);
//             }

//             // Execute the callback if provided
//             if (typeof callback === 'function') {
//                 callback(value);
//             }
//         });

//         // Mark button as initialized
//         btn.dataset.initialized = true;
//     });
// }