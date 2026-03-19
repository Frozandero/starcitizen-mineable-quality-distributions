// Main application logic for quality distribution visualizer

let currentVersion = null;
let viewMode = 'single';
let versionA = null;
let versionB = null;

// Set view mode (single or compare)
function setViewMode(mode) {
    viewMode = mode;

    const singleSelector = document.getElementById('single-version-selector');
    const compareSelector = document.getElementById('compare-version-selector');
    const singleBtn = document.getElementById('single-mode-btn');
    const compareBtn = document.getElementById('compare-mode-btn');

    if (mode === 'single') {
        singleSelector.style.display = 'flex';
        compareSelector.style.display = 'none';
        singleBtn.classList.add('active');
        compareBtn.classList.remove('active');
        loadVersion(currentVersion);
    } else {
        singleSelector.style.display = 'none';
        compareSelector.style.display = 'flex';
        compareBtn.classList.add('active');
        singleBtn.classList.remove('active');
        loadComparison(versionA, versionB);
    }
}

// Load version data
async function loadVersion(versionId) {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading">Loading data...</div>';

    try {
        const [qualityRes, rockRes] = await Promise.all([
            fetch(`./data/${versionId}/quality_distributions.json`),
            fetch(`./data/${versionId}/rock_compositions.json`)
        ]);

        const qualityJson = await qualityRes.json();
        const rockData = await rockRes.json();

        const qualityData = qualityJson.categories || qualityJson;
        const rockCrackerData = qualityJson.rockCrackerDistributions || null;

        renderContent(qualityData, rockData, rockCrackerData, versionId);
    } catch (error) {
        console.error('Error loading version data:', error);
        content.innerHTML = '<div class="loading">Error loading data. Please try again.</div>';
    }
}

// Load comparison data (new function)
async function loadComparison(versionIdA, versionIdB) {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading">Loading comparison data...</div>';

    // Debug logging
    console.log('loadComparison called with:', { versionIdA, versionIdB, viewMode });

    if (!versionIdA || !versionIdB) {
        console.error('Missing version IDs:', { versionIdA, versionIdB });
        content.innerHTML = '<div class="loading">Error: Please select both versions to compare.</div>';
        return;
    }

    try {
        const [qualityResA, rockResA, qualityResB, rockResB] = await Promise.all([
            fetch(`./data/${versionIdA}/quality_distributions.json`),
            fetch(`./data/${versionIdA}/rock_compositions.json`),
            fetch(`./data/${versionIdB}/quality_distributions.json`),
            fetch(`./data/${versionIdB}/rock_compositions.json`)
        ]);

        if (!qualityResA.ok || !qualityResB.ok) {
            throw new Error(`Failed to fetch quality distributions for ${versionIdA} or ${versionIdB}`);
        }

        const qualityJsonA = await qualityResA.json();
        const rockDataA = await rockResA.json();
        const qualityJsonB = await qualityResB.json();
        const rockDataB = await rockResB.json();

        const qualityDataA = qualityJsonA.categories || qualityJsonA;
        const qualityDataB = qualityJsonB.categories || qualityJsonB;

        console.log('Comparison data loaded successfully:', { versionIdA, versionIdB });

        versionA = versionIdA;
        versionB = versionIdB;

        renderComparisonContent(qualityDataA, rockDataA, qualityDataB, rockDataB, versionIdA, versionIdB);
    } catch (error) {
        console.error('Error loading comparison data:', error);
        content.innerHTML = `<div class="loading">Error loading comparison data: ${error.message}. Please try again.</div>`;
    }
}

