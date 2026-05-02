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

function normalizeMaterialName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function formatMappedValueLabel(band) {
    if (!band) {
        return '';
    }

    return band.mappedMin === band.mappedMax
        ? String(band.mappedMin)
        : `${band.mappedMin}-${band.mappedMax}`;
}

function formatQualityPercent(value) {
    if (!Number.isFinite(value)) {
        return '';
    }

    return `${(value / 10).toFixed(1).replace(/\.0$/, '')}%`;
}

function formatMappedQualityPercentLabel(band) {
    if (!band) {
        return '';
    }

    return band.mappedMin === band.mappedMax
        ? formatQualityPercent(band.mappedMin)
        : `${formatQualityPercent(band.mappedMin)}-${formatQualityPercent(band.mappedMax)}`;
}

function createQualityQuantizationOverlay(qualityQuantization, materialNames = null) {
    if (!qualityQuantization?.materials?.length) {
        return null;
    }

    const requestedNames = Array.isArray(materialNames)
        ? materialNames.map(normalizeMaterialName).filter(Boolean)
        : [];
    const requestedSet = new Set(requestedNames);

    const selectedMaterials = requestedSet.size > 0
        ? qualityQuantization.materials.filter((material) => requestedSet.has(normalizeMaterialName(material.name)))
        : qualityQuantization.materials;

    if (requestedSet.size > 0 && selectedMaterials.length === 0) {
        return null;
    }

    const materials = selectedMaterials;
    const bandRanges = qualityQuantization.bandRanges?.length
        ? qualityQuantization.bandRanges
        : materials[0].bands.map((band) => ({ start: band.start, end: band.end }));

    const bands = bandRanges.map((bandRange) => {
        const mappedValues = materials
            .map((material) => material.bands.find((band) => band.start === bandRange.start && band.end === bandRange.end)?.mappedValue)
            .filter((mappedValue) => Number.isFinite(mappedValue));

        if (mappedValues.length === 0) {
            return null;
        }

        const mappedMin = Math.min(...mappedValues);
        const mappedMax = Math.max(...mappedValues);

        return {
            start: bandRange.start,
            end: bandRange.end,
            mappedMin,
            mappedMax,
            materialCount: mappedValues.length
        };
    }).filter(Boolean);

    return {
        bands,
        materialCount: materials.length
    };
}

function findQuantizationBand(qualityValue, bands) {
    if (!Array.isArray(bands)) {
        return null;
    }

    return bands.find((band) => qualityValue >= band.start && qualityValue <= band.end) || null;
}

const qualityQuantizationOverlayPlugin = {
    id: 'qualityQuantizationOverlay',
    beforeDatasetsDraw(chart, args, options) {
        if (!options?.enabled || !Array.isArray(options.bands) || options.bands.length === 0) {
            return;
        }

        const { ctx, chartArea, scales } = chart;
        const xScale = scales.x;

        if (!chartArea || !xScale) {
            return;
        }

        ctx.save();
        options.bands.forEach((band, index) => {
            const startX = Math.max(chartArea.left, xScale.getPixelForValue(Math.max(1, band.start)));
            const endX = Math.min(chartArea.right, xScale.getPixelForValue(Math.min(1000, band.end)));
            const width = Math.max(1, endX - startX);

            ctx.fillStyle = index % 2 === 0
                ? 'rgba(0, 217, 255, 0.035)'
                : 'rgba(255, 193, 7, 0.035)';
            ctx.fillRect(startX, chartArea.top, width, chartArea.bottom - chartArea.top);

            ctx.strokeStyle = 'rgba(255, 193, 7, 0.22)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(startX, chartArea.top);
            ctx.lineTo(startX, chartArea.bottom);
            ctx.stroke();
        });
        ctx.restore();
    },
    afterDatasetsDraw(chart, args, options) {
        if (!options?.enabled || !Array.isArray(options.bands) || options.bands.length === 0) {
            return;
        }

        const { ctx, chartArea, scales } = chart;
        const xScale = scales.x;

        if (!chartArea || !xScale) {
            return;
        }

        ctx.save();
        ctx.font = '600 10px Rajdhani, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        options.bands.forEach((band) => {
            const startX = Math.max(chartArea.left, xScale.getPixelForValue(Math.max(1, band.start)));
            const endX = Math.min(chartArea.right, xScale.getPixelForValue(Math.min(1000, band.end)));
            const width = endX - startX;

            if (width < 34) {
                return;
            }

            const centerX = startX + width / 2;
            const label = formatMappedValueLabel(band);
            ctx.fillStyle = 'rgba(255, 214, 95, 0.92)';
            ctx.fillText(label, centerX, chartArea.top + 5);
        });

        ctx.restore();
    }
};

if (typeof Chart !== 'undefined') {
    Chart.register(qualityQuantizationOverlayPlugin);
}

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

