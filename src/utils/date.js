/**
 * Utility functions for date manipulation and formatting.
 *
 * @module utils/date
 */

// src/utils/dateUtils.js - Refactored date utilities

export function initializeDateUtils() {
    return {
        getTimeAgo,
        getTodayStreak,
        calculateDate,
        updateCustomDeadline,
        initializeCustomDatePicker,
        handleMainDateSelection,
        handleSubDateSelection,
    };
}
  


    // Initialize custom date picker
    function initializeCustomDatePicker() {
        const todoDeadline = document.getElementById('todoDeadline');
        const todoTime = document.getElementById('todoTime');
        if (todoDeadline) todoDeadline.addEventListener('change', updateCustomDeadline);
        if (todoTime) todoTime.addEventListener('change', updateCustomDeadline);
    }

    // Update custom deadline
    function updateCustomDeadline() {
        const dateInput = document.getElementById('todoDeadline');
        const timeInput = document.getElementById('todoTime');

        if (dateInput && timeInput && dateInput.value && timeInput.value) {
            const deadline = new Date(`${dateInput.value}T${timeInput.value}`);
            const hiddenValue = document.getElementById('todoDeadlineValue');
            const selectedDisplay = document.getElementById('selectedDeadline');

            if (hiddenValue) hiddenValue.value = deadline.toISOString();
            if (selectedDisplay) selectedDisplay.textContent = `Deadline: ${deadline.toLocaleDateString()} at ${deadline.toLocaleTimeString()}`;
        }
    }

    // Handle main date selection
    function handleMainDateSelection(type) {
        const customPicker = document.getElementById('customDatePicker');
        const selectedDisplay = document.getElementById('selectedDeadline');
        const hiddenValue = document.getElementById('todoDeadlineValue');

        if (type === 'none') {
            if (selectedDisplay) selectedDisplay.textContent = 'No deadline set';
            if (hiddenValue) hiddenValue.value = 'NO_DEADLINE';
            if (customPicker) customPicker.style.display = 'none';
        } else if (type === 'custom') {
            if (customPicker) customPicker.style.display = 'block';
            if (selectedDisplay) selectedDisplay.textContent = 'Select custom date and time';
        }
    }

    // Handle sub-date selection
    function handleSubDateSelection(action, days, buttonText) {
        const hiddenValue = document.getElementById('todoDeadlineValue');
        const selectedDisplay = document.getElementById('selectedDeadline');
        
        // Get selected area for end-this-week logic
        const selectedArea = (document.getElementById('itemArea') || document.getElementById('editArea'))?.value;
        
        let targetDate = calculateDate(action, days, selectedArea);

        if (targetDate && hiddenValue && selectedDisplay) {
            targetDate.setHours(9, 0, 0, 0);
            hiddenValue.value = targetDate.toISOString();
            selectedDisplay.textContent = `Due: ${targetDate.toLocaleDateString()} (${buttonText}) at 09:00`;
        }
    }

    // Calculate target date based on action or days
    function calculateDate(action, days, selectedArea = null) {
        const today = new Date();
        let targetDate = new Date();

        if (days) {
            targetDate.setDate(today.getDate() + parseInt(days));
        } else {
            switch (action) {
                case 'next-monday':
                    const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
                    targetDate.setDate(today.getDate() + daysUntilMonday);
                    break;
                case 'same-next-week':
                    targetDate.setDate(today.getDate() + 7);
                    break;
                case 'end-this-week':
                    // Friday if work area, Sunday if other areas
                    const isWorkArea = selectedArea === 'work';
                    const currentDay = today.getDay();
                    
                    if (isWorkArea) {
                        // Target Friday (5)
                        const daysUntilFriday = (5 - currentDay + 7) % 7;
                        if (daysUntilFriday === 0) {
                            // Today is Friday, go to next Friday
                            targetDate.setDate(today.getDate() + 7);
                        } else {
                            targetDate.setDate(today.getDate() + daysUntilFriday);
                        }
                    } else {
                        // Target Sunday (0)
                        const daysUntilSunday = (7 - currentDay) % 7;
                        if (daysUntilSunday === 0) {
                            // Today is Sunday, go to next Sunday
                            targetDate.setDate(today.getDate() + 7);
                        } else {
                            targetDate.setDate(today.getDate() + daysUntilSunday);
                        }
                    }
                    break;
                
                case 'end-next-week':
                    // Same logic as end-this-week but add 7 days
                    const isWorkAreaNext = selectedArea === 'work';
                    const currentDayNext = today.getDay();
                    
                    if (isWorkAreaNext) {
                        const daysUntilNextFriday = (5 - currentDayNext + 14) % 7 + 7;
                        targetDate.setDate(today.getDate() + daysUntilNextFriday);
                    } else {
                        const daysUntilNextSunday = (7 - currentDayNext) % 7 + 7;
                        targetDate.setDate(today.getDate() + daysUntilNextSunday);
                    }
                    break;

                case 'end-of-month':
                    targetDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    break;

                case 'wk1-next-month':
                    // First week of next month (first Monday)
                    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                    const daysToFirstMonday = (8 - nextMonth.getDay()) % 7 || 7;
                    targetDate = new Date(nextMonth.getTime());
                    targetDate.setDate(1 + daysToFirstMonday);
                    break;

                case 'plus-one-month':
                    // Exactly one calendar month from today
                    targetDate.setMonth(today.getMonth() + 1);
                    // Handle month overflow (e.g., Jan 31 + 1 month = Feb 28)
                    if (targetDate.getMonth() !== (today.getMonth() + 1) % 12) {
                        targetDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
                    }
                    break;

                case 'end-of-next-month':
                    // Last day of next month
                    targetDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
                    break;
                

            }
        }

        return targetDate;
}

    // Get time ago (e.g., "5m", "2h", "3d")
    function getTimeAgo(dateString) {
        const now = new Date();
        const past = new Date(dateString);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        return `${diffDays}d`;
    }

    // Calculate today's streak
    function getTodayStreak(items) {
        let streak = 0;
        const today = new Date();

        for (let i = 0; i < 30; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);

            const hasEntry = items.some(item => {
                const itemDate = new Date(item.createdAt);
                return itemDate.toDateString() === checkDate.toDateString();
            });

            if (hasEntry) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    }

