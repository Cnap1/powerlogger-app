// Utility functions for drawing charts (uses the global `Chart` from Chart.js, loaded in index.html)

/**
 * Creates a chart on the canvas, replacing any chart already drawn there.
 * Returns null (and logs a warning) when Chart.js is not loaded, e.g. offline.
 */
function renderChart(ctx, config) {
    if (typeof window.Chart === 'undefined') {
        console.warn('Chart.js is not loaded; skipping chart');
        return null;
    }
    window.Chart.getChart(ctx)?.destroy();
    return new window.Chart(ctx, config);
}

/** Pie chart of { label: count } */
export function drawPieChart(ctx, data) {
    const values = Object.values(data);
    return renderChart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(data),
            datasets: [{ data: values, backgroundColor: generateColors(values.length) }],
        },
        options: { responsive: true, maintainAspectRatio: false },
    });
}

/**
 * Bar chart of { label: count }. Single series, so no legend
 * (a legend would only show an empty/"undefined" dataset name).
 * @param {object} [options]
 * @param {boolean} [options.horizontal=false] - Bars from left to right.
 * @param {string} [options.label='Entries'] - Name shown in the tooltip.
 */
export function drawBarChart(ctx, data, { horizontal = false, label = 'Entries' } = {}) {
    const values = Object.values(data);
    const valueAxis = horizontal ? 'x' : 'y';
    return renderChart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{ label, data: values, backgroundColor: generateColors(values.length) }],
        },
        options: {
            indexAxis: horizontal ? 'y' : 'x',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { [valueAxis]: { beginAtZero: true, ticks: { precision: 0 } } },
        },
    });
}

/**
 * Line chart of { label: value }.
 * @param {object} [options]
 * @param {string} [options.label='Entries'] - Series name (tooltip).
 * @param {string} [options.color='204, 70%, 50%'] - HSL components.
 * @param {number} [options.yMax] - Fixed top of the y axis.
 * @param {string} [options.yTitle] - Y axis title.
 */
export function drawLineChart(ctx, data, { label = 'Entries', color = '204, 70%, 50%', yMax, yTitle } = {}) {
    return renderChart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label,
                data: Object.values(data),
                borderColor: `hsl(${color})`,
                backgroundColor: `hsla(${color}, 0.15)`,
                fill: true,
                tension: 0.3,
                spanGaps: true,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ...(yMax ? { max: yMax } : {}),
                    ...(yTitle ? { title: { display: true, text: yTitle } } : {}),
                },
            },
        },
    });
}

function generateColors(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(`hsl(${(i * 360) / Math.max(count, 1)}, 70%, 50%)`);
    }
    return colors;
}
