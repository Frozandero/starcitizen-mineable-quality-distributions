// LocalStorage caching utilities with build-based invalidation

const CACHE_PREFIX = 'sc_quality_distro_';
const BUILD_NONCE_KEY = 'build_nonce';
const BUILD_INFO_KEY = 'build_info';
let buildInfoPromise = null;

// Get the current build nonce from the HTML
function getBuildNonce() {
    return window.BUILD_NONCE || null;
}

function getVersionedFetchUrl(fetchUrl, buildNonce = getBuildNonce()) {
    const separator = fetchUrl.includes('?') ? '&' : '?';
    return buildNonce ? `${fetchUrl}${separator}v=${encodeURIComponent(buildNonce)}` : fetchUrl;
}

async function getLatestBuildInfo() {
    const response = await fetch(`./build.json?ts=${Date.now()}`, {
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch build.json: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

async function ensureFreshBuildInfo() {
    if (!buildInfoPromise) {
        buildInfoPromise = (async () => {
            try {
                const latestBuildInfo = await getLatestBuildInfo();
                const cachedBuildInfoRaw = localStorage.getItem(CACHE_PREFIX + BUILD_INFO_KEY);
                const cachedBuildInfo = cachedBuildInfoRaw ? JSON.parse(cachedBuildInfoRaw) : null;

                if (!cachedBuildInfo || cachedBuildInfo.nonce !== latestBuildInfo.nonce) {
                    clearCache();
                    localStorage.setItem(CACHE_PREFIX + BUILD_INFO_KEY, JSON.stringify(latestBuildInfo));
                    localStorage.setItem(CACHE_PREFIX + BUILD_NONCE_KEY, latestBuildInfo.nonce);
                }

                return latestBuildInfo;
            } catch (error) {
                console.warn('Unable to refresh build metadata, falling back to inline nonce.', error);
                return {
                    nonce: getBuildNonce()
                };
            } finally {
                buildInfoPromise = null;
            }
        })();
    }

    return buildInfoPromise;
}

// Check if cached data is valid
function isCacheValid() {
    const cachedNonce = localStorage.getItem(CACHE_PREFIX + BUILD_NONCE_KEY);
    const currentNonce = getBuildNonce();
    return !currentNonce || cachedNonce === currentNonce;
}

// Save build nonce
function saveBuildNonce(buildNonce = getBuildNonce()) {
    if (buildNonce) {
        localStorage.setItem(CACHE_PREFIX + BUILD_NONCE_KEY, buildNonce);
    }
}

// Get cached data for a specific key
function getCachedData(key) {
    if (!isCacheValid()) {
        return null;
    }

    try {
        const data = localStorage.getItem(CACHE_PREFIX + key);
        if (data) {
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading from cache:', error);
    }

    return null;
}

// Save data to cache
function setCachedData(key, data, buildNonce = getBuildNonce()) {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
        saveBuildNonce(buildNonce);
    } catch (error) {
        console.error('Error saving to cache:', error);
        // If storage is full, try to clear old cache entries
        if (error.name === 'QuotaExceededError') {
            clearCache();
            try {
                localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
                saveBuildNonce(buildNonce);
            } catch (retryError) {
                console.error('Failed to save to cache even after cleanup:', retryError);
            }
        }
    }
}

// Clear all cache entries
function clearCache() {
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
}

// Get cache size (in bytes)
function getCacheSize() {
    let size = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
            size += (localStorage.getItem(key) || '').length + key.length;
        }
    }
    return size;
}

// Format cache size for display
function formatCacheSize(bytes) {
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) {
        return `${mb.toFixed(2)} MB`;
    }
    return `${kb.toFixed(2)} KB`;
}

// Log cache statistics
function logCacheStats() {
    const cacheSize = getCacheSize();
    const buildNonce = getBuildNonce();
    const isValid = isCacheValid();
    const buildInfo = localStorage.getItem(CACHE_PREFIX + BUILD_INFO_KEY);
    
    console.log('=== Cache Statistics ===');
    console.log(`Cache size: ${formatCacheSize(cacheSize)}`);
    console.log(`Build nonce: ${buildNonce}`);
    console.log(`Stored build info: ${buildInfo || 'none'}`);
    console.log(`Cache valid: ${isValid}`);
    console.log(`Storage available: ${formatCacheSize(5 * 1024 * 1024 - cacheSize)} (approx)`);
}

// Load data with cache fallback
async function loadDataWithCache(fetchUrl, cacheKey) {
    const latestBuildInfo = await ensureFreshBuildInfo();
    const effectiveNonce = latestBuildInfo?.nonce || getBuildNonce();
    const effectiveCacheKey = effectiveNonce ? `${cacheKey}_${effectiveNonce}` : cacheKey;

    // Try to get from cache first
    const cachedData = getCachedData(effectiveCacheKey);
    if (cachedData) {
        return cachedData;
    }

    // Fetch from network
    const versionedFetchUrl = getVersionedFetchUrl(fetchUrl, effectiveNonce);
    console.log(`Fetching from network: ${versionedFetchUrl}`);
    const response = await fetch(versionedFetchUrl, {
        cache: 'no-store'
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch ${fetchUrl}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Cache the response
    setCachedData(effectiveCacheKey, data, effectiveNonce);
    
    return data;
}

// Preload and cache multiple data files
async function preloadCache(versionId) {
    try {
        const [qualityData, rockData] = await Promise.all([
            loadDataWithCache(`./data/${versionId}/quality_distributions.json`, `${versionId}_quality`),
            loadDataWithCache(`./data/${versionId}/rock_compositions.json`, `${versionId}_rock`)
        ]);

        return { qualityData, rockData };
    } catch (error) {
        console.error('Error preloading cache:', error);
        throw error;
    }
}

// Export functions for use in other modules
window.cacheUtils = {
    getBuildNonce,
    isCacheValid,
    getCachedData,
    setCachedData,
    clearCache,
    getCacheSize,
    formatCacheSize,
    logCacheStats,
    loadDataWithCache,
    preloadCache,
    ensureFreshBuildInfo
};
