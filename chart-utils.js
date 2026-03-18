// Chart utilities for quality distribution visualization

const rarityColors = {
    Common: '#ffffff',
    Uncommon: '#00ff88',
    Rare: '#0099ff',
    Epic: '#9900ff',
    Legendary: '#ff9900'
};

const overrideColors = {
    default: { border: 'rgba(255,255,255, 0.8)', bg: 'rgba(255, 255, 255, 0.1)', label: 'Default' },
    pyro: { border: 'rgba(255, 100, 50, 0.9)', bg: 'rgba(255, 100, 50, 0.15)', label: 'Pyro' },
    rcd: { border: 'rgba(50, 150, 255, 0.9)', bg: 'rgba(50, 150, 255, 0.15)', label: 'RCD' },
    torite: { border: 'rgba(255, 200, 50, 0.9)', bg: 'rgba(255, 200, 50, 0.15)', label: 'Torite' },
    nyx: { border: 'rgba(200, 50, 255, 0.9)', bg: 'rgba(200, 50, 255, 0.15)', label: 'Nyx' }
};

const versionColors = {
    versionA: { border: 'rgba(100, 150, 255, 0.9)', bg: 'rgba(100, 150, 255, 0.15)', label: 'Version A' },
    versionB: { border: 'rgba(255, 100, 100, 0.9)', bg: 'rgba(255, 100, 100, 0.15)', label: 'Version B' }
};

// Normal distribution probability density function
function normalDistributionPDF(x, mean, stddev) {
    const exponent = -0.5 * Math.pow((x - mean) / stddev, 2);
    return (1 / (stddev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
}

// Error function approximation
function erf(x) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
}

// Cumulative distribution function (CDF)
function normalDistributionCDF(x, mean, stddev) {
    return 0.5 * (1 + erf((x - mean) / (stddev * Math.sqrt(2))));
}

// Probability that X > x
function probabilityGreaterThan(x, mean, stddev, maxVal) {
    const zScore = (x - mean) / stddev;
    const probGreaterThan = 1 - normalDistributionCDF(x, mean, stddev);

    const minVal = Math.max(1, mean - 3 * stddev);
    const probAboveMin = 1 - normalDistributionCDF(minVal, mean, stddev);

    let normalizedProb = probGreaterThan / probAboveMin;
    normalizedProb = Math.max(0, Math.min(1, normalizedProb));

    return normalizedProb;
}

// Generate distribution data for charts
function generateDistributionData(dist) {
    const data = [];
    for (let x = 1; x <= dist.max; x++) {
        if (x >= 1 && x <= dist.max) {
            const y = normalDistributionPDF(x, dist.mean, dist.stddev);
            data.push({ x: x, y: parseFloat(y.toFixed(6)) });
        }
    }
    return data;
}

// Get override types for an item
function getOverrideTypes(item) {
    const types = [];
    if (item.default) types.push('default');
    if (item.pyro) types.push('pyro');
    if (item.rcd) types.push('rcd');
    if (item.torite) types.push('torite');
    if (item.nyx) types.push('nyx');
    return types.filter(t => t !== 'default');
}

// Create tooltip callbacks
function createTooltipCallbacks() {
    return {
        title: function (context) {
            if (context && context.length > 0) {
                return `Quality: ${Math.round(context[0].parsed.x)}`;
            }
            return '';
        },
        label: function (context) {
            if (!context || !context.dataset) return '';

            const distName = context.dataset.label;
            const qualityValue = context.parsed.x;
            const densityValue = context.parsed.y;

            const dist = context.dataset.customData;
            let probText = '';
            if (dist) {
                const prob = probabilityGreaterThan(qualityValue, dist.mean, dist.stddev, dist.max);
                probText = `\nP(x > ${Math.round(qualityValue)}): ${(prob * 100).toFixed(2)}%`;
            }

            return `${distName}: ${densityValue.toFixed(6)}${probText}`;
        }
    };
}

// Create chart scales configuration
function createChartScales() {
    return {
        x: {
            type: 'linear',
            min: 1,
            max: 1000,
            display: true,
            title: {
                display: true,
                text: 'Quality Level',
                color: '#888',
                font: { family: 'Rajdhani' }
            },
            ticks: { color: '#666', font: { family: 'Rajdhani' } },
            grid: { color: 'rgba(255,255, 255, 0.05)' }
        },
        y: {
            beginAtZero: false,
            display: true,
            title: {
                display: true,
                text: 'Probability Density',
                color: '#888',
                font: { family: 'Rajdhani' }
            },
            ticks: { color: '#666', font: { family: 'Rajdhani' } },
            grid: { color: 'rgba(255,255, 255, 0.05)' }
        }
    };
}

// Create chart options
function createChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#00d9ff',
                bodyColor: '#fff',
                borderColor: 'rgba(0, 217, 255, 0.5)',
                borderWidth: 1,
                callbacks: createTooltipCallbacks()
            }
        },
        scales: createChartScales(),
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    };
}

// Calculate statistical delta between two distributions
function calculateDelta(valueA, valueB) {
    const delta = valueB - valueA;
    const percentChange = ((delta / valueA) * 100).toFixed(1);
    return {
        absolute: delta,
        percent: parseFloat(percentChange),
        positive: delta > 0,
        negative: delta < 0
    };
}

// Determine verdict based on mean and stddev changes
function calculateVerdict(meanDelta, stddevDelta) {
    // Check if unchanged (both values very close to 0)
    if (Math.abs(meanDelta.percent) < 0.1 && Math.abs(stddevDelta.percent) < 0.1) {
        return { label: 'Unchanged', class: 'verdict-unchanged', icon: '=' };
    } else if (meanDelta.percent > 5 && Math.abs(stddevDelta.percent) < 10) {
        return { label: 'Improved', class: 'verdict-improved', icon: '✓' };
    } else if (meanDelta.percent < -5) {
        return { label: 'Worsened', class: 'verdict-worsened', icon: '✗' };
    } else {
        return { label: 'Mixed', class: 'verdict-mixed', icon: '~' };
    }
}

// Format delta for display
function formatDelta(delta) {
    const sign = delta.positive ? '+' : delta.negative ? '' : '±';
    return `${sign}${delta.absolute} (${sign}${delta.percent}%)`;
}