// Render comparison content (new function)
function renderComparisonContent(qualityDataA, rockDataA, qualityDataB, rockDataB, versionIdA, versionIdB) {
    const content = document.getElementById('content');
    destroyCharts();

    const versionALabel = VERSIONS.find(v => v.id === versionIdA)?.label || versionIdA;
    const versionBLabel = VERSIONS.find(v => v.id === versionIdB)?.label || versionIdB;

    let html = `
        <div class="info-box">
            <strong>Comparison Mode:</strong> Viewing quality distribution differences between ${versionALabel} and ${versionBLabel}. 
            Overlapping curves show how distributions shifted. Summary table provides quick overview of changes.
        </div>
    `;

    html += `
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background: rgba(100, 150, 255, 0.8)"></div>
                <span class="legend-label">${versionALabel}</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: rgba(255, 100, 100, 0.8)"></div>
                <span class="legend-label">${versionBLabel}</span>
            </div>
        </div>
    `;

    content.innerHTML = html;

    // Add comparison summary table
    const summaryTable = createComparisonSummaryTable(qualityDataA, qualityDataB, versionALabel, versionBLabel);
    content.appendChild(summaryTable);

    // Add comparison charts by category
    const qualityContainer = document.createElement('div');
    qualityContainer.id = 'quality-distributions';
    content.appendChild(qualityContainer);

    const categoryOrder = ['Ship Mineables', 'Harvestables', 'Ground Mineables', 'FPS Mineables', 'Creatures'];

    for (const category of categoryOrder) {
        const itemsA = qualityDataA[category] || [];
        const itemsB = qualityDataB[category] || [];

        if (itemsA.length > 0) {
            const section = document.createElement('div');
            section.className = 'category-section';

            const title = document.createElement('h2');
            title.className = 'category-title';
            title.textContent = category;
            section.appendChild(title);

            const grid = document.createElement('div');
            grid.className = 'charts-grid';

            for (const itemA of itemsA) {
                const itemB = itemsB.find(b => b.name === itemA.name);
                if (!itemB) continue;

                const chartContainer = createComparisonChartSection(category, itemA, itemB, versionALabel, versionBLabel);
                grid.appendChild(chartContainer);
            }

            section.appendChild(grid);
            qualityContainer.appendChild(section);
        }
    }

    // Add rock composition comparison
    const rockComparison = createRockCompositionComparison(rockDataA, rockDataB, versionALabel, versionBLabel);
    content.appendChild(rockComparison);

    // Add footer
    const footer = document.createElement('footer');
    footer.style.cssText = 'margin-top: 60px; padding: 30px 20px; text-align: center; background: rgba(0, 0, 0, 0.5); border-top: 1px solid rgba(255,255,255, 0.1);';
    footer.innerHTML = `
        <h3 style="font-family: 'Orbitron', sans-serif; color: #ff6432; margin-bottom: 15px;">Unofficial Fan Site</h3>
        <p style="color: #888; font-size: 0.9rem; line-height: 1.6; max-width: 800px; margin: 0 auto;">
            This site is not endorsed by or affiliated with Cloud Imperium or Roberts Space Industries group of companies.
            All game content and materials are copyright Cloud Imperium Rights LLC and Cloud Imperium Rights Ltd.
            Star Citizen®, Squadron 42®, Roberts Space Industries®, and Cloud Imperium® are registered trademarks of
            Cloud Imperium Rights LLC. All rights reserved. This is a community-created tool for informational purposes only.
        </p>
        <p style="margin-top: 20px; color: #666; font-size: 0.8rem;">
            Comparison between ${versionALabel} and ${versionBLabel}
        </p>
    `;
    content.appendChild(footer);
}

