// DOM manipulation utilities for rendering UI elements

let charts = [];
let expandedChart = null;
let expandedChartTrigger = null;
let expandedChartModal = null;
let expandedChartCanvas = null;
let expandedChartTitle = null;
let expandedChartSubtitle = null;
let activeExpandedChartKey = null;
let bodyScrollPaddingRight = '';

function cloneChartDatasets(datasets) {
    return datasets.map((dataset) => ({
        ...dataset,
        data: dataset.data.map((point) => ({ ...point }))
    }));
}

// Destroy all charts
function destroyCharts() {
    charts.forEach(chart => chart.destroy());
    charts = [];

    if (window.__preserveExpandedChartOnNextRender && activeExpandedChartKey) {
        window.__restoreExpandedChartKey = activeExpandedChartKey;
        closeExpandedChart({ restoreFocus: false, clearActiveKey: false });
    } else {
        window.__restoreExpandedChartKey = null;
        closeExpandedChart({ restoreFocus: false });
    }

    window.__preserveExpandedChartOnNextRender = false;
}

function refreshCharts() {
    charts.forEach((chart) => chart.update('none'));
    if (expandedChart) {
        expandedChart.update('none');
    }
}

function preserveExpandedChart() {
    if (activeExpandedChartKey) {
        window.__preserveExpandedChartOnNextRender = true;
    }
}

function createQuantizationChartOptionOverrides(quantizationOverlay) {
    return {
        plugins: {
            qualityQuantizationOverlay: {
                enabled: Boolean(quantizationOverlay?.bands?.length),
                bands: quantizationOverlay?.bands || [],
                materialCount: quantizationOverlay?.materialCount || 0
            }
        }
    };
}

function lockBodyScroll() {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    bodyScrollPaddingRight = document.body.style.paddingRight;

    if (scrollbarWidth > 0) {
        const currentPaddingRight = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
        document.body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }

    document.body.classList.add('chart-modal-open');
}

function unlockBodyScroll() {
    document.body.classList.remove('chart-modal-open');
    document.body.style.paddingRight = bodyScrollPaddingRight;
    bodyScrollPaddingRight = '';
}

function buildSingleViewDatasets(item) {
    const datasets = [];
    const overrideTypesPresent = getOverrideTypes(item);

    if (item.default) {
        datasets.push({
            label: 'Default',
            data: generateDistributionData(item.default, window.clampEnabled || false),
            borderColor: overrideColors.default.border,
            backgroundColor: overrideColors.default.bg,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            customData: item.default
        });
    }

    for (const type of overrideTypesPresent) {
        const style = getDistributionStyle(type, item[type]);
        datasets.push({
            label: style.label,
            data: generateDistributionData(item[type], window.clampEnabled || false),
            borderColor: style.border,
            backgroundColor: style.bg,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            customData: item[type]
        });
    }

    return datasets;
}

function buildComparisonDatasets(itemA, itemB, versionALabel, versionBLabel) {
    return [
        {
            label: versionALabel,
            data: generateDistributionData(itemA.default, window.clampEnabled || false),
            borderColor: versionColors.versionA.border,
            backgroundColor: versionColors.versionA.bg,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            customData: itemA.default
        },
        {
            label: versionBLabel,
            data: generateDistributionData(itemB.default, window.clampEnabled || false),
            borderColor: versionColors.versionB.border,
            backgroundColor: versionColors.versionB.bg,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            customData: itemB.default
        }
    ];
}

function createChartInstance(canvas, datasets, optionOverrides = {}) {
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: cloneChartDatasets(datasets)
        },
        options: createChartOptions(window.clampEnabled || false, optionOverrides)
    });

    charts.push(chart);
    return chart;
}

function getExpandedChartElements() {
    if (expandedChartModal) {
        return {
            modal: expandedChartModal,
            canvas: expandedChartCanvas,
            title: expandedChartTitle,
            subtitle: expandedChartSubtitle
        };
    }

    expandedChartModal = document.getElementById('chart-expand-modal');
    expandedChartCanvas = document.getElementById('chart-expand-canvas');
    expandedChartTitle = document.getElementById('chart-expand-title');
    expandedChartSubtitle = document.getElementById('chart-expand-subtitle');

    if (!expandedChartModal || !expandedChartCanvas || !expandedChartTitle || !expandedChartSubtitle) {
        return null;
    }

    const closeButton = expandedChartModal.querySelector('[data-chart-modal-close]');
    if (closeButton) {
        closeButton.addEventListener('click', closeExpandedChart);
    }

    expandedChartModal.addEventListener('click', (event) => {
        if (event.target === expandedChartModal) {
            closeExpandedChart();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && expandedChartModal && !expandedChartModal.hidden) {
            closeExpandedChart();
        }
    });

    return {
        modal: expandedChartModal,
        canvas: expandedChartCanvas,
        title: expandedChartTitle,
        subtitle: expandedChartSubtitle
    };
}

