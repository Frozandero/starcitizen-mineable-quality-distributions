// Loads and normalizes Viewer Data Bundles for the Published Viewer.

async function loadOptionalViewerDataFile(versionId, fileName, cacheKey, fallbackValue = null) {
    try {
        return await window.cacheUtils.loadDataWithCache(`./data/${versionId}/${fileName}`, cacheKey);
    } catch (error) {
        const message = String(error?.message || error);
        if (!message.includes('404')) {
            console.warn(`Optional Viewer Data file could not be loaded: ${fileName}`, error);
        }
        return fallbackValue;
    }
}

function normalizeQualityDistributions(qualityData) {
    return {
        qualityDistributions: qualityData.categories || qualityData,
        rockCrackerDistributions: qualityData.rockCrackerDistributions || null
    };
}

async function loadViewerDataBundle(versionId) {
    const [qualityData, rockCompositions, qualityQuantization] = await Promise.all([
        window.cacheUtils.loadDataWithCache(`./data/${versionId}/quality_distributions.json`, `${versionId}_quality`),
        window.cacheUtils.loadDataWithCache(`./data/${versionId}/rock_compositions.json`, `${versionId}_rock`),
        loadOptionalViewerDataFile(
            versionId,
            'quality_quantization.json',
            `${versionId}_quality_quantization`,
            null
        )
    ]);

    const normalizedQuality = normalizeQualityDistributions(qualityData);

    return {
        versionId,
        qualityDistributions: normalizedQuality.qualityDistributions,
        rockCrackerDistributions: normalizedQuality.rockCrackerDistributions,
        rockCompositions,
        qualityQuantization
    };
}

async function loadViewerDataComparison(versionIdA, versionIdB) {
    const [bundleA, bundleB] = await Promise.all([
        loadViewerDataBundle(versionIdA),
        loadViewerDataBundle(versionIdB)
    ]);

    return { bundleA, bundleB };
}

window.viewerDataLoader = {
    loadViewerDataBundle,
    loadViewerDataComparison
};