// Render content to the page
function renderContent(qualityData, rockData, rockCrackerData, versionId) {
    const content = document.getElementById('content');
    destroyCharts();

    const versionLabel = VERSIONS.find(v => v.id === versionId)?.label || versionId;

    // Collect all override types from quality data
    const allOverrideTypes = new Set();
    Object.values(qualityData).forEach(categoryItems => {
        categoryItems.forEach(item => {
            getOverrideTypes(item).forEach(type => allOverrideTypes.add(type));
        });
    });

    let legendHtml = `
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background: rgba(255,255,255, 0.6)"></div>
                <span class="legend-label">Default Distribution</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: rgba(255, 100, 50, 0.8)"></div>
                <span class="legend-label">Pyro Override</span>
            </div>
    `;

    if (rockCrackerData && (rockCrackerData.rcd?.length > 0 || rockCrackerData.torite?.length > 0)) {
        if (rockCrackerData.rcd?.length > 0) {
            legendHtml += `
                <div class="legend-item">
                    <div class="legend-color" style="background: rgba(50, 150, 255, 0.8)"></div>
                    <span class="legend-label">RCD Override</span>
                </div>
            `;
        }
        if (rockCrackerData.torite?.length > 0) {
            legendHtml += `
                <div class="legend-item">
                    <div class="legend-color" style="background: rgba(255, 200, 50, 0.8)"></div>
                    <span class="legend-label">Torite Override</span>
                </div>
            `;
        }
    }

    // Add custom override types
    allOverrideTypes.forEach(type => {
        if (!['pyro', 'rcd', 'torite'].includes(type)) {
            const color = overrideColors[type];
            if (color) {
                legendHtml += `
                    <div class="legend-item">
                        <div class="legend-color" style="background: ${color.bg.replace('0.15', '0.8')}"></div>
                        <span class="legend-label">${color.label || type.charAt(0).toUpperCase() + type.slice(1)} Override</span>
                    </div>
                `;
            }
        }
    });

    legendHtml += `</div>`;

    let rcdSectionHtml = '';
    if (rockCrackerData && (rockCrackerData.rcd?.length > 0 || rockCrackerData.torite?.length > 0)) {
        rcdSectionHtml = `
            <div class="category-section" id="rock-cracker-distributions">
                <h2 class="category-title">⛏️ Rock Cracker Distributions</h2>
                    <div class="info-box">
                    <strong>Rock Cracker Distributions (RCD)</strong> - These are special quality distributions for Rock Cracker Device (RCD) in Nyx. 
                    RCD applies to non-Torite nodes in RCD locations. Torite Override applies specifically to Torite rocks in RCD locations.
                    The values shown are averages across all RCD locations in game.
                </div>
                
                <div class="rarity-grid" id="rcd-grid"></div>
            </div>
        `;
    }

    let html = `
        <div class="info-box">
            <strong>Note:</strong> These are normal distributions bounded by min/max values from game files (mean, min,
            max, stddev). The charts show probability density of obtaining items at different quality levels (1-1000
            scale). Pyro system overrides typically offer improved distributions compared to default settings.
        </div>

        ${legendHtml}

        <div id="quality-distributions"></div>

        ${rcdSectionHtml}

        <div class="composition-section" id="rock-compositions">
            <h2 class="category-title">💎 Rock Composition Ranges</h2>
            <div class="info-box">
                <strong>Click on any mineral rock</strong> to see its composition breakdown. These ranges show the
                minimum and maximum percentage of each mineral that can be found in a rock of that type. Values
                represent the percentage composition of the rock's total content.
            </div>

            <div class="rarity-grid" id="rarity-grid"></div>
        </div>

        <footer style="margin-top: 60px; padding: 30px 20px; text-align: center; background: rgba(0, 0, 0, 0.5); border-top: 1px solid rgba(255,255,255, 0.1);">
            <h3 style="font-family: 'Orbitron', sans-serif; color: #ff6432; margin-bottom: 15px;">Unofficial Fan Site</h3>
            <p style="color: #888; font-size: 0.9rem; line-height: 1.6; max-width: 800px; margin: 0 auto;">
                This site is not endorsed by or affiliated with Cloud Imperium or Roberts Space Industries group of companies.
                All game content and materials are copyright Cloud Imperium Rights LLC and Cloud Imperium Rights Ltd.
                Star Citizen®, Squadron 42®, Roberts Space Industries®, and Cloud Imperium® are registered trademarks of
                Cloud Imperium Rights LLC. All rights reserved. This is a community-created tool for informational purposes only.
            </p>
            <p style="margin-top: 20px; color: #666; font-size: 0.8rem;">
                Data sourced from Star Citizen ${versionLabel} patch files
            </p>
        </footer>
    `;

    content.innerHTML = html;

    const qualityContainer = document.getElementById('quality-distributions');

    const categoryOrder = ['Ship Mineables', 'Harvestables', 'Ground Mineables', 'FPS Mineables', 'Creatures'];

    for (const category of categoryOrder) {
        const items = qualityData[category];
        if (items && items.length > 0) {
            qualityContainer.appendChild(createCategorySection({ category, items }));
        }
    }

    if (rockCrackerData && (rockCrackerData.rcd?.length > 0 || rockCrackerData.torite?.length > 0)) {
        const rcdGrid = document.getElementById('rcd-grid');

        if (rockCrackerData.rcd?.length > 0) {
            rcdGrid.appendChild(createCategorySection({ category: 'RCD (Non-Torite)', items: rockCrackerData.rcd }));
        }
        if (rockCrackerData.torite?.length > 0) {
            rcdGrid.appendChild(createCategorySection({ category: 'Torite Only', items: rockCrackerData.torite }));
        }
    }

    const rarityGrid = document.getElementById('rarity-grid');
    for (const [rarity, rocks] of Object.entries(rockData)) {
        if (rocks && rocks.length > 0) {
            rarityGrid.appendChild(createRarityCard(rarity, rocks));
        }
    }
}

// Initialize the application
function init() {
    const singleSelect = document.getElementById('version-select');
    const versionSelectA = document.getElementById('version-select-a');
    const versionSelectB = document.getElementById('version-select-b');

    // Populate all three selectors
    [singleSelect, versionSelectA, versionSelectB].forEach(select => {
        select.innerHTML = '';
        VERSIONS.forEach(version => {
            const option = document.createElement('option');
            option.value = version.id;
            option.textContent = version.label;
            select.appendChild(option);
        });
    });

    // Set default values
    if (VERSIONS.length >= 1) {
        singleSelect.value = VERSIONS[0].id;
        versionSelectA.value = VERSIONS[1] ? VERSIONS[1].id : VERSIONS[0].id;
        versionSelectB.value = VERSIONS[0].id;
        currentVersion = VERSIONS[0].id;
        versionA = versionSelectA.value;
        versionB = versionSelectB.value;
        console.log('Initialized with:', { currentVersion, versionA, versionB });
    }

    // Event listeners
    singleSelect.addEventListener('change', (e) => {
        loadVersion(e.target.value);
    });

    versionSelectA.addEventListener('change', (e) => {
        versionA = e.target.value;
        if (viewMode === 'compare') {
            loadComparison(versionA, versionB);
        }
    });

    versionSelectB.addEventListener('change', (e) => {
        versionB = e.target.value;
        if (viewMode === 'compare') {
            loadComparison(versionA, versionB);
        }
    });

    document.getElementById('single-mode-btn').addEventListener('click', () => setViewMode('single'));
    document.getElementById('compare-mode-btn').addEventListener('click', () => setViewMode('compare'));

    // Load default view
    loadVersion(currentVersion);
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