function closeExpandedChart(options = {}) {
    const { restoreFocus = true, clearActiveKey = true } = options;
    const elements = getExpandedChartElements();
    if (!elements) {
        return;
    }

    if (expandedChart) {
        expandedChart.destroy();
        expandedChart = null;
    }

    elements.modal.hidden = true;
    unlockBodyScroll();

    if (clearActiveKey) {
        activeExpandedChartKey = null;
    }

    if (restoreFocus && expandedChartTrigger) {
        expandedChartTrigger.focus({ preventScroll: true });
    }

    if (clearActiveKey || restoreFocus) {
        expandedChartTrigger = null;
    }
}

function openExpandedChart(config, triggerButton) {
    const elements = getExpandedChartElements();
    if (!elements) {
        return;
    }

    if (expandedChart) {
        expandedChart.destroy();
    }

    activeExpandedChartKey = config.key || null;
    expandedChartTrigger = triggerButton;
    elements.title.textContent = config.title;
    elements.subtitle.textContent = config.subtitle || '';
    elements.modal.hidden = false;
    lockBodyScroll();

    const quantizationOptions = createQuantizationChartOptionOverrides(config.quantizationOverlay);

    expandedChart = new Chart(elements.canvas.getContext('2d'), {
        type: 'line',
        data: {
            datasets: cloneChartDatasets(config.datasets)
        },
        options: createChartOptions(window.clampEnabled || false, {
            maintainAspectRatio: false,
            aspectRatio: undefined,
            plugins: quantizationOptions.plugins,
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        })
    });
}

function createExpandButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chart-expand-button';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 3H3v6h2V6.41l4.29 4.3 1.42-1.42L6.41 5H9V3zm6 0v2h2.59l-4.3 4.29 1.42 1.42L19 6.41V9h2V3h-6zm4 12v2.59l-4.29-4.3-1.42 1.42 4.3 4.29H15v2h6v-6h-2zM10.71 14.29l-4.3 4.3V16H4v6h6v-2H7.41l4.3-4.29-1.42-1.42z"></path>
        </svg>
    `;
    button.addEventListener('click', onClick);
    return button;
}

function createChartHeader(titleContent, expandButton) {
    const header = document.createElement('div');
    header.className = 'chart-header';

    const titleArea = document.createElement('div');
    titleArea.className = 'chart-heading-area';
    titleArea.appendChild(titleContent);

    header.appendChild(titleArea);
    header.appendChild(expandButton);
    return header;
}

const CATEGORY_QUANTIZATION_MATERIALS = {
    'Ground Mineables': ['Beradom', 'Carinite', 'Feynmaline', 'Glacosite'],
    'FPS Mineables': ['Aphorite', 'Dolivine', 'Hadanite', 'Jaclium', 'Janalite', 'Sadaryx', 'Saldynium'],
    'RCD (Non-Torite)': ['Savrilium'],
    'Torite Only': ['Torite']
};

function getQuantizationOverlayForItem(category, item, rockData = null) {
    if (!hasQualityQuantizationData(window.currentQualityQuantization)) {
        return null;
    }

    let materialNames = null;
    if (category === 'Ship Mineables' && rockData && Array.isArray(rockData[item.name])) {
        materialNames = rockData[item.name].map((rock) => rock.name);
    } else if (CATEGORY_QUANTIZATION_MATERIALS[category]) {
        materialNames = CATEGORY_QUANTIZATION_MATERIALS[category];
    } else {
        return null;
    }

    return createQualityQuantizationOverlay(window.currentQualityQuantization, materialNames);
}

// Create category section for quality distributions
function createCategorySection(categoryData, rockData = null) {
    const section = document.createElement('div');
    section.className = 'category-section';

    const title = document.createElement('h2');
    title.className = 'category-title';
    title.textContent = categoryData.category;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'charts-grid';

    categoryData.items.forEach(item => {
        const container = document.createElement('div');
        container.className = 'chart-container';

        const chartTitle = document.createElement('h3');
        chartTitle.className = 'chart-title';
        chartTitle.textContent = item.name;

        const overrideTypes = getOverrideTypes(item);
        let badges = item.default ? '<span class="badge badge-default">Default</span>' : '';
        for (const type of overrideTypes) {
            const style = getDistributionStyle(type, item[type]);
            badges += `${badges ? ' ' : ''}<span class="badge badge-${type}" style="background: ${style.bg}; border: 1px solid ${style.border}; color: #fff">${style.label}</span>`;
        }

        if (badges) {
            const badgesWrapper = document.createElement('span');
            badgesWrapper.className = 'chart-title-badges';
            badgesWrapper.innerHTML = badges;
            chartTitle.appendChild(document.createTextNode(' '));
            chartTitle.appendChild(badgesWrapper);
        }

        let titleContent = chartTitle;

        // Add tooltip for Ship Mineables
        if (categoryData.category === 'Ship Mineables' && rockData && rockData[item.name]) {
            const titleWrapper = document.createElement('div');
            titleWrapper.className = 'category-title-tooltip';

            const tooltipContent = document.createElement('div');
            tooltipContent.className = 'tooltip-content';

            const tooltipHeader = document.createElement('h4');
            tooltipHeader.textContent = `${item.name} Rocks`;
            tooltipContent.appendChild(tooltipHeader);

            const rockList = document.createElement('ul');
            const rocks = rockData[item.name];
            rocks.forEach(rock => {
                const rockItem = document.createElement('li');
                rockItem.textContent = rock.name;
                rockList.appendChild(rockItem);
            });
            tooltipContent.appendChild(rockList);

            const tooltipIndicator = document.createElement('span');
            tooltipIndicator.className = 'tooltip-indicator';
            tooltipIndicator.innerHTML = '?';
            tooltipIndicator.title = 'Hover to see rocks in this rarity';

            chartTitle.appendChild(tooltipIndicator);
            titleWrapper.appendChild(chartTitle);
            titleWrapper.appendChild(tooltipContent);
            titleContent = titleWrapper;
        }

        const chartKey = `single:${categoryData.category}:${item.name}`;
        const chartDatasets = buildSingleViewDatasets(item);
        const quantizationOverlay = getQuantizationOverlayForItem(categoryData.category, item, rockData);
        const expandButton = createExpandButton(`Expand chart for ${item.name}`, () => {
            openExpandedChart({
                key: chartKey,
                title: `${item.name} Quality Distribution`,
                subtitle: `${categoryData.category} · ${chartDatasets.map((dataset) => dataset.label).join(' vs ')}`,
                datasets: chartDatasets,
                quantizationOverlay
            }, expandButton);
        });

        container.appendChild(createChartHeader(titleContent, expandButton));

        const canvas = document.createElement('canvas');
        canvas.id = `chart-${categoryData.category.replace(/\s/g, '-')}-${item.name.replace(/\s/g, '-')}`;
        container.appendChild(canvas);

        const statsDiv = document.createElement('div');
        statsDiv.className = 'stats-grid';

        let statsHtml = '';
        const showDetailedOverrideStats = !item.default || overrideTypes.length > 1;

        if (item.default) {
            statsHtml += `
                <div class="stat-card">
                    <div class="stat-label">Default Mean</div>
                    <div class="stat-value">${item.default.mean}</div>
                </div>
            `;
        }

        if (showDetailedOverrideStats && overrideTypes.length > 1) {
            const detailedStatTypes = [
                { key: 'mean', labelSuffix: 'Mean', valueStyle: '' },
                { key: 'stddev', labelSuffix: 'StdDev', valueStyle: '' },
                { key: 'range', labelSuffix: 'Range', valueStyle: 'font-size: 1rem;' }
            ];

            for (const statType of detailedStatTypes) {
                for (const type of overrideTypes) {
                    const style = getDistributionStyle(type, item[type]);
                    const statValue = statType.key === 'range'
                        ? `${item[type].min} - ${item[type].max}`
                        : item[type][statType.key];

                    statsHtml += `
                        <div class="stat-card">
                            <div class="stat-label">${style.label} ${statType.labelSuffix}</div>
                            <div class="stat-value" style="${statType.valueStyle} color: ${style.border}">${statValue}</div>
                        </div>
                    `;
                }
            }
        } else {
            for (const type of overrideTypes) {
                const style = getDistributionStyle(type, item[type]);
                statsHtml += `
                    <div class="stat-card">
                        <div class="stat-label">${style.label} Mean</div>
                        <div class="stat-value" style="color: ${style.border}">${item[type].mean}</div>
                    </div>
                `;

                if (showDetailedOverrideStats || ['rcd', 'torite'].includes(getDistributionBaseType(type, item[type]))) {
                    statsHtml += `
                        <div class="stat-card">
                            <div class="stat-label">${style.label} StdDev</div>
                            <div class="stat-value" style="color: ${style.border}">${item[type].stddev}</div>
                        </div>
                    `;

                    statsHtml += `
                        <div class="stat-card">
                            <div class="stat-label">${style.label} Range</div>
                            <div class="stat-value" style="font-size: 1rem; color: ${style.border}">${item[type].min} - ${item[type].max}</div>
                        </div>
                    `;
                }
            }
        }

        if (item.improvement) {
            const calculateFunc = window.clampEnabled ? calculateImprovementClamped : calculateImprovement;
            let improvementValue;
            if (item.default && item.pyro) {
                improvementValue = calculateFunc(item.default, item.pyro);
            } else if (item.default && Object.keys(item).length > 2) {
                // Find first override that's not 'name' or 'improvement'
                const overrideKey = Object.keys(item).find(key =>
                    key !== 'name' && key !== 'improvement' && key !== 'default' && typeof item[key] === 'object'
                );
                if (overrideKey) {
                    improvementValue = calculateFunc(item.default, item[overrideKey]);
                }
            }

            if (improvementValue) {
                statsHtml += `
                    <div class="stat-card">
                        <div class="stat-label">Improvement</div>
                        <div class="stat-value" style="color: #00ff88">+${improvementValue}%</div>
                    </div>
                `;
            }
        }

        if (!showDetailedOverrideStats) {
            let minVal = '?';
            if (item.default) {
                minVal = item.default.min;
            } else if (overrideTypes.length > 0) {
                minVal = item[overrideTypes[0]].min;
            }

            statsHtml += `
                <div class="stat-card">
                    <div class="stat-label" style="display: flex; align-items: center; gap: 5px;">
                        Quality Range
                        <span class="tooltip-icon" title="The low end of this range is theoretical based on normal distribution. It might not be used by game currently.">?</span>
                    </div>
                    <div class="stat-value" style="font-size: 1rem">${minVal} - 1000</div>
                </div>
            `;
        }

        statsDiv.innerHTML = statsHtml;
        container.appendChild(statsDiv);
        grid.appendChild(container);

        const overrideTypesPresent = getOverrideTypes(item);
        const hasAnyData = (item.default && overrideTypesPresent.length > 0) || overrideTypesPresent.length > 0;

        if (hasAnyData) {
            createChartInstance(canvas, chartDatasets, createQuantizationChartOptionOverrides(quantizationOverlay));

            if (window.__restoreExpandedChartKey === chartKey) {
                window.__restoreExpandedChartKey = null;
                openExpandedChart({
                    key: chartKey,
                    title: `${item.name} Quality Distribution`,
                    subtitle: `${categoryData.category} · ${chartDatasets.map((dataset) => dataset.label).join(' vs ')}`,
                    datasets: chartDatasets,
                    quantizationOverlay
                }, expandButton);
            }
        }
    });

    section.appendChild(grid);
    return section;
}

// Create rarity card for rock compositions
function createRarityCard(rarity, rocks) {
    const card = document.createElement('div');
    card.className = 'rarity-card';

    const title = document.createElement('div');
    title.className = `rarity-title rarity-${rarity.toLowerCase()}`;
    title.innerHTML = `<span>★</span> ${rarity}`;
    card.appendChild(title);

    const rockList = document.createElement('ul');
    rockList.className = 'rock-list';

    rocks.forEach(rock => {
        const rockItem = document.createElement('li');
        rockItem.className = 'rock-item';

        const rockName = document.createElement('div');
        rockName.className = 'rock-name';
        rockName.innerHTML = `${rock.name} <span class="expand-hint">▼</span>`;
        rockItem.appendChild(rockName);

        const details = document.createElement('div');
        details.className = 'rock-details';

        rock.compositions.forEach(comp => {
            const row = document.createElement('div');
            row.className = 'composition-row';

            const label = document.createElement('span');
            label.className = 'composition-label';
            label.textContent = comp.mineral;

            const bar = document.createElement('div');
            bar.className = 'composition-bar';

            const fill = document.createElement('div');
            fill.className = 'composition-fill';
            fill.style.width = `${comp.max}%`;
            fill.style.background = rarityColors[rarity];
            fill.style.opacity = '0.6';
            bar.appendChild(fill);

            const range = document.createElement('span');
            range.className = 'composition-range';
            range.textContent = `${comp.min}% - ${comp.max}%`;

            const qualityScale = document.createElement('span');
            qualityScale.className = 'quality-scale';
            qualityScale.textContent = `QS: ${comp.qualityScale || 1}`;
            qualityScale.title = 'Quality Scale';

            row.appendChild(label);
            row.appendChild(bar);
            row.appendChild(range);
            row.appendChild(qualityScale);
            details.appendChild(row);
        });

        rockItem.appendChild(details);
        rockList.appendChild(rockItem);

        rockItem.addEventListener('click', () => {
            rockItem.classList.toggle('expanded');
            const hint = rockItem.querySelector('.expand-hint');
            hint.textContent = rockItem.classList.contains('expanded') ? '▲' : '▼';
        });
    });

    card.appendChild(rockList);
    return card;
}

function hasQualityQuantizationData(qualityQuantization) {
    return Boolean(
        qualityQuantization &&
        Array.isArray(qualityQuantization.materials) &&
        qualityQuantization.materials.length > 0
    );
}

function createQualityQuantizationSection(qualityQuantization, options = {}) {
    if (!hasQualityQuantizationData(qualityQuantization)) {
        return null;
    }

    const section = document.createElement('div');
    section.className = 'quantization-section';

    const title = document.createElement('h2');
    title.className = 'category-title';
    title.textContent = options.title || 'Quality Quantization Bands';
    section.appendChild(title);

    const infoBox = document.createElement('div');
    infoBox.className = 'info-box';
    infoBox.innerHTML = `
        <strong>Quality Quantization:</strong> Raw quality rolls still use the distributions above, then each material maps
        the raw roll into these fixed output quality values. Column headers are raw quality bands and each cell is the
        final inventory quality for that material.
    `;
    section.appendChild(infoBox);

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'quantization-table-wrapper';

    const table = document.createElement('table');
    table.className = 'quantization-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const materialHeader = document.createElement('th');
    materialHeader.textContent = 'Material';
    headerRow.appendChild(materialHeader);

    const bandRanges = qualityQuantization.bandRanges && qualityQuantization.bandRanges.length > 0
        ? qualityQuantization.bandRanges
        : qualityQuantization.materials[0].bands.map((band) => ({ start: band.start, end: band.end }));

    for (const bandRange of bandRanges) {
        const th = document.createElement('th');
        th.textContent = `${bandRange.start}-${bandRange.end}`;
        headerRow.appendChild(th);
    }

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    for (const material of qualityQuantization.materials) {
        const row = document.createElement('tr');

        const materialCell = document.createElement('td');
        materialCell.className = 'quantization-material-name';
        materialCell.textContent = material.name;
        row.appendChild(materialCell);

        for (const bandRange of bandRanges) {
            const band = material.bands.find((item) => item.start === bandRange.start && item.end === bandRange.end);
            const cell = document.createElement('td');
            cell.className = 'quantization-band-cell';

            if (band) {
                const mappedValue = document.createElement('span');
                mappedValue.className = 'quantization-mapped-value';
                mappedValue.textContent = band.mappedValue;
                cell.appendChild(mappedValue);
            } else {
                cell.classList.add('quantization-empty');
                cell.textContent = '-';
            }

            row.appendChild(cell);
        }

        tbody.appendChild(row);
    }

    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    section.appendChild(tableWrapper);

    return section;
}

// Create comparison summary table
function createComparisonSummaryTable(qualityDataA, qualityDataB, versionALabel, versionBLabel) {
    const section = document.createElement('div');
    section.className = 'category-section';

    const title = document.createElement('h2');
    title.className = 'category-title';
    title.textContent = 'Quality Distribution Comparison Summary';
    section.appendChild(title);

    const table = document.createElement('table');
    table.className = 'comparison-summary-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Category</th>
            <th>Item</th>
            <th>Mean Delta</th>
            <th>StdDev Delta</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    const categoryOrder = ['Ship Mineables', 'Harvestables', 'Ground Mineables', 'FPS Mineables', 'Creatures'];

    for (const category of categoryOrder) {
        const itemsA = qualityDataA[category] || [];
        const itemsB = qualityDataB[category] || [];

        for (const itemA of itemsA) {
            const itemB = itemsB.find(b => b.name === itemA.name);
            if (!itemB) continue;

            const defaultMeanDelta = calculateDelta(itemA.default.mean, itemB.default.mean);
            const defaultStddevDelta = calculateDelta(itemA.default.stddev, itemB.default.stddev);
            const verdict = calculateVerdict(defaultMeanDelta, defaultStddevDelta);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${category}</td>
                <td>${itemA.name}</td>
                <td class="${defaultMeanDelta.positive ? 'delta-positive' : defaultMeanDelta.negative ? 'delta-negative' : 'delta-neutral'}">
                    ${formatDelta(defaultMeanDelta)}
                </td>
                <td class="${defaultStddevDelta.positive ? 'delta-positive' : defaultStddevDelta.negative ? 'delta-negative' : 'delta-neutral'}">
                    ${formatDelta(defaultStddevDelta)}
                </td>
            `;
            tbody.appendChild(row);
        }
    }

    table.appendChild(tbody);
    section.appendChild(table);

    const infoBox = document.createElement('div');
    infoBox.className = 'info-box';
    infoBox.innerHTML = '<strong>Note:</strong> Click any row below to view detailed overlapping distribution charts for that item.';
    section.appendChild(infoBox);

    return section;
}

