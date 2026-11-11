// Import utilities
import { navigateTo } from './src/utils/app-navigation.js';
import { initTopNav } from './src/components/top-nav.js';
import { startReminderWatcher } from './src/utils/reminder.js';
import { validateConfig, normalizeItemKeys } from './src/utils/data-validation.js';

const CONFIG_URL = './src/config/appconfig.json';
const EMOTION_DATA_URL = './src/config/emotiondata.json';
const CONFIG_CACHE_KEY = 'localAppConfig';         // copy of the config in use (read by the pages)
const USER_CONFIG_KEY = 'powerloggerUserConfig';   // settings saved on the Settings page

// Global state
let emotionData = null;

/** Settings saved by the user, if present and valid */
function loadUserConfig() {
    try {
        const saved = localStorage.getItem(USER_CONFIG_KEY);
        if (!saved) return null;
        const config = JSON.parse(saved);
        validateConfig(config);
        return config;
    } catch (error) {
        console.error('Saved settings are invalid and were ignored:', error.message);
        localStorage.removeItem(USER_CONFIG_KEY);
        return null;
    }
}

/**
 * Brings settings saved by an older version up to date. Returns true when
 * something changed (so the caller saves them again).
 */
function upgradeSavedConfig(config) {
    let changed = false;
    // Subcategories were removed; journal types and todo statuses fall back
    // to the defaults (see kindOptions in common.js)
    if ('subcategories' in config) { delete config.subcategories; changed = true; }
    // Journal used the same ✅ as Todo
    const journal = config.entryTypes?.find((type) => type.key === 'journal');
    if (journal?.emoji === '✅') { journal.emoji = '📓'; changed = true; }
    // Category labels show their emoji (e.g. "Observation" -> "👀 Observation")
    for (const categories of Object.values(config.categoriesByArea || {})) {
        for (const cat of categories || []) {
            if (cat?.emoji && typeof cat.label === 'string' && !cat.label.startsWith(cat.emoji)) {
                cat.label = `${cat.emoji} ${cat.label}`;
                changed = true;
            }
        }
    }
    return changed;
}

/**
 * Loads the config: the user's saved settings when present, otherwise
 * appconfig.json. If neither works, falls back to the last valid cached config.
 * @returns {Promise<object>} A validated config.
 */
async function loadAppConfig() {
    const userConfig = loadUserConfig();
    if (userConfig) {
        if (upgradeSavedConfig(userConfig)) {
            localStorage.setItem(USER_CONFIG_KEY, JSON.stringify(userConfig));
        }
        localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(userConfig));
        console.log('✅ Using saved settings');
        return userConfig;
    }
    try {
        const response = await fetch(CONFIG_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const config = await response.json();
        validateConfig(config);

        // Keep a copy of the last valid config as a backup
        localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));
        console.log('✅ Config loaded successfully:', config);
        return config;
    } catch (error) {
        console.error('❌ Failed to load config:', error);
        return loadCachedConfig(error);
    }
}

/**
 * Returns the cached config from localStorage, or throws if there is none
 * or it is invalid.
 */
function loadCachedConfig(originalError) {
    const saved = localStorage.getItem(CONFIG_CACHE_KEY);
    if (!saved) {
        throw new Error(`Unable to load configuration (${originalError.message}). Please ensure appconfig.json is accessible.`);
    }
    try {
        const config = JSON.parse(saved);
        validateConfig(config);
        console.info('🔄 Using cached config from localStorage');
        return config;
    } catch (cacheError) {
        localStorage.removeItem(CONFIG_CACHE_KEY);
        throw new Error(`Unable to load configuration; cached config is invalid: ${cacheError.message}`);
    }
}

// Load emotion data (never throws; falls back to an empty list)
async function loadEmotionData() {
    try {
        const response = await fetch(EMOTION_DATA_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        emotionData = await response.json();
        console.log('Emotion data loaded successfully');
    } catch (error) {
        console.error('Failed to load emotion data:', error);
        emotionData = { emotions: [] };
    }
    return emotionData;
}

// Initialize emotion functions globally
function initializeEmotionFunctions() {
    window.getMatchingEmoticonsByIntensity = function(moodScore, intensityLevel) {
        if (!emotionData || !emotionData.emotions) return [];

        return emotionData.emotions
            .filter(emotion => {
                const matchesIntensity = emotion.intensity === intensityLevel;
                const matchesScore = Math.abs(emotion.score - moodScore) <= 25;
                return matchesIntensity && matchesScore;
            })
            .sort((a, b) => Math.abs(a.score - moodScore) - Math.abs(b.score - moodScore))
            .slice(0, 6);
    };

    window.getMatchingEmoticons = function(moodScore) {
        if (!emotionData || !emotionData.emotions) return [];

        return emotionData.emotions
            .filter(emotion => Math.abs(emotion.score - moodScore) <= 15)
            .sort((a, b) => Math.abs(a.score - moodScore) - Math.abs(b.score - moodScore));
    };
}

/**
 * One-time-safe migration: make stored items use the config's area/type keys
 * (older items were saved with capitalized names like "Mood").
 */
function migrateStoredItems(config) {
    try {
        const items = JSON.parse(localStorage.getItem('logseqItems') || '[]');
        const changed = normalizeItemKeys(items, config);
        if (changed > 0) {
            localStorage.setItem('logseqItems', JSON.stringify(items));
            console.info(`🔄 Migrated ${changed} stored items to the current format`);
        }
    } catch (error) {
        console.error('Failed to migrate stored items:', error);
    }
}

// Delete item function (global)
window.deleteItem = function(itemId) {
    const items = JSON.parse(localStorage.getItem('logseqItems') || '[]');
    const filteredItems = items.filter(item => item.id !== itemId);
    localStorage.setItem('logseqItems', JSON.stringify(filteredItems));
};

// Navigation function (global)
window.navigateTo = navigateTo;

function showInitError(error) {
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = `
        <div class="container">
            <h1>Initialization Error</h1>
            <div class="error-message">
                <p>⚠️ PowerLogger failed to initialize properly.</p>
                <p class="error-detail"></p>
                <p>Please check the console for more details.</p>
                <button onclick="location.reload()" class="btn btn-primary">
                    🔄 Try Again
                </button>
            </div>
        </div>
    `;
    app.querySelector('.error-detail').textContent = `Error: ${error.message}`;
}

/** Offline support + installable app. Needs http(s); not available on file:// */
function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker
        .register('./sw.js')
        .catch((error) => console.warn('Service worker not registered:', error));
}

/**
 * Asks the browser to keep this site's storage (entries + settings) permanently,
 * so it is not cleared automatically when the disk runs low.
 */
function requestPersistentStorage() {
    if (!navigator.storage?.persist) return;
    navigator.storage.persisted()
        .then((persisted) => persisted || navigator.storage.persist())
        .catch(() => { /* not supported: storage stays "best effort" */ });
}

/**
 * Initializes the PowerLogger application.
 */
async function initializeApp() {
    try {
        window.appConfig = await loadAppConfig();
        migrateStoredItems(window.appConfig);
        window.emotionData = await loadEmotionData();
        initializeEmotionFunctions();

        const app = document.getElementById('app');
        if (app) app.innerHTML = ''; // Clear the loading state
        initTopNav();
        navigateTo('home');

        // Daily mood reminder (notification while the app is open)
        startReminderWatcher(() => navigateTo('add', null, 'mood'));
        registerServiceWorker();
        requestPersistentStorage();

        console.log('✅ PowerLogger initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize PowerLogger:', error);
        showInitError(error);
    }
}

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
