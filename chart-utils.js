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
    nyx: { border: 'rgba(200, 50, 255, 0.9)', bg: 'rgba(200, 50, 255, 0.15)', label: 'Nyx' },
    carinite: { border: 'rgba(255, 100, 200, 0.9)', bg: 'rgba(255, 100, 200, 0.15)', label: 'Carinite' }
};

const groupedOverrideColors = {
    rcd: [
        { border: 'rgba(50, 150, 255, 0.95)', bg: 'rgba(50, 150, 255, 0.18)' },
        { border: 'rgba(140, 205, 255, 0.95)', bg: 'rgba(140, 205, 255, 0.14)' },
        { border: 'rgba(0, 110, 210, 0.95)', bg: 'rgba(0, 110, 210, 0.14)' }
    ],
    torite: [
        { border: 'rgba(255, 200, 50, 0.95)', bg: 'rgba(255, 200, 50, 0.18)' },
        { border: 'rgba(255, 225, 120, 0.95)', bg: 'rgba(255, 225, 120, 0.14)' },
        { border: 'rgba(220, 160, 0, 0.95)', bg: 'rgba(220, 160, 0, 0.14)' }
    ]
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

// Probability that X > x (for clamped distributions)
function probabilityGreaterThanClamped(x, mean, stddev, minVal, maxVal) {
    // If x is below the minimum, all distribution values are above x
    if (x < minVal) {
        return 1.0;
    }

    // If x is at or above maximum, no distribution values are above x
    if (x >= maxVal) {
        return 0;
    }

    // Calculate probability from min to max (clamped range)
    const probAtX = normalDistributionCDF(x, mean, stddev);
    const probAtMax = normalDistributionCDF(maxVal, mean, stddev);
    const probAtMin = normalDistributionCDF(minVal, mean, stddev);

    // Probability above x within the clamped range
    const probAboveX = probAtMax - probAtX;

    // Total probability within the clamped range
    const totalProb = probAtMax - probAtMin;

    // Normalize
    if (totalProb <= 0) return 0;
    const normalizedProb = Math.max(0, Math.min(1, probAboveX / totalProb));

    return normalizedProb;
}

function getClampedProbabilityMass(mean, stddev, minVal, maxVal) {
    const probAtMax = normalDistributionCDF(maxVal, mean, stddev);
    const probAtMin = normalDistributionCDF(minVal, mean, stddev);
    return probAtMax - probAtMin;
}

// Probability that X > x (for unclamped distributions)
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
function generateDistributionData(dist, clamp = false) {
    const data = [];
    const xMin = 1; // Always start from 1 for proper Chart.js alignment
    const xMax = 1000; // Always keep x-axis at 1-1000
    const clampedProbabilityMass = clamp
        ? getClampedProbabilityMass(dist.mean, dist.stddev, dist.min, dist.max)
        : 1;
    
    for (let x = xMin; x <= xMax; x++) {
        let y = 0;
        
        if (clamp) {
            // For clamped charts, show the normalized truncated distribution.
            if (x >= dist.min && x <= dist.max) {
                const rawDensity = normalDistributionPDF(x, dist.mean, dist.stddev);
                y = clampedProbabilityMass > 0 ? rawDensity / clampedProbabilityMass : 0;
            }
            // Else y remains 0 (no density outside clamped range)
        } else {
            // For unclamped: show full distribution from 1
            if (x >= 1 && x <= dist.max) {
                y = normalDistributionPDF(x, dist.mean, dist.stddev);
            }
        }
        
        data.push({ x, y });
    }
    return data;
}

// Get override types for an item
function isDistributionObject(value) {
    return Boolean(
        value &&
        typeof value === 'object' &&
        Number.isFinite(value.mean) &&
        Number.isFinite(value.min) &&
        Number.isFinite(value.max) &&
        Number.isFinite(value.stddev)
    );
}

function getDistributionBaseType(type, dist = null) {
    if (dist?.baseType) {
        return dist.baseType;
    }

    if (overrideColors[type]) {
        return type;
    }

    const groupedMatch = type.match(/^(.*)_v\d+$/);
    if (groupedMatch) {
        return groupedMatch[1];
    }

    return type;
}

function getDistributionStyle(type, dist = null) {
    const baseType = getDistributionBaseType(type, dist);
    const variantMatch = type.match(/_v(\d+)$/);
    const variantIndex = variantMatch ? Math.max(0, parseInt(variantMatch[1], 10) - 1) : null;
    const groupedPalette = variantIndex !== null ? groupedOverrideColors[baseType] : null;
    const groupedColor = groupedPalette ? groupedPalette[variantIndex % groupedPalette.length] : null;
    const baseColor = overrideColors[baseType] || overrideColors[type] || { border: '#fff', bg: 'rgba(255,255,255,0.1)', label: type };

    return {
        label: dist?.label || baseColor.label || type,
        border: groupedColor?.border || baseColor.border,
        bg: groupedColor?.bg || baseColor.bg
    };
}

function getOverrideTypes(item) {
    return Object.entries(item)
        .filter(([key, value]) => key !== 'name' && key !== 'improvement' && key !== 'default' && isDistributionObject(value))
        .map(([key]) => key);
}

// Create tooltip callbacks
function getProbabilityDecimals() {
    const decimals = Number(window.probabilityDecimals ?? 2);
    if (!Number.isFinite(decimals)) {
        return 2;
    }

    return Math.max(0, Math.min(6, Math.round(decimals)));
}

function createTooltipCallbacks(clampEnabled = false) {
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
                let prob;
                if (clampEnabled) {
                    prob = probabilityGreaterThanClamped(qualityValue, dist.mean, dist.stddev, dist.min, dist.max);
                } else {
                    prob = probabilityGreaterThan(qualityValue, dist.mean, dist.stddev, dist.max);
                }
                probText = `\nP(x > ${Math.round(qualityValue)}): ${(prob * 100).toFixed(getProbabilityDecimals())}%`;
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
            beginAtZero: true,
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
function createChartOptions(clampEnabled = false, overrides = {}) {
    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
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
                callbacks: createTooltipCallbacks(clampEnabled)
            }
        },
        scales: createChartScales(),
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    };

    return {
        ...defaultOptions,
        ...overrides,
        plugins: {
            ...defaultOptions.plugins,
            ...(overrides.plugins || {}),
            legend: {
                ...defaultOptions.plugins.legend,
                ...((overrides.plugins && overrides.plugins.legend) || {})
            },
            tooltip: {
                ...defaultOptions.plugins.tooltip,
                ...((overrides.plugins && overrides.plugins.tooltip) || {})
            }
        },
        scales: overrides.scales || defaultOptions.scales,
        interaction: {
            ...defaultOptions.interaction,
            ...(overrides.interaction || {})
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

// Calculate improvement percentage for clamped distributions
function calculateImprovementClamped(defaultDist, overrideDist) {
    // Calculate probability of getting > 500 quality for both distributions
    const defaultProb = probabilityGreaterThanClamped(500, defaultDist.mean, defaultDist.stddev, defaultDist.min, defaultDist.max);
    const overrideProb = probabilityGreaterThanClamped(500, overrideDist.mean, overrideDist.stddev, overrideDist.min, overrideDist.max);

    // Calculate improvement as percentage increase
    if (defaultProb === 0) return 0;
    const improvement = ((overrideProb - defaultProb) / defaultProb) * 100;
    return improvement.toFixed(1);
}

// Calculate improvement percentage for unclamped distributions
function calculateImprovement(defaultDist, overrideDist) {
    // Calculate probability of getting > 500 quality for both distributions
    const defaultProb = probabilityGreaterThan(500, defaultDist.mean, defaultDist.stddev, defaultDist.max);
    const overrideProb = probabilityGreaterThan(500, overrideDist.mean, overrideDist.stddev, overrideDist.max);

    // Calculate improvement as percentage increase
    if (defaultProb === 0) return 0;
    const improvement = ((overrideProb - defaultProb) / defaultProb) * 100;
    return improvement.toFixed(1);
}
