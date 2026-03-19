// LocalStorage caching utilities with build-based invalidation

const CACHE_PREFIX = 'sc_quality_distro_';
const BUILD_NONCE_KEY = 'build_nonce';

// Get the current build nonce from the HTML
function getBuildNonce() {
    return window.BUILD_NONCE || null;
}

// Check if cached data is valid
function isCacheValid() {
    const cachedNonce = localStorage.getItem(CACHE_PREFIX + BUILD_NONCE_KEY);
    const currentNonce = getBuildNonce();
    return cachedNonce === currentNonce;
}

// Save build nonce
function saveBuildNonce() {
    const currentNonce = getBuildNonce();
    if (currentNonce) {
        localStorage.setItem(CACHE_PREFIX + BUILD_NONCE_KEY, currentNonce);
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
function setCachedData(key, data) {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
        saveBuildNonce();
    } catch (error) {
        console.error('Error saving to cache:', error);
        // If storage is full, try to clear old cache entries
        if (error.name === 'QuotaExceededError') {
            clearCache();
            try {
                localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
                saveBuildNonce();
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
    
    console.log('=== Cache Statistics ===');
    console.log(`Cache size: ${formatCacheSize(cacheSize)}`);
    console.log(`Build nonce: ${buildNonce}`);
    console.log(`Cache valid: ${isValid}`);
    console.log(`Storage available: ${formatCacheSize(5 * 1024 * 1024 - cacheSize)} (approx)`);
}

// Load data with cache fallback
async function loadDataWithCache(fetchUrl, cacheKey) {
    // Try to get from cache first
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    // Fetch from network
    console.log(`Fetching from network: ${fetchUrl}`);
    const response = await fetch(fetchUrl);
    
    if (!response.ok) {
        throw new Error(`Failed to fetch ${fetchUrl}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Cache the response
    setCachedData(cacheKey, data);
    
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
    preloadCache
};
