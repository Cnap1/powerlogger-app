import { generateId } from './common.js';

// ===== Random helpers =====
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const chance = (probability) => Math.random() < probability;

/** Picks a key from { key: weight } */
function weighted(weights) {
    const entries = Object.entries(weights);
    let roll = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
    for (const [key, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
}

/** Fills {placeholders} in a template with a random value each */
function fill(template, words) {
    return template.replace(/\{(\w+)\}/g, (match, name) => (words[name] ? pick(words[name]) : match));
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ===== Dates: each type has its own rhythm =====

/** A day in the last `days` days; recent days are more likely */
function randomDay(days) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.pow(Math.random(), 1.5) * days));
    return date;
}

/** Moves Saturday/Sunday back to Friday */
function toWeekday(date) {
    const day = date.getDay();
    if (day === 6) date.setDate(date.getDate() - 1);
    if (day === 0) date.setDate(date.getDate() - 2);
    return date;
}

/** Sets the time; never returns a moment in the future */
function at(date, hour, minute = randInt(0, 59)) {
    date.setHours(hour, minute, randInt(0, 59), 0);
    return date > new Date() ? new Date(Date.now() - randInt(5, 120) * 60 * 1000) : date;
}

const TIMING = {
    mood: () => at(randomDay(365), randInt(7, 22)),                        // all day
    note: () => at(randomDay(365), randInt(8, 21)),                        // daytime
    todo: () => at(toWeekday(randomDay(365)), randInt(8, 17)),             // work hours, weekdays
    journal: () => at(randomDay(365), randInt(19, 23)),                    // evenings
    meeting: () => at(toWeekday(randomDay(365)), randInt(9, 16), pick([0, 30])), // on the hour/half hour
    project: () => at(toWeekday(randomDay(365)), randInt(9, 17)),
    template: () => at(randomDay(365), randInt(10, 20)),
};

// ===== Content per type =====
const WORDS = {
    topic: ['habit tracking', 'time blocking', 'remote work', 'sleep quality', 'deep work', 'budgeting', 'TypeScript generics', 'team rituals', 'note-taking systems', 'meal prep'],
    source: ['a podcast', 'a blog post', 'a book chapter', 'a conversation', 'a YouTube talk', 'a newsletter'],
    task: ['send the invoice', 'book a dentist appointment', 'review the pull request', 'renew the passport', 'update the project plan', 'call the insurance company', 'clean up the backlog', 'prepare the slides', 'pay the energy bill', 'reply to the client email', 'fix the login bug', 'order a birthday present'],
    meeting: ['Team standup', 'Sprint planning', 'Client check-in', 'One-on-one', 'Retrospective', 'Roadmap review', 'Design review', 'Budget meeting'],
    project: ['Website redesign', 'Marathon training plan', 'Learn Spanish (A2)', 'Home office upgrade', 'Mobile app MVP', 'Garden makeover', 'Data dashboard', 'Kitchen renovation'],
    person: ['Sam', 'Alex', 'Jordan', 'Robin', 'Charlie', 'Kim', 'Noor', 'Lou'],
    feeling: ['calm', 'tired but satisfied', 'a bit stressed', 'energised', 'grateful', 'restless', 'content', 'proud'],
    highlight: ['a long walk in the sun', 'finishing a tricky task', 'dinner with friends', 'a good workout', 'a quiet morning', 'helping a colleague', 'reading on the couch', 'a call with family'],
    challenge: ['too many meetings', 'staying focused', 'a difficult conversation', 'low energy after lunch', 'an unexpected bug', 'not enough sleep'],
    lesson: ['small steps add up', 'ask for help earlier', 'protect the mornings', 'rest is productive too', 'write things down', 'say no more often'],
    template: ['Weekly review checklist', 'Meeting notes', 'Trip packing list', 'Bug report', 'Monthly budget', 'Book notes'],
};

const MOOD_CONTEXTS = [
    'after a run', 'busy day at work', 'morning coffee', 'long meeting', 'dinner with friends',
    'stuck in traffic', 'finished a big task', 'bad night of sleep', 'walk in the park', 'family call',
    'deadline coming up', 'lazy Sunday', 'gym session', 'rainy day', 'working from home', 'before bed',
];

