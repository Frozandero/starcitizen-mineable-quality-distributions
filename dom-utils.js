// DOM manipulation utilities for rendering UI elements

let charts = [];

// Destroy all charts
function destroyCharts() {
    charts.forEach(chart => chart.destroy());
    charts = [];
}

// Create category section for quality distributions
function createCategorySection(categoryData) {
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

        const overrideTypes = getOverrideTypes(item);
        let badges = '<span class="badge badge-default">Default</span>';
        for (const type of overrideTypes) {
            const color = overrideColors[type]?.label || type;
            badges += ` <span class="badge badge-${type}" style="background: ${overrideColors[type]?.bg || 'rgba(255,255,255,0.1)'}; border: 1px solid ${overrideColors[type]?.border || 'rgba(255,255,255,0.3)'}; color: #fff">${overrideColors[type]?.label || type}</span>`;
        }
        chartTitle.innerHTML = `${item.name} ${badges}`;
        container.appendChild(chartTitle);

        const canvas = document.createElement('canvas');
        canvas.id = `chart-${categoryData.category.replace(/\s/g, '-')}-${item.name.replace(/\s/g, '-')}`;
        container.appendChild(canvas);

        const statsDiv = document.createElement('div');
        statsDiv.className = 'stats-grid';

        let statsHtml = '';

        if (item.default) {
            statsHtml += `
                <div class="stat-card">
                    <div class="stat-label">Default Mean</div>
                    <div class="stat-value">${item.default.mean}</div>
                </div>
            `;
        }

        for (const type of overrideTypes) {
            const color = overrideColors[type]?.border || '#fff';
            statsHtml += `
                <div class="stat-card">
                    <div class="stat-label">${overrideColors[type]?.label || type} Mean</div>
                    <div class="stat-value" style="color: ${color}">${item[type].mean}</div>
                </div>
            `;
        }

        if (item.improvement) {
            statsHtml += `
                <div class="stat-card">
                    <div class="stat-label">Improvement</div>
                    <div class="stat-value" style="color: #00ff88">+${item.improvement}%</div>
                </div>
            `;
        }

        const minVal = item.default ? item.default.min : '?';
        statsHtml += `
            <div class="stat-card">
                <div class="stat-label" style="display: flex; align-items: center; gap: 5px;">
                    Quality Range
                    <span class="tooltip-icon" title="The low end of this range is theoretical based on normal distribution. It might not be used by game currently.">?</span>
                </div>
                <div class="stat-value" style="font-size: 1rem">${minVal} - 1000</div>
            </div>
        `;

        statsDiv.innerHTML = statsHtml;
        container.appendChild(statsDiv);
        grid.appendChild(container);

        const overrideTypesPresent = getOverrideTypes(item);
        const hasAnyData = (item.default && overrideTypesPresent.length > 0) || overrideTypesPresent.length > 0;

        if (hasAnyData) {
            const ctx = canvas.getContext('2d');

            const datasets = [];

            if (item.default) {
                datasets.push({
                    label: 'Default',
                    data: generateDistributionData(item.default),
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
                datasets.push({
                    label: overrideColors[type]?.label || type,
                    data: generateDistributionData(item[type]),
                    borderColor: overrideColors[type]?.border || '#fff',
                    backgroundColor: overrideColors[type]?.bg || 'rgba(255,255,255,0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    customData: item[type]
                });
            }

            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: datasets
                },
                options: createChartOptions()
            });

            charts.push(chart);
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

            row.appendChild(label);
            row.appendChild(bar);
            row.appendChild(range);
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
            <th>Verdict</th>
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
                <td><span class="verdict-badge ${verdict.class}">${verdict.icon} ${verdict.label}</span></td>
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
function createComparisonChartSection(category, itemA, itemB, versionALabel, versionBLabel) {
    const container = document.createElement('div');
    container.className = 'chart-container';

    const chartTitle = document.createElement('h3');
    chartTitle.className = 'chart-title';
    
    const meanDelta = calculateDelta(itemA.default.mean, itemB.default.mean);
    const stddevDelta = calculateDelta(itemA.default.stddev, itemB.default.stddev);
    const verdict = calculateVerdict(meanDelta, stddevDelta);

    chartTitle.innerHTML = `${itemA.name} 
        <span class="version-badge version-badge-a">${versionALabel}</span>
        <span class="version-badge version-badge-b">${versionBLabel}</span>
        <span class="verdict-badge ${verdict.class}">${verdict.icon} ${verdict.label}</span>`;
    container.appendChild(chartTitle);

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

    statsDiv.innerHTML += `
        <div class="stat-card">
            <div class="stat-label" style="display: flex; align-items: center; gap: 5px;">
                Quality Range
                <span class="tooltip-icon" title="The low end of this range is theoretical based on normal distribution. It might not be used by game currently.">?</span>
            </div>
            <div class="stat-value" style="font-size: 1rem">${itemA.default.min} - 1000</div>
        </div>
    `;

    container.appendChild(statsDiv);

    const ctx = canvas.getContext('2d');

    const datasets = [
        {
            label: versionALabel,
            data: generateDistributionData(itemA.default),
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
            data: generateDistributionData(itemB.default),
            borderColor: versionColors.versionB.border,
            backgroundColor: versionColors.versionB.bg,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            customData: itemB.default
        }
    ];

    const chart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: createChartOptions()
    });

    charts.push(chart);

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

                    row.appendChild(label);
                    row.appendChild(range);
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
