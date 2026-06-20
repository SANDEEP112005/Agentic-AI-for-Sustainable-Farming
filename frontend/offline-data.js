// AgriSmart AI - Offline Data Manager
// Handles all offline data storage and sync

class OfflineDataManager {
    constructor() {
        this.dbName = 'AgriSmartDB';
        this.dbVersion = 1;
        this.db = null;
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        
        this.init();
        this.setupNetworkListeners();
    }

    async init() {
        try {
            this.db = await this.openDatabase();
            console.log('✅ Offline database initialized');
            await this.loadOfflineData();
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
        }
    }

    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Crop recommendations store
                if (!db.objectStoreNames.contains('recommendations')) {
                    const recStore = db.createObjectStore('recommendations', { keyPath: 'id', autoIncrement: true });
                    recStore.createIndex('timestamp', 'timestamp', { unique: false });
                    recStore.createIndex('synced', 'synced', { unique: false });
                }

                // Soil data store
                if (!db.objectStoreNames.contains('soilData')) {
                    const soilStore = db.createObjectStore('soilData', { keyPath: 'id', autoIncrement: true });
                    soilStore.createIndex('farmId', 'farmId', { unique: false });
                }

                // Weather cache
                if (!db.objectStoreNames.contains('weatherCache')) {
                    const weatherStore = db.createObjectStore('weatherCache', { keyPath: 'location' });
                    weatherStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // User profile
                if (!db.objectStoreNames.contains('userProfile')) {
                    db.createObjectStore('userProfile', { keyPath: 'id' });
                }

                // Crop database (static data)
                if (!db.objectStoreNames.contains('cropDatabase')) {
                    db.createObjectStore('cropDatabase', { keyPath: 'name' });
                }

                // Pest database (static data)
                if (!db.objectStoreNames.contains('pestDatabase')) {
                    db.createObjectStore('pestDatabase', { keyPath: 'id', autoIncrement: true });
                }

                // Fertilizer database (static data)
                if (!db.objectStoreNames.contains('fertilizerDatabase')) {
                    db.createObjectStore('fertilizerDatabase', { keyPath: 'type' });
                }

                // Sync queue for offline data
                if (!db.objectStoreNames.contains('syncQueue')) {
                    const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
                    syncStore.createIndex('type', 'type', { unique: false });
                }

                // Farm logs
                if (!db.objectStoreNames.contains('farmLogs')) {
                    const logStore = db.createObjectStore('farmLogs', { keyPath: 'id', autoIncrement: true });
                    logStore.createIndex('date', 'date', { unique: false });
                    logStore.createIndex('type', 'type', { unique: false });
                }
            };
        });
    }

    async loadOfflineData() {
        // Pre-load essential farming data for offline use
        const cropData = [
            { name: 'rice', hindi: 'चावल', kannada: 'ಅಕ್ಕಿ', telugu: 'వరి', tamil: 'அரிசி',
              season: ['Kharif'], waterNeeds: 'high', soilType: ['clay', 'loamy'], 
              phRange: [5.5, 6.5], tempRange: [20, 35], rainfall: [1200, 2000],
              growthDays: 120, yield: '4-6 tons/hectare',
              pests: ['Stem Borer', 'Brown Plant Hopper', 'Leaf Folder', 'Gall Midge'],
              diseases: ['Blast', 'Bacterial Blight', 'Sheath Rot'],
              fertilizer: { N: 120, P: 60, K: 40 }
            },
            { name: 'wheat', hindi: 'गेहूं', kannada: 'ಗೋಧಿ', telugu: 'గోధుమ', tamil: 'கோதுமை',
              season: ['Rabi'], waterNeeds: 'medium', soilType: ['loamy', 'clay loam'],
              phRange: [6.0, 7.0], tempRange: [10, 25], rainfall: [350, 600],
              growthDays: 120, yield: '3-5 tons/hectare',
              pests: ['Aphids', 'Termites', 'Pink Stem Borer'],
              diseases: ['Rust', 'Smut', 'Powdery Mildew'],
              fertilizer: { N: 120, P: 60, K: 40 }
            },
            { name: 'corn', hindi: 'मक्का', kannada: 'ಮೆಕ್ಕೆಜೋಳ', telugu: 'మొక్కజొన్న', tamil: 'மக்காச்சோளம்',
              season: ['Kharif', 'Rabi'], waterNeeds: 'medium', soilType: ['loamy', 'sandy loam'],
              phRange: [5.8, 7.0], tempRange: [21, 30], rainfall: [600, 1200],
              growthDays: 100, yield: '5-8 tons/hectare',
              pests: ['Stem Borer', 'Fall Armyworm', 'Aphids'],
              diseases: ['Northern Blight', 'Southern Blight', 'Downy Mildew'],
              fertilizer: { N: 150, P: 75, K: 50 }
            },
            { name: 'cotton', hindi: 'कपास', kannada: 'ಹತ್ತಿ', telugu: 'పత్తి', tamil: 'பருத்தி',
              season: ['Kharif'], waterNeeds: 'medium', soilType: ['black', 'alluvial'],
              phRange: [6.0, 8.0], tempRange: [21, 35], rainfall: [500, 1000],
              growthDays: 180, yield: '1.5-2.5 tons/hectare',
              pests: ['Bollworm', 'Whitefly', 'Aphids', 'Jassids'],
              diseases: ['Wilt', 'Root Rot', 'Leaf Curl'],
              fertilizer: { N: 100, P: 50, K: 50 }
            },
            { name: 'tomato', hindi: 'टमाटर', kannada: 'ಟೊಮೆಟೊ', telugu: 'టమాటా', tamil: 'தக்காளி',
              season: ['All'], waterNeeds: 'medium', soilType: ['sandy loam', 'loamy'],
              phRange: [6.0, 6.8], tempRange: [18, 30], rainfall: [400, 600],
              growthDays: 90, yield: '20-30 tons/hectare',
              pests: ['Fruit Borer', 'Whitefly', 'Leaf Miner', 'Thrips'],
              diseases: ['Early Blight', 'Late Blight', 'Bacterial Wilt'],
              fertilizer: { N: 120, P: 80, K: 80 }
            },
            { name: 'potato', hindi: 'आलू', kannada: 'ಆಲೂಗಡ್ಡೆ', telugu: 'బంగాళాదుంప', tamil: 'உருளைக்கிழங்கு',
              season: ['Rabi'], waterNeeds: 'medium', soilType: ['sandy loam'],
              phRange: [5.0, 6.5], tempRange: [15, 25], rainfall: [300, 500],
              growthDays: 90, yield: '20-25 tons/hectare',
              pests: ['Aphids', 'Tuber Moth', 'Cutworm'],
              diseases: ['Late Blight', 'Early Blight', 'Black Scurf'],
              fertilizer: { N: 150, P: 100, K: 120 }
            },
            { name: 'sugarcane', hindi: 'गन्ना', kannada: 'ಕಬ್ಬು', telugu: 'చెరకు', tamil: 'கரும்பு',
              season: ['All'], waterNeeds: 'high', soilType: ['loamy', 'clay loam'],
              phRange: [6.0, 7.5], tempRange: [20, 35], rainfall: [1500, 2500],
              growthDays: 365, yield: '70-100 tons/hectare',
              pests: ['Early Shoot Borer', 'Top Borer', 'Internode Borer'],
              diseases: ['Red Rot', 'Smut', 'Wilt'],
              fertilizer: { N: 250, P: 125, K: 125 }
            },
            { name: 'soybean', hindi: 'सोयाबीन', kannada: 'ಸೋಯಾ', telugu: 'సోయా', tamil: 'சோயா',
              season: ['Kharif'], waterNeeds: 'medium', soilType: ['loamy', 'clay loam'],
              phRange: [6.0, 7.0], tempRange: [20, 30], rainfall: [600, 1000],
              growthDays: 100, yield: '2-3 tons/hectare',
              pests: ['Stem Fly', 'Pod Borer', 'Whitefly'],
              diseases: ['Yellow Mosaic', 'Anthracnose', 'Bacterial Pustule'],
              fertilizer: { N: 25, P: 75, K: 40 }
            },
            { name: 'onion', hindi: 'प्याज', kannada: 'ಈರುಳ್ಳಿ', telugu: 'ఉల్లి', tamil: 'வெங்காயம்',
              season: ['Rabi', 'Kharif'], waterNeeds: 'medium', soilType: ['sandy loam', 'loamy'],
              phRange: [6.0, 7.0], tempRange: [13, 24], rainfall: [350, 550],
              growthDays: 120, yield: '15-25 tons/hectare',
              pests: ['Thrips', 'Onion Fly', 'Mites'],
              diseases: ['Purple Blotch', 'Downy Mildew', 'Basal Rot'],
              fertilizer: { N: 110, P: 40, K: 60 }
            },
            { name: 'groundnut', hindi: 'मूंगफली', kannada: 'ಕಡಲೆಕಾಯಿ', telugu: 'వేరుశెనగ', tamil: 'நிலக்கடலை',
              season: ['Kharif', 'Rabi'], waterNeeds: 'low-medium', soilType: ['sandy loam'],
              phRange: [6.0, 6.5], tempRange: [25, 30], rainfall: [500, 1000],
              growthDays: 120, yield: '1.5-2 tons/hectare',
              pests: ['Aphids', 'Leaf Miner', 'White Grub'],
              diseases: ['Tikka', 'Collar Rot', 'Rust'],
              fertilizer: { N: 20, P: 40, K: 40 }
            }
        ];

        // Store crop data
        const transaction = this.db.transaction(['cropDatabase'], 'readwrite');
        const store = transaction.objectStore('cropDatabase');
        
        for (const crop of cropData) {
            store.put(crop);
        }

        // Load fertilizer data
        const fertilizerData = [
            { type: 'urea', n: 46, p: 0, k: 0, usage: 'Nitrogen source, apply in splits', price: '₹300/50kg' },
            { type: 'dap', n: 18, p: 46, k: 0, usage: 'Basal application, phosphorus source', price: '₹1350/50kg' },
            { type: 'mop', n: 0, p: 0, k: 60, usage: 'Potassium source, basal + topdress', price: '₹850/50kg' },
            { type: 'npk', n: 10, p: 26, k: 26, usage: 'Complex fertilizer, basal application', price: '₹1100/50kg' },
            { type: 'ssp', n: 0, p: 16, k: 0, usage: 'Single Super Phosphate, slow release', price: '₹400/50kg' },
            { type: 'ammonium_sulfate', n: 21, p: 0, k: 0, usage: 'Nitrogen + Sulfur, acidifying', price: '₹350/50kg' },
            { type: 'potash', n: 0, p: 0, k: 50, usage: 'Sulfate of Potash, premium quality', price: '₹1200/50kg' }
        ];

        const fertTransaction = this.db.transaction(['fertilizerDatabase'], 'readwrite');
        const fertStore = fertTransaction.objectStore('fertilizerDatabase');
        
        for (const fert of fertilizerData) {
            fertStore.put(fert);
        }

        console.log('✅ Offline farming data loaded');
    }

    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 Back online');
            showNotification('Internet connected! Syncing data...', 'success');
            this.syncData();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📴 Gone offline');
            showNotification('No internet. Working offline.', 'warning');
        });
    }

    // Save recommendation to offline storage
    async saveRecommendation(data) {
        const transaction = this.db.transaction(['recommendations'], 'readwrite');
        const store = transaction.objectStore('recommendations');
        
        const record = {
            ...data,
            timestamp: new Date().toISOString(),
            synced: false
        };
        
        const id = await new Promise((resolve, reject) => {
            const request = store.add(record);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        // Add to sync queue if offline
        if (!this.isOnline) {
            await this.addToSyncQueue('recommendation', { id, ...record });
        }

        return id;
    }

    // Save soil data
    async saveSoilData(data) {
        const transaction = this.db.transaction(['soilData'], 'readwrite');
        const store = transaction.objectStore('soilData');
        
        const record = {
            ...data,
            timestamp: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.add(record);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Cache weather data
    async cacheWeatherData(location, data) {
        const transaction = this.db.transaction(['weatherCache'], 'readwrite');
        const store = transaction.objectStore('weatherCache');
        
        const record = {
            location,
            data,
            timestamp: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.put(record);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Get cached weather data
    async getCachedWeather(location) {
        const transaction = this.db.transaction(['weatherCache'], 'readonly');
        const store = transaction.objectStore('weatherCache');
        
        return new Promise((resolve, reject) => {
            const request = store.get(location);
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    // Check if cache is less than 3 hours old
                    const cacheAge = Date.now() - new Date(result.timestamp).getTime();
                    if (cacheAge < 3 * 60 * 60 * 1000) {
                        resolve(result.data);
                        return;
                    }
                }
                resolve(null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Get crop data for offline use
    async getCropData(cropName) {
        const transaction = this.db.transaction(['cropDatabase'], 'readonly');
        const store = transaction.objectStore('cropDatabase');
        
        return new Promise((resolve, reject) => {
            const request = store.get(cropName.toLowerCase());
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Get all crops
    async getAllCrops() {
        const transaction = this.db.transaction(['cropDatabase'], 'readonly');
        const store = transaction.objectStore('cropDatabase');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Save farm log
    async saveFarmLog(logType, details) {
        const transaction = this.db.transaction(['farmLogs'], 'readwrite');
        const store = transaction.objectStore('farmLogs');
        
        const record = {
            type: logType,
            details,
            date: new Date().toISOString(),
            synced: false
        };
        
        return new Promise((resolve, reject) => {
            const request = store.add(record);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Add to sync queue
    async addToSyncQueue(type, data) {
        const transaction = this.db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');
        
        return new Promise((resolve, reject) => {
            const request = store.add({ type, data, timestamp: new Date().toISOString() });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Sync all pending data
    async syncData() {
        if (!this.isOnline) return;

        const transaction = this.db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');
        
        const items = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        for (const item of items) {
            try {
                // Attempt to sync with server
                const response = await fetch(`${API_BASE_URL}/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                });

                if (response.ok) {
                    // Remove from sync queue
                    store.delete(item.id);
                    console.log('✅ Synced:', item.type);
                }
            } catch (error) {
                console.warn('Sync failed for:', item.type);
            }
        }
    }

    // Save user profile
    async saveProfile(profile) {
        const transaction = this.db.transaction(['userProfile'], 'readwrite');
        const store = transaction.objectStore('userProfile');
        
        return new Promise((resolve, reject) => {
            const request = store.put({ id: 'main', ...profile });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Get user profile
    async getProfile() {
        const transaction = this.db.transaction(['userProfile'], 'readonly');
        const store = transaction.objectStore('userProfile');
        
        return new Promise((resolve, reject) => {
            const request = store.get('main');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Get offline recommendation (when no internet)
    async getOfflineRecommendation(soilData) {
        const crops = await this.getAllCrops();
        
        // Simple offline recommendation algorithm
        const recommendations = crops.map(crop => {
            let score = 0;
            
            // pH match
            if (soilData.ph >= crop.phRange[0] && soilData.ph <= crop.phRange[1]) {
                score += 30;
            } else {
                const phDiff = Math.min(
                    Math.abs(soilData.ph - crop.phRange[0]),
                    Math.abs(soilData.ph - crop.phRange[1])
                );
                score += Math.max(0, 30 - phDiff * 10);
            }
            
            // Temperature match
            if (soilData.temperature >= crop.tempRange[0] && soilData.temperature <= crop.tempRange[1]) {
                score += 25;
            }
            
            // Soil type match
            if (crop.soilType.includes(soilData.soilType?.toLowerCase())) {
                score += 20;
            }
            
            // Water availability match
            const waterMap = { low: 1, medium: 2, high: 3 };
            const cropWater = waterMap[crop.waterNeeds] || 2;
            const availableWater = waterMap[soilData.waterAvailability] || 2;
            if (cropWater <= availableWater) {
                score += 15;
            }
            
            // Season match
            const currentMonth = new Date().getMonth();
            const isKharif = currentMonth >= 5 && currentMonth <= 9;
            const isRabi = currentMonth >= 10 || currentMonth <= 2;
            
            if ((isKharif && crop.season.includes('Kharif')) ||
                (isRabi && crop.season.includes('Rabi')) ||
                crop.season.includes('All')) {
                score += 10;
            }
            
            return { crop: crop.name, score, details: crop };
        });
        
        // Sort by score
        recommendations.sort((a, b) => b.score - a.score);
        
        return recommendations.slice(0, 5);
    }
}

// Export
window.OfflineDataManager = OfflineDataManager;
window.offlineDB = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.offlineDB = new OfflineDataManager();
});
// Removed: Migrated to farm-growth-hub