// Used when emotiondata.json could not be loaded
const FALLBACK_EMOTIONS = [
    { emoji: '😊', secondary: 'Happy', primary: 'Joy', score: 80, intensity: 2 },
    { emoji: '😌', secondary: 'Calm', primary: 'Peace', score: 70, intensity: 1 },
    { emoji: '😐', secondary: 'Neutral', primary: 'Neutral', score: 50, intensity: 1 },
    { emoji: '😔', secondary: 'Sad', primary: 'Sadness', score: 25, intensity: 2 },
    { emoji: '😤', secondary: 'Frustrated', primary: 'Anger', score: 20, intensity: 3 },
];

// Share of each type in the mock data (types missing from the config are skipped)
// Only the types that can be created on the New Item page (meeting/project/template are hidden there)
const TYPE_WEIGHTS = { mood: 45, note: 25, todo: 20, journal: 10 };

// Which areas each type tends to belong to
const AREA_WEIGHTS = {
    mood: { personal: 70, social: 15, work: 15 },
    note: { learning: 35, work: 25, personal: 25, social: 5, other: 10 },
    todo: { work: 50, personal: 30, other: 15, social: 5 },
    journal: { personal: 85, social: 15 },
    meeting: { work: 90, social: 10 },
    project: { work: 55, learning: 30, personal: 15 },
    template: { other: 60, personal: 25, work: 15 },
};

// ===== Builders: one per type =====
function buildMood(base, ctx) {
    const emotion = pick(ctx.emotions);
    const label = emotion.secondary || emotion.name;
    const context = chance(0.7) ? pick(MOOD_CONTEXTS) : null;
    const baseScore = typeof emotion.score === 'number' ? emotion.score : 50;
    return {
        ...base,
        title: `Mood - ${new Date(base.createdAt).toLocaleString()}`,
        content: context ? `Feeling ${label} - ${context}` : `Feeling ${label}`,
        mood: {
            happiness: clamp(Math.round(baseScore + (Math.random() * 10 - 5)), 1, 100),
            intensity: [1, 2, 3].includes(emotion.intensity) ? emotion.intensity : randInt(1, 3),
            emoji: emotion.emoji,
            label,
            secondary: label,
            primary: emotion.primary || null,
            context,
        },
    };
}

function buildNote(base, ctx) {
    const title = fill(pick([
        'Idea: {topic}', 'Notes on {topic}', 'Quick capture: {topic}', 'Learned from {source}', 'Question about {topic}',
    ]), WORDS);
    return {
        ...base,
        title,
        content: fill(pick([
            'Picked up something useful about {topic} from {source}. Worth trying this week.',
            'Short thought: {lesson}. Came up again while thinking about {topic}.',
            'Open question on {topic}: what is the smallest next step? Ask {person}.',
        ]), WORDS),
        priority: weighted({ Normal: 75, Important: 20, Crucial: 5 }),
    };
}

function buildTodo(base) {
    const ageDays = (Date.now() - new Date(base.createdAt)) / DAY_MS;
    // Older todos are more likely finished
    const status = ageDays > 30
        ? weighted({ DONE: 75, CANCELLED: 10, BLOCKED: 5, TODO: 10 })
        : weighted({ TODO: 40, DOING: 25, DONE: 25, BLOCKED: 10 });
    const deadline = chance(0.75)
        ? new Date(new Date(base.createdAt).getTime() + randInt(1, 21) * DAY_MS).toISOString()
        : 'NO_DEADLINE';
    return {
        ...base,
        title: fill('{task}', WORDS).replace(/^./, (c) => c.toUpperCase()),
        content: fill(pick(['Needs to happen before the weekend.', 'Check with {person} first.', 'Blocked until the documents arrive.', 'Quick one, 15 minutes.']), WORDS),
        status,
        priority: weighted({ Low: 25, Normal: 40, High: 25, Critical: 10 }),
        deadline,
    };
}

function buildJournal(base, ctx) {
    const date = new Date(base.createdAt);
    const template = date.getDay() === 0 ? 'Weekly Review' : date.getDate() === 1 ? 'Monthly Review' : weighted({ 'Today (short)': 80, 'Today (long)': 20 });
    const sections = ctx.journalTemplates[template] || [{ title: 'Today', icon: '📝' }];
    const lines = {
        default: ['Felt {feeling} most of the day.', 'Highlight: {highlight}.', 'Struggled with {challenge}.', 'Lesson: {lesson}.'],
    };
    const content = sections
        .slice(0, template === 'Today (long)' ? sections.length : 4)
        .map((s) => `**${s.icon || ''} ${s.title}**\n${fill(pick(lines.default), WORDS)}`)
        .join('\n\n');
    return {
        ...base,
        title: `${template} - ${date.toLocaleDateString()}`,
        content,
        journalType: template,
        priority: null,
    };
}