// Create comparison chart section
function createComparisonChartSection(category, itemA, itemB, versionALabel, versionBLabel, rockData = null) {
    const container = document.createElement('div');
    container.className = 'chart-container';

    const chartTitle = document.createElement('h3');
    chartTitle.className = 'chart-title';

    const meanDelta = calculateDelta(itemA.default.mean, itemB.default.mean);
    const stddevDelta = calculateDelta(itemA.default.stddev, itemB.default.stddev);

    chartTitle.innerHTML = `${itemA.name} 
        <span class="version-badge version-badge-a">${versionALabel}</span>
        <span class="version-badge version-badge-b">${versionBLabel}</span>`;

    const chartKey = `compare:${category}:${itemA.name}:${versionALabel}:${versionBLabel}`;
    const chartDatasets = buildComparisonDatasets(itemA, itemB, versionALabel, versionBLabel);
    const quantizationOverlay = getQuantizationOverlayForItem(category, itemA, rockData);
    const expandButton = createExpandButton(`Expand comparison chart for ${itemA.name}`, () => {
        openExpandedChart({
            key: chartKey,
            title: `${itemA.name} Comparison`,
            subtitle: `${category} · ${versionALabel} vs ${versionBLabel}`,
            datasets: chartDatasets,
            quantizationOverlay
        }, expandButton);
    });

    container.appendChild(createChartHeader(chartTitle, expandButton));

    const canvas = document.createElement('canvas');
    canvas.id = `compare-${category.replace(/\s/g, '-')}-${itemA.name.replace(/\s/g, '-')}`;
    container.appendChild(canvas);

    const statsDiv = document.createElement('div');
    statsDiv.className = 'stats-grid';

    statsDiv.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">${versionALabel} Mean</div>
            <div class="stat-value" style="color: #6496ff">${itemA.default.mean}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">${versionBLabel} Mean</div>
            <div class="stat-value" style="color: #ff6464">${itemB.default.mean}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Mean Delta</div>
            <div class="stat-value ${meanDelta.positive ? 'delta-positive' : meanDelta.negative ? 'delta-negative' : 'delta-neutral'}">${formatDelta(meanDelta)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">StdDev Delta</div>
            <div class="stat-value ${stddevDelta.positive ? 'delta-positive' : stddevDelta.negative ? 'delta-negative' : 'delta-neutral'}">${formatDelta(stddevDelta)}</div>
        </div>
    `;

    const minVal = itemA.default ? itemA.default.min : '?';
    statsDiv.innerHTML += `
        <div class="stat-card">
            <div class="stat-label" style="display: flex; align-items: center; gap: 5px;">
                Quality Range
                <span class="tooltip-icon" title="The low end of this range is theoretical based on normal distribution. It might not be used by game currently.">?</span>
            </div>
            <div class="stat-value" style="font-size: 1rem">${minVal} - 1000</div>
        </div>
    `;

    container.appendChild(statsDiv);

    createChartInstance(canvas, chartDatasets, createQuantizationChartOptionOverrides(quantizationOverlay));

    if (window.__restoreExpandedChartKey === chartKey) {
        window.__restoreExpandedChartKey = null;
        openExpandedChart({
            key: chartKey,
            title: `${itemA.name} Comparison`,
            subtitle: `${category} · ${versionALabel} vs ${versionBLabel}`,
            datasets: chartDatasets,
            quantizationOverlay
        }, expandButton);
    }

    return container;
}

// Create rock composition comparison
function createRockCompositionComparison(rockDataA, rockDataB, versionALabel, versionBLabel) {
    const section = document.createElement('div');
    section.className = 'composition-section';

    const title = document.createElement('h2');
    title.className = 'category-title';
    title.textContent = 'Rock Composition Comparison';
    section.appendChild(title);

    const infoBox = document.createElement('div');
    infoBox.className = 'info-box';
    infoBox.innerHTML = '<strong>Comparison:</strong> Side-by-side view of rock composition ranges between selected versions.';
    section.appendChild(infoBox);

    const rarityGrid = document.createElement('div');
    rarityGrid.className = 'rarity-grid';

    for (const [rarity, rocksA] of Object.entries(rockDataA)) {
        const rocksB = rockDataB[rarity] || [];

        const comparisonCard = document.createElement('div');
        comparisonCard.className = 'rarity-card';

        const cardTitle = document.createElement('div');
        cardTitle.className = `rarity-title rarity-${rarity.toLowerCase()}`;
        cardTitle.innerHTML = `<span>★</span> ${rarity}`;
        comparisonCard.appendChild(cardTitle);

        for (const rockA of rocksA) {
            const rockB = rocksB.find(r => r.name === rockA.name);
            if (!rockB) continue;

            const comparisonContainer = document.createElement('div');
            comparisonContainer.className = 'rock-comparison-grid';

            ['A', 'B'].forEach((version, idx) => {
                const rock = version === 'A' ? rockA : rockB;
                const label = version === 'A' ? versionALabel : versionBLabel;
                const borderColor = version === 'A' ? '#6496ff' : '#ff6464';

                const card = document.createElement('div');
                card.className = 'rock-comparison-card';
                card.style.border = `1px solid ${borderColor}33`;

                const rockName = document.createElement('div');
                rockName.className = 'rock-name';
                rockName.style.color = borderColor;
                rockName.textContent = `${label}: ${rock.name}`;
                card.appendChild(rockName);

                const compositionList = document.createElement('div');
                compositionList.style.marginTop = '10px';

                rock.compositions.forEach(comp => {
                    const row = document.createElement('div');
                    row.className = 'composition-row';
                    row.style.display = 'flex';
                    row.style.alignItems = 'center';
                    row.style.gap = '10px';
                    row.style.marginBottom = '8px';

                    const label = document.createElement('span');
                    label.textContent = comp.mineral;
                    label.style.fontSize = '0.9rem';

                    const range = document.createElement('span');
                    range.textContent = `${comp.min}% - ${comp.max}%`;
                    range.style.fontSize = '0.85rem';
                    range.style.color = '#aaa';

                    const qualityScale = document.createElement('span');
                    qualityScale.textContent = `QS: ${comp.qualityScale || 1}`;
                    qualityScale.style.fontSize = '0.85rem';
                    qualityScale.style.color = '#888';
                    qualityScale.title = 'Quality Scale';

                    row.appendChild(label);
                    row.appendChild(range);
                    row.appendChild(qualityScale);
                    compositionList.appendChild(row);
                });

                card.appendChild(compositionList);
                comparisonContainer.appendChild(card);
            });

            comparisonCard.appendChild(comparisonContainer);
        }

        rarityGrid.appendChild(comparisonCard);
    }

    section.appendChild(rarityGrid);
    return section;
}
