// Find Resources viewer for Harvestable Spawn Shares.

const FIND_RESOURCES_CATEGORIES = [
    'All Categories',
    'Ship Mining',
    'Hand Mining',
    'Vehicle Mining',
    'Harvestables',
    'Salvage',
    'Other'
];

function normalizeSearchText(value) {
    return String(value || '').trim().toLowerCase();
}

function formatTitleCase(value) {
    return String(value || 'Unknown')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatShare(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '0.0%';
    }

    return `${(numeric * 100).toFixed(1)}%`;
}

function getResources(harvestableSpawnShares) {
    return Array.isArray(harvestableSpawnShares?.resources)
        ? harvestableSpawnShares.resources
        : [];
}

function getLocations(harvestableSpawnShares) {
    return Array.isArray(harvestableSpawnShares?.locations)
        ? harvestableSpawnShares.locations
        : [];
}

function filterResultsByCategory(results, category) {
    return results.filter((result) => category === 'All Categories' || result.category === category);
}

function sortResultsByLocationShare(results) {
    return results
        .slice()
        .sort((a, b) => (Number(b.locationShare) || 0) - (Number(a.locationShare) || 0));
}

function getResourceOptions(harvestableSpawnShares, searchText = '') {
    const normalizedSearch = normalizeSearchText(searchText);

    return getResources(harvestableSpawnShares)
        .filter((resource) => {
            if (!normalizedSearch) {
                return true;
            }

            return normalizeSearchText(resource.name).includes(normalizedSearch);
        })
        .map((resource) => ({
            id: resource.id,
            name: resource.name
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function getLocationOptions(harvestableSpawnShares, searchText = '') {
    const normalizedSearch = normalizeSearchText(searchText);

    return getLocations(harvestableSpawnShares)
        .filter((location) => {
            if (!normalizedSearch) {
                return true;
            }

            const searchable = [
                location.name,
                location.system,
                location.locationType
            ].map(normalizeSearchText).join(' ');
            return searchable.includes(normalizedSearch);
        })
        .map((location) => ({
            id: location.id,
            name: location.name || 'Unknown Location',
            system: formatTitleCase(location.system),
            locationType: location.locationType || 'Location'
        }))
        .sort((a, b) => a.system.localeCompare(b.system) || a.name.localeCompare(b.name));
}

function findResource(harvestableSpawnShares, resourceId) {
    const resources = getResources(harvestableSpawnShares);
    if (resourceId) {
        const selected = resources.find((resource) => resource.id === resourceId);
        if (selected) {
            return selected;
        }
    }

    return resources[0] || null;
}

function findLocation(harvestableSpawnShares, locationId) {
    const locations = getLocations(harvestableSpawnShares);
    if (locationId) {
        const selected = locations.find((location) => location.id === locationId);
        if (selected) {
            return selected;
        }
    }

    return locations[0] || null;
}

function normalizeResult(result) {
    return {
        location: result.location || result.locationName || 'Unknown Location',
        system: formatTitleCase(result.system),
        category: result.category || 'Other',
        shareInCategoryLabel: formatShare(result.shareInCategory),
        locationShareLabel: formatShare(result.locationShare)
    };
}

function getByResourceResults(harvestableSpawnShares, options = {}) {
    const resource = findResource(harvestableSpawnShares, options.resourceId);
    if (!resource) {
        return [];
    }

    const category = options.category || 'All Categories';
    const results = Array.isArray(resource.results) ? resource.results : [];

    return sortResultsByLocationShare(filterResultsByCategory(results, category))
        .map(normalizeResult);
}

function normalizeLocationEntry(location, group, entry) {
    return {
        resource: entry.resource?.name || 'Unknown Resource',
        category: entry.category || group.category || 'Other',
        shareInCategory: Number(entry.shareInCategory) || 0,
        locationShare: Number(entry.locationShare) || 0,
        shareInCategoryLabel: formatShare(entry.shareInCategory),
        locationShareLabel: formatShare(entry.locationShare),
        detailRef: {
            locationId: location.id,
            groupId: group.id,
            entryId: entry.id
        }
    };
}

function getByLocationGroups(harvestableSpawnShares, options = {}) {
    const location = findLocation(harvestableSpawnShares, options.locationId);
    if (!location) {
        return [];
    }

    const category = options.category || 'All Categories';
    const groupsByCategory = new Map();

    for (const group of Array.isArray(location.groups) ? location.groups : []) {
        for (const entry of Array.isArray(group.entries) ? group.entries : []) {
            const result = normalizeLocationEntry(location, group, entry);
            if (category !== 'All Categories' && result.category !== category) {
                continue;
            }

            const categoryResults = groupsByCategory.get(result.category);
            if (categoryResults) {
                categoryResults.push(result);
            } else {
                groupsByCategory.set(result.category, [result]);
            }
        }
    }

    return Array.from(groupsByCategory.entries())
        .map(([groupCategory, results]) => ({
            category: groupCategory,
            results: results
                .slice()
                .sort((a, b) => b.locationShare - a.locationShare || a.resource.localeCompare(b.resource))
                .map(({ shareInCategory, locationShare, ...result }) => result)
        }))
        .sort((a, b) => a.category.localeCompare(b.category));
}

function findDetailRecord(harvestableSpawnShares, detailRef) {
    const location = findLocation(harvestableSpawnShares, detailRef?.locationId);
    if (!location) {
        return null;
    }

    const group = (Array.isArray(location.groups) ? location.groups : [])
        .find((candidate) => candidate.id === detailRef.groupId);
    const entry = (Array.isArray(group?.entries) ? group.entries : [])
        .find((candidate) => candidate.id === detailRef.entryId);

    if (!group || !entry) {
        return null;
    }

    return { location, group, entry };
}

function createSourceReference(source) {
    if (!source?.name && !source?.path) {
        return null;
    }

    return {
        ...(source.name ? { name: source.name } : {}),
        ...(source.path ? { path: source.path } : {})
    };
}

function createSourceVariant(label, source) {
    const sourceReference = createSourceReference(source);
    if (!sourceReference) {
        return null;
    }

    return {
        label,
        ...sourceReference
    };
}

function getSourceDetails(harvestableSpawnShares, detailRef) {
    const detailRecord = findDetailRecord(harvestableSpawnShares, detailRef);
    if (!detailRecord) {
        return null;
    }

    const { location, group, entry } = detailRecord;
    const source = entry.source || {};
    const sourceVariants = [
        createSourceVariant('Harvestable', source.harvestable),
        createSourceVariant('Resolved Harvestable', source.resolvedHarvestable),
        createSourceVariant('Entity Class', source.harvestableEntityClass || source.resolvedEntity),
        createSourceVariant('Clustering', source.clustering)
    ].filter(Boolean);

    return {
        provider: createSourceReference(location.source),
        group: {
            name: group.name,
            rawWeight: group.groupProbability
        },
        entry: {
            resource: entry.resource?.name || 'Unknown Resource',
            pointer: source.pointer,
            rawWeight: entry.relativeProbability,
            shareInCategoryLabel: formatShare(entry.shareInCategory),
            locationShareLabel: formatShare(entry.locationShare)
        },
        sourceVariants,
        areaMetadata: Array.isArray(location.areas) ? location.areas : []
    };
}

function createOption(value, label, selected = false) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = selected;
    return option;
}

function createResourceOption(resource, selectedResourceId) {
    return createOption(resource.id, resource.name, resource.id === selectedResourceId);
}

function createCategoryOption(category) {
    return createOption(category, category);
}

function createEmptyState(message) {
    const emptyState = document.createElement('div');
    emptyState.className = 'find-resources-empty';
    emptyState.textContent = message;
    return emptyState;
}

function appendTableCell(row, value) {
    const cell = document.createElement('td');
    cell.textContent = value;
    row.appendChild(cell);
}

function createDetailsRow(colSpan, details) {
    const detailsRow = document.createElement('tr');
    detailsRow.className = 'find-resources-details-row';
    detailsRow.hidden = true;

    const detailsCell = document.createElement('td');
    detailsCell.colSpan = colSpan;
    detailsCell.appendChild(createDetailsPanel(details));
    detailsRow.appendChild(detailsCell);

    return detailsRow;
}

function appendDetailsButtonCell(row, detailsRow) {
    const cell = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'find-resources-details-button';
    button.textContent = 'Details';
    button.addEventListener('click', () => {
        detailsRow.hidden = !detailsRow.hidden;
        button.textContent = detailsRow.hidden ? 'Details' : 'Hide';
    });
    cell.appendChild(button);
    row.appendChild(cell);
}

function appendResultRowWithDetails(tbody, row, details, colSpan) {
    if (details) {
        const detailsRow = createDetailsRow(colSpan, details);
        appendDetailsButtonCell(row, detailsRow);
        tbody.appendChild(row);
        tbody.appendChild(detailsRow);
        return;
    }

    appendTableCell(row, '');
    tbody.appendChild(row);
}

function appendDetailLine(list, label, value) {
    if (value === undefined || value === null || value === '') {
        return;
    }

    const item = document.createElement('div');
    item.className = 'find-resources-detail-line';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    const valueSpan = document.createElement('span');
    valueSpan.textContent = String(value);
    item.appendChild(labelSpan);
    item.appendChild(valueSpan);
    list.appendChild(item);
}

function createDetailsPanel(details) {
    const panel = document.createElement('div');
    panel.className = 'find-resources-details-panel';

    const sourceList = document.createElement('div');
    sourceList.className = 'find-resources-detail-list';
    appendDetailLine(sourceList, 'Provider', details.provider?.name);
    appendDetailLine(sourceList, 'Provider Path', details.provider?.path);
    appendDetailLine(sourceList, 'Group', details.group?.name);
    appendDetailLine(sourceList, 'Group Raw Weight', details.group?.rawWeight);
    appendDetailLine(sourceList, 'Entry Pointer', details.entry?.pointer);
    appendDetailLine(sourceList, 'Entry Raw Weight', details.entry?.rawWeight);
    panel.appendChild(sourceList);

    for (const variant of details.sourceVariants || []) {
        const variantList = document.createElement('div');
        variantList.className = 'find-resources-detail-list';
        appendDetailLine(variantList, variant.label, variant.name);
        appendDetailLine(variantList, `${variant.label} Path`, variant.path);
        panel.appendChild(variantList);
    }

    if (details.areaMetadata?.length) {
        const areaList = document.createElement('div');
        areaList.className = 'find-resources-detail-list';
        appendDetailLine(areaList, 'Area Metadata', 'Stored as source details only; shares are provider-level baselines.');
        appendDetailLine(areaList, 'Areas', details.areaMetadata.length);
        for (const area of details.areaMetadata) {
            appendDetailLine(areaList, 'Area', area.debugGroupName || area.areaType);
            appendDetailLine(areaList, 'Area Type', area.areaType);
            appendDetailLine(areaList, 'Global Modifier', area.globalModifier);
            appendDetailLine(areaList, 'Object Presets', (area.objectPresetPaths || []).join(', '));
            appendDetailLine(areaList, 'Modifiers', (area.modifiers || []).map((modifier) =>
                `${modifier.harvestableElement}: ${modifier.harvestableModifier}`
            ).join(', '));
        }
        panel.appendChild(areaList);
    }

    return panel;
}

function renderByResourceTable(container, harvestableSpawnShares, state) {
    container.innerHTML = '';

    const resource = findResource(harvestableSpawnShares, state.resourceId);
    const category = state.category || 'All Categories';
    const rawResults = Array.isArray(resource?.results) ? resource.results : [];
    const results = sortResultsByLocationShare(filterResultsByCategory(rawResults, category));

    if (results.length === 0) {
        container.appendChild(createEmptyState('No matching locations found for this resource and category.'));
        return;
    }

    const table = document.createElement('table');
    table.className = 'find-resources-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Location</th>
            <th>System</th>
            <th>Category</th>
            <th>Share in Category</th>
            <th>Location Share</th>
            <th>Source</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const result of results) {
        const visible = normalizeResult(result);
        const row = document.createElement('tr');
        appendTableCell(row, visible.location);
        appendTableCell(row, visible.system);
        appendTableCell(row, visible.category);
        appendTableCell(row, visible.shareInCategoryLabel);
        appendTableCell(row, visible.locationShareLabel);
        const details = getSourceDetails(harvestableSpawnShares, {
            locationId: result.locationId,
            groupId: result.groupId,
            entryId: result.entryId
        });
        appendResultRowWithDetails(tbody, row, details, 6);
    }

    table.appendChild(tbody);
    container.appendChild(table);
}

function renderByLocationTable(container, harvestableSpawnShares, state) {
    container.innerHTML = '';

    const groups = getByLocationGroups(harvestableSpawnShares, state);
    if (groups.length === 0) {
        container.appendChild(createEmptyState('No Harvestable Spawn Shares data found for this location and category.'));
        return;
    }

    for (const group of groups) {
        const title = document.createElement('h3');
        title.className = 'find-resources-group-title';
        title.textContent = group.category;
        container.appendChild(title);

        const table = document.createElement('table');
        table.className = 'find-resources-table';

        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Resource</th>
                <th>Category</th>
                <th>Share in Category</th>
                <th>Location Share</th>
                <th>Source</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (const result of group.results) {
            const row = document.createElement('tr');
            appendTableCell(row, result.resource);
            appendTableCell(row, result.category);
            appendTableCell(row, result.shareInCategoryLabel);
            appendTableCell(row, result.locationShareLabel);
            const details = getSourceDetails(harvestableSpawnShares, result.detailRef);
            appendResultRowWithDetails(tbody, row, details, 5);
        }

        table.appendChild(tbody);
        container.appendChild(table);
    }
}

function repopulateResourceSelect(select, harvestableSpawnShares, searchText, selectedResourceId) {
    const options = getResourceOptions(harvestableSpawnShares, searchText);
    select.innerHTML = '';

    for (const resource of options) {
        select.appendChild(createResourceOption(resource, selectedResourceId));
    }

    return options;
}

function repopulateLocationSelect(select, harvestableSpawnShares, searchText, selectedLocationId) {
    const options = getLocationOptions(harvestableSpawnShares, searchText);
    select.innerHTML = '';

    for (const location of options) {
        select.appendChild(createOption(location.id, `${location.name} (${location.system})`, location.id === selectedLocationId));
    }

    return options;
}

function syncSelectedResourceId(state, resourceSelect, options) {
    if (options.some((resource) => resource.id === state.resourceId)) {
        return;
    }

    state.resourceId = options[0]?.id || '';
    resourceSelect.value = state.resourceId;
}

function syncSelectedLocationId(state, locationSelect, options) {
    if (options.some((location) => location.id === state.locationId)) {
        return;
    }

    state.locationId = options[0]?.id || '';
    locationSelect.value = state.locationId;
}

function createFindResourcesSection(harvestableSpawnShares) {
    const section = document.createElement('div');
    section.className = 'find-resources-section';

    const title = document.createElement('h2');
    title.className = 'category-title';
    title.textContent = 'Find Resources';
    section.appendChild(title);

    const resources = getResources(harvestableSpawnShares);
    const locations = getLocations(harvestableSpawnShares);
    if (resources.length === 0 && locations.length === 0) {
        section.appendChild(createEmptyState('Harvestable Spawn Shares data is not available for this version.'));
        return section;
    }

    const state = {
        view: 'resource',
        resourceId: resources[0]?.id || '',
        locationId: locations[0]?.id || '',
        category: 'All Categories'
    };

    const tabs = document.createElement('div');
    tabs.className = 'find-resources-view-tabs';
    const byResource = document.createElement('button');
    byResource.type = 'button';
    byResource.className = 'mode-btn active';
    byResource.textContent = 'By Resource';
    tabs.appendChild(byResource);
    const byLocation = document.createElement('button');
    byLocation.type = 'button';
    byLocation.className = 'mode-btn';
    byLocation.textContent = 'By Location';
    tabs.appendChild(byLocation);
    section.appendChild(tabs);

    const resourceControls = document.createElement('div');
    resourceControls.className = 'find-resources-controls';

    const searchLabel = document.createElement('label');
    searchLabel.className = 'find-resources-control';
    searchLabel.textContent = 'Search Resource';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Type a resource name';
    searchInput.setAttribute('aria-label', 'Search resources');
    searchLabel.appendChild(searchInput);

    const resourceLabel = document.createElement('label');
    resourceLabel.className = 'find-resources-control';
    resourceLabel.textContent = 'Resource';
    const resourceSelect = document.createElement('select');
    resourceSelect.setAttribute('aria-label', 'Select resource');
    resourceLabel.appendChild(resourceSelect);

    const categoryLabel = document.createElement('label');
    categoryLabel.className = 'find-resources-control';
    categoryLabel.textContent = 'Category';
    const categorySelect = document.createElement('select');
    categorySelect.setAttribute('aria-label', 'Filter by category');
    for (const category of FIND_RESOURCES_CATEGORIES) {
        categorySelect.appendChild(createCategoryOption(category));
    }
    categoryLabel.appendChild(categorySelect);

    resourceControls.appendChild(searchLabel);
    resourceControls.appendChild(resourceLabel);

    const locationControls = document.createElement('div');
    locationControls.className = 'find-resources-controls';
    locationControls.hidden = true;

    const locationSearchLabel = document.createElement('label');
    locationSearchLabel.className = 'find-resources-control';
    locationSearchLabel.textContent = 'Search Location';
    const locationSearchInput = document.createElement('input');
    locationSearchInput.type = 'search';
    locationSearchInput.placeholder = 'Type a system or location';
    locationSearchInput.setAttribute('aria-label', 'Search locations');
    locationSearchLabel.appendChild(locationSearchInput);

    const locationLabel = document.createElement('label');
    locationLabel.className = 'find-resources-control';
    locationLabel.textContent = 'Location';
    const locationSelect = document.createElement('select');
    locationSelect.setAttribute('aria-label', 'Select location');
    locationLabel.appendChild(locationSelect);

    locationControls.appendChild(locationSearchLabel);
    locationControls.appendChild(locationLabel);

    const categoryControls = document.createElement('div');
    categoryControls.className = 'find-resources-controls';
    categoryControls.appendChild(categoryLabel);
    section.appendChild(resourceControls);
    section.appendChild(locationControls);
    section.appendChild(categoryControls);

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'find-resources-results';
    section.appendChild(resultsContainer);

    repopulateResourceSelect(resourceSelect, harvestableSpawnShares, '', state.resourceId);
    repopulateLocationSelect(locationSelect, harvestableSpawnShares, '', state.locationId);
    renderByResourceTable(resultsContainer, harvestableSpawnShares, state);

    function renderCurrentView() {
        byResource.classList.toggle('active', state.view === 'resource');
        byLocation.classList.toggle('active', state.view === 'location');
        resourceControls.hidden = state.view !== 'resource';
        locationControls.hidden = state.view !== 'location';

        if (state.view === 'location') {
            renderByLocationTable(resultsContainer, harvestableSpawnShares, state);
        } else {
            renderByResourceTable(resultsContainer, harvestableSpawnShares, state);
        }
    }

    searchInput.addEventListener('input', () => {
        const options = repopulateResourceSelect(resourceSelect, harvestableSpawnShares, searchInput.value, state.resourceId);
        syncSelectedResourceId(state, resourceSelect, options);
        renderCurrentView();
    });

    resourceSelect.addEventListener('change', (event) => {
        state.resourceId = event.target.value;
        renderCurrentView();
    });

    locationSearchInput.addEventListener('input', () => {
        const options = repopulateLocationSelect(locationSelect, harvestableSpawnShares, locationSearchInput.value, state.locationId);
        syncSelectedLocationId(state, locationSelect, options);
        renderCurrentView();
    });

    locationSelect.addEventListener('change', (event) => {
        state.locationId = event.target.value;
        renderCurrentView();
    });

    categorySelect.addEventListener('change', (event) => {
        state.category = event.target.value;
        renderCurrentView();
    });

    byResource.addEventListener('click', () => {
        state.view = 'resource';
        renderCurrentView();
    });

    byLocation.addEventListener('click', () => {
        state.view = 'location';
        renderCurrentView();
    });

    return section;
}

window.findResourcesView = {
    getResourceOptions,
    getByResourceResults,
    getLocationOptions,
    getByLocationGroups,
    getSourceDetails,
    createFindResourcesSection
};