function probabilityBetween(xMin, xMax, mean, stddev, clamp = false, minVal = 1, maxVal = 1000) {
    const lower = clamp ? Math.max(xMin, minVal) : xMin;
    const upper = clamp ? Math.min(xMax, maxVal) : xMax;

    if (upper < lower) {
        return 0;
    }

    const rawProb = normalDistributionCDF(upper, mean, stddev) - normalDistributionCDF(lower, mean, stddev);
    if (!clamp) {
        return Math.max(0, Math.min(1, rawProb));
    }

    const totalProb = normalDistributionCDF(maxVal, mean, stddev) - normalDistributionCDF(minVal, mean, stddev);
    if (totalProb <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(1, rawProb / totalProb));
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
    function getTooltipBand(context) {
        const qualityValue = context?.parsed?.x;
        const quantizationOptions = context?.chart?.options?.plugins?.qualityQuantizationOverlay;

        if (!quantizationOptions?.enabled) {
            return null;
        }

        return findQuantizationBand(qualityValue, quantizationOptions.bands);
    }

    return {
        title: function (context) {
            if (context && context.length > 0) {
                const band = getTooltipBand(context[0]);
                if (band) {
                    return `Quality: ${formatMappedQualityPercentLabel(band)}`;
                }

                return `Roll: ${Math.round(context[0].parsed.x)}`;
            }
            return '';
        },
        label: function (context) {
            if (!context || !context.dataset) return '';

            const distName = context.dataset.label;
            const qualityValue = context.parsed.x;
            const densityValue = context.parsed.y;
            const band = getTooltipBand(context);

            const dist = context.dataset.customData;
            if (dist) {
                let prob;
                if (band) {
                    prob = probabilityBetween(band.start, band.end, dist.mean, dist.stddev, clampEnabled, dist.min, dist.max);
                    return `${distName}: ${(prob * 100).toFixed(getProbabilityDecimals())}% in bucket`;
                } else if (clampEnabled) {
                    prob = probabilityGreaterThanClamped(qualityValue, dist.mean, dist.stddev, dist.min, dist.max);
                    return `${distName}: ${(prob * 100).toFixed(getProbabilityDecimals())}% above this roll`;
                } else {
                    prob = probabilityGreaterThan(qualityValue, dist.mean, dist.stddev, dist.max);
                    return `${distName}: ${(prob * 100).toFixed(getProbabilityDecimals())}% above this roll`;
                }
            }

            return `${distName}: density ${densityValue.toFixed(6)}`;
        }
    };
}

function getExternalTooltipElement() {
    let tooltipEl = document.getElementById('chartjs-external-tooltip');

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'chartjs-external-tooltip';
        tooltipEl.style.background = 'rgba(0, 0, 0, 0.8)';
        tooltipEl.style.border = '1px solid rgba(0, 217, 255, 0.5)';
        tooltipEl.style.borderRadius = '4px';
        tooltipEl.style.color = '#fff';
        tooltipEl.style.fontFamily = 'Rajdhani, sans-serif';
        tooltipEl.style.fontSize = '13px';
        tooltipEl.style.fontWeight = '600';
        tooltipEl.style.opacity = '0';
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.position = 'fixed';
        tooltipEl.style.transform = 'translateY(-50%)';
        tooltipEl.style.transition = 'opacity 0.1s ease';
        tooltipEl.style.zIndex = '10000';

        const titleEl = document.createElement('div');
        titleEl.className = 'chartjs-external-tooltip-title';
        titleEl.style.color = '#00d9ff';
        titleEl.style.fontWeight = '700';
        titleEl.style.margin = '0 0 4px';

        const bodyEl = document.createElement('div');
        bodyEl.className = 'chartjs-external-tooltip-body';

        tooltipEl.appendChild(titleEl);
        tooltipEl.appendChild(bodyEl);
        document.body.appendChild(tooltipEl);
    }

    return tooltipEl;
}

function renderExternalTooltip(context) {
    const { chart, tooltip } = context;
    const tooltipEl = getExternalTooltipElement();

    if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = '0';
        return;
    }

    const titleEl = tooltipEl.querySelector('.chartjs-external-tooltip-title');
    const bodyEl = tooltipEl.querySelector('.chartjs-external-tooltip-body');
    titleEl.textContent = tooltip.title.join(' ');
    bodyEl.innerHTML = '';

    tooltip.body.forEach((bodyItem, index) => {
        const colors = tooltip.labelColors[index] || {};
        const rowEl = document.createElement('div');
        rowEl.style.alignItems = 'center';
        rowEl.style.display = 'flex';
        rowEl.style.gap = '4px';
        rowEl.style.whiteSpace = 'nowrap';

        const colorEl = document.createElement('span');
        colorEl.style.background = colors.backgroundColor || colors.borderColor || '#fff';
        colorEl.style.border = `2px solid ${colors.borderColor || '#fff'}`;
        colorEl.style.display = 'inline-block';
        colorEl.style.flex = '0 0 auto';
        colorEl.style.height = '10px';
        colorEl.style.width = '10px';

        const textEl = document.createElement('span');
        textEl.textContent = bodyItem.lines.join(' ');

        rowEl.appendChild(colorEl);
        rowEl.appendChild(textEl);
        bodyEl.appendChild(rowEl);
    });

    tooltipEl.style.padding = `${tooltip.options.padding}px`;
    tooltipEl.style.opacity = '1';

    const canvasRect = chart.canvas.getBoundingClientRect();
    const padding = 12;
    const caretX = canvasRect.left + tooltip.caretX;
    const caretY = canvasRect.top + tooltip.caretY;
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const placeRight = caretX + padding + tooltipRect.width <= viewportWidth;
    const left = placeRight
        ? caretX + padding
        : Math.max(padding, caretX - tooltipRect.width - padding);
    const top = Math.min(
        Math.max(caretY, padding + tooltipRect.height / 2),
        viewportHeight - padding - tooltipRect.height / 2
    );

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
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
                enabled: false,
                external: renderExternalTooltip,
                position: 'nearest',
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