function buildMeeting(base) {
    const name = pick(WORDS.meeting);
    return {
        ...base,
        title: name,
        category: base.area === 'work' ? 'meetings' : base.category,
        content: fill(`Agenda:\n- Status update on {topic}\n- Blockers\n\nAction items:\n- {person}: {task}\n- {person}: {task}`, WORDS),
        attendees: randInt(2, 10),
        duration: pick([15, 30, 30, 45, 60, 90]),
        priority: weighted({ Normal: 70, Important: 30 }),
    };
}

function buildProject(base) {
    const total = randInt(3, 8);
    const done = randInt(0, total);
    return {
        ...base,
        title: pick(WORDS.project),
        content: fill(`Goal: ship a first version.\nMilestones: ${done}/${total} done.\nNext step: {task}.`, WORDS),
        status: done === total ? 'DONE' : done === 0 ? 'PLANNED' : 'IN_PROGRESS',
        progress: Math.round((done / total) * 100),
        priority: weighted({ Important: 60, Crucial: 30, Normal: 10 }),
    };
}

function buildTemplate(base) {
    const name = pick(WORDS.template);
    return {
        ...base,
        title: `Template: ${name}`,
        content: `- [ ] Step 1\n- [ ] Step 2\n- [ ] Step 3\n\n(Reusable ${name.toLowerCase()})`,
        priority: null,
    };
}

const BUILDERS = { mood: buildMood, note: buildNote, todo: buildTodo, journal: buildJournal, meeting: buildMeeting, project: buildProject, template: buildTemplate };

/**
 * Creates random mock entries for every entry type in the config (it does not save them).
 * Each type has its own characteristics: share of the data, typical areas,
 * time of day / weekdays, and type-specific fields (mood scores, todo status and
 * deadlines, journal sections, meeting attendees, project progress, ...).
 * Every entry is tagged 'mock'.
 *
 * @param {number} [count=500] - How many entries to create.
 * @returns {Array<object>} Items, newest first.
 */
export function createMockData(count = 500) {
    const config = window.appConfig || {};
    const configTypes = new Set((config.entryTypes || []).map((t) => t.key));
    const configAreas = new Set((config.areas || []).map((a) => a.key));

    const typeWeights = Object.fromEntries(
        Object.entries(TYPE_WEIGHTS).filter(([type]) => configTypes.size === 0 || configTypes.has(type))
    );

    const loadedEmotions = window.emotionData?.emotions?.filter((e) => e.emoji && (e.secondary || e.name));
    const ctx = {
        emotions: loadedEmotions?.length ? loadedEmotions : FALLBACK_EMOTIONS,
        journalTemplates: config.journalTemplates || {},
    };
    const configTags = config.tags || [];

    const items = [];
    for (let i = 0; i < count; i++) {
        const type = weighted(typeWeights);

        // Area: the type's usual areas, limited to areas that exist in the config
        const areaOptions = Object.fromEntries(
            Object.entries(AREA_WEIGHTS[type] || { personal: 1 }).filter(([area]) => configAreas.size === 0 || configAreas.has(area))
        );
        const area = Object.keys(areaOptions).length ? weighted(areaOptions) : (config.defaultSettings?.defaultArea || 'personal');

        const categories = config.categoriesByArea?.[area] || [];
        const pickedCategory = categories.length ? pick(categories) : null;
        const category = pickedCategory?.key ?? pickedCategory; // categories are {key,label} or plain strings
        const createdAt = (TIMING[type] || TIMING.note)();

        const extraTags = configTags.length && chance(0.6)
            ? [...new Set(Array.from({ length: randInt(1, 2) }, () => pick(configTags)))]
            : [];

        const base = {
            id: generateId(),
            area,
            type,
            category: type === 'mood' ? null : category,
            tags: ['mock', ...extraTags],
            priority: null,
            createdAt: createdAt.toISOString(),
        };

        items.push((BUILDERS[type] || buildNote)(base, ctx));
    }

    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
