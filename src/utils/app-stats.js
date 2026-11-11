/**
 * Utility functions for calculating application statistics.
 *
 * @module utils/app-statistics
 */

/**
 * Calculates the completion rate of TODO items.
 *
 * @param {Array} items - The list of items.
 * @returns {number} The completion rate as a percentage.
 */
export function getTodoCompletionRate(items) {
    if (!items || items.length === 0) return 0;

    const todos = items.filter(item => item.type === 'todo');
    if (todos.length === 0) return 0;

    const completed = todos.filter(item =>
        item.status === 'DONE'
    ).length;

    return Math.round((completed / todos.length) * 100);
}

/**
 * Gets the top 10 most used tags.
 *
 * @param {Array} items - The list of items.
 * @returns {Object} An object with tag counts.
 */
function getTagStats(items) {
    if (!items || items.length === 0) return {};

    const tagCounts = {};

    items.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        }
    });

    return Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .reduce((acc, [tag, count]) => {
            acc[tag] = count;
            return acc;
        }, {});
}

/**
 * Gets application statistics such as most used type, productivity score, latest mood, etc.
 *
 * @param {Array} items - The list of items.
 * @returns {Object} An object containing various statistics about the app usage.
 */
export function getAppStats(items = []) {
    if (!Array.isArray(items)) {
        console.error('Invalid items passed to getAppStats:', items);
        return {};
    }

    return {
        mostUsedType: getMostUsedType(items),
        productivityScore: getProductivityScore(items),
        latestMood: getLatestMood(items),
        priorityEmoji: getPriorityEmoji(items[0]?.priority),
        streakData: getStreakData(items),
        areaStats: getAreaStats(items),
        weeklyPattern: getWeeklyPattern(items),
        moodTrends: getMoodTrends(items),
        todoCompletionRate: getTodoCompletionRate(items),
        tagStats: getTagStats(items),
    };
}

/**
 * Gets the most used type of item.
 *
 * @param {Array} items - The list of items.
 * @returns {string} The most used type.
 */
function getMostUsedType(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return 'None'; // Default value when items is empty
    }

    const typeCounts = items.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
    }, {});

    return Object.keys(typeCounts).reduce((a, b) =>
        typeCounts[a] > typeCounts[b] ? a : b
    ) || 'None';
}

/**
 * Calculates the productivity score based on the items' recency and type.
 *
 * @param {Array} items - The list of items.
 * @returns {number} The productivity score between 0 and 100.
 */
function getProductivityScore(items) {
    if (!Array.isArray(items) || items.length === 0) return 0;

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekItems = items.filter(item => new Date(item.createdAt) > oneWeekAgo);

    let score = weekItems.length * 10;
    const todos = weekItems.filter(item => item.type === 'todo').length;
    const moods = weekItems.filter(item => item.type === 'mood').length;

    score += todos * 5;
    score += moods * 3;

    return Math.min(score, 100);
}

/**
 * Gets the latest mood entry.
 *
 * @param {Array} items - The list of items.
 * @returns {Object|null} The latest mood data ({emoji, secondary/label, happiness, ...}) or null.
 */
function getLatestMood(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return null; // No items available
    }

    const latestMoodItem = items
        .filter(item => item.type === 'mood' && item.mood)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

    return latestMoodItem ? { ...latestMoodItem.mood, createdAt: latestMoodItem.createdAt } : null;
}

/**
 * Gets the emoji representation of a priority level.
 *
 * @param {string} priority - The priority level.
 * @returns {string} The corresponding emoji.
 */
function getPriorityEmoji(priority) {
    if (!priority) return '';

    // Get from appConfig priorities
    const localConfig = JSON.parse(localStorage.getItem('localAppConfig')) || window.appConfig;

    if (localConfig?.priorities) {
        // Check default priorities first
        const defaultPriority = localConfig.priorities.default?.find(p => p.value === priority);
        if (defaultPriority) return defaultPriority.emoji;

        // Check todo priorities
        const todoPriority = localConfig.priorities.todo?.find(p => p.value === priority);
        if (todoPriority) return todoPriority.emoji;
    }

    // Fallback mapping if config not available
    const fallbackMap = {
        'Normal': '➖',
        'Important': '⬆️',
        'Crucial': '❗',
        'Low': '⬇️',
        'Medium': '➖',
        'High': '⬆️',
        'Critical': '❗',
    };

    return fallbackMap[priority] || '';
}

/**
 * Calculates streak data for the items.
 *
 * @param {Array} items - The list of items.
 * @returns {Object} An object containing current and longest streaks.
 */
function getStreakData(items) {
    if (!items || items.length === 0) return { current: 0, longest: 0 };

    const dates = [...new Set(items.map(item =>
        new Date(item.createdAt).toDateString()
    ))].sort((a, b) => new Date(b) - new Date(a));

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const today = new Date().toDateString();
    let checkDate = new Date();

    // Calculate current streak
    for (let i = 0; i < 365; i++) {
        const dateStr = checkDate.toDateString();
        if (dates.includes(dateStr)) {
            currentStreak++;
        } else {
            break;
        }
        checkDate.setDate(checkDate.getDate() - 1);
    }

    // Calculate longest streak
    for (let i = 0; i < dates.length - 1; i++) {
        const current = new Date(dates[i]);
        const next = new Date(dates[i + 1]);
        const diffDays = (current - next) / (1000 * 60 * 60 * 24);

        if (diffDays <= 1) {
            tempStreak++;
        } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 0;
        }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return { current: currentStreak, longest: longestStreak };
}

/**
 * Gets statistics about the areas of the items.
 *
 * @param {Array} items - The list of items.
 * @returns {Object} An object with area statistics.
 */
function getAreaStats(items) {
    if (!items || items.length === 0) return {};

    return items.reduce((acc, item) => {
        acc[item.area] = (acc[item.area] || 0) + 1;
        return acc;
    }, {});
}

/**
 * Gets the weekly pattern of item creation.
 *
 * @param {Array} items - The list of items.
 * @returns {Array} An array of length 7 representing item count per day of the week.
 */
function getWeeklyPattern(items) {
    if (!items || items.length === 0) return Array(7).fill(0);

    const weeklyData = Array(7).fill(0);

    items.forEach(item => {
        const dayOfWeek = new Date(item.createdAt).getDay();
        weeklyData[dayOfWeek]++;
    });

    return weeklyData;
}

/**
 * Gets mood trends over a period.
 *
 * @param {Array} items - The list of items.
 * @param {number} days - The number of days to look back.
 * @returns {Array} An array of mood trend data.
 */
function getMoodTrends(items, days = 30) {
    if (!items || items.length === 0) return [];

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const moodItems = items.filter(item =>
        item.type === 'mood' &&
        item.mood &&
        new Date(item.createdAt) > cutoffDate
    );

    return moodItems.map(item => ({
        date: new Date(item.createdAt).toLocaleDateString(),
        happiness: item.mood.happiness,
        intensity: item.mood.intensity,
        emoji: item.mood.emoji,
    })).reverse();
}