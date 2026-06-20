// AgriSmart AI - Service Worker for Offline Support
// Version: 8.0.0 - Production UI Overhaul: Auth, Header, Footer, Sidebar, Animations

const CACHE_NAME = 'agrismart-v8.0.0';
const OFFLINE_URL = './index.html';

// Files to cache for offline use
const STATIC_ASSETS = [
    './',
    './index.html',
    './styles_modern.css',
    './mobile-styles.css',
    './voice-styles.css',
    './app.js',
    './config.js',
    './manifest.json',
    './icons/icon.svg'
];

// Offline farming data (embedded in service worker)
const OFFLINE_FARMING_DATA = {
    crops: {
        rice: { seasons: ['Kharif', 'Rabi'], water: 'High', soil: 'Clay/Loamy', pH: '5.5-6.5' },
        wheat: { seasons: ['Rabi'], water: 'Medium', soil: 'Loamy', pH: '6.0-7.0' },
        corn: { seasons: ['Kharif'], water: 'Medium', soil: 'Loamy', pH: '5.8-7.0' },
        cotton: { seasons: ['Kharif'], water: 'Medium', soil: 'Black/Alluvial', pH: '6.0-8.0' },
        tomato: { seasons: ['All'], water: 'Medium', soil: 'Sandy Loam', pH: '6.0-6.8' },
        potato: { seasons: ['Rabi'], water: 'Medium', soil: 'Sandy Loam', pH: '5.0-6.5' },
        sugarcane: { seasons: ['All'], water: 'High', soil: 'Loamy', pH: '6.0-7.5' },
        soybean: { seasons: ['Kharif'], water: 'Medium', soil: 'Loamy', pH: '6.0-7.0' }
    },
    pests: {
        rice: ['Stem Borer', 'Brown Plant Hopper', 'Leaf Folder'],
        wheat: ['Aphids', 'Termites', 'Rust'],
        cotton: ['Bollworm', 'Whitefly', 'Aphids'],
        tomato: ['Fruit Borer', 'Whitefly', 'Leaf Miner']
    },
    fertilizers: {
        nitrogen: { sources: ['Urea', 'Ammonium Sulfate'], timing: 'Split application' },
        phosphorus: { sources: ['DAP', 'SSP'], timing: 'Basal application' },
        potassium: { sources: ['MOP', 'SOP'], timing: 'Basal + Top dressing' }
    },
    weather_tips: {
        rain: 'Avoid fertilizer application before heavy rain. Ensure drainage.',
        drought: 'Increase mulching, reduce plant density, irrigate early morning.',
        frost: 'Cover young plants, irrigate before frost night, use smoke pots.',
        heatwave: 'Increase irrigation frequency, provide shade, mulch heavily.'
    }
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Caching static assets');
                // Cache local assets first
                const localAssets = STATIC_ASSETS.filter(url => !url.startsWith('http'));
                return cache.addAll(localAssets).catch(err => {
                    console.warn('[ServiceWorker] Some assets failed to cache:', err);
                });
            })
            .then(() => {
                // Store offline farming data
                return caches.open(CACHE_NAME + '-data').then(cache => {
                    const dataResponse = new Response(JSON.stringify(OFFLINE_FARMING_DATA), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                    return cache.put('./offline-farming-data.json', dataResponse);
                });
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('agrismart-') && name !== CACHE_NAME && name !== CACHE_NAME + '-data')
                    .map((name) => {
                        console.log('[ServiceWorker] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Handle API requests differently
    if (url.pathname.startsWith('/api/') || url.port === '8001') {
        event.respondWith(handleApiRequest(request));
        return;
    }

    // For navigation requests, try network first, then cache
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(() => caches.match(request))
                .catch(() => caches.match(OFFLINE_URL))
        );
        return;
    }

    // Skip non-GET requests (POST, PUT, etc. cannot be cached)
    if (request.method !== 'GET') {
        event.respondWith(fetch(request).catch(() => new Response('Offline', { status: 503 })));
        return;
    }

    // For static assets — network first, then cache
    event.respondWith(
        fetch(request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    if (request.headers.get('Accept')?.includes('text/html')) {
                        return caches.match(OFFLINE_URL);
                    }
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});

// Handle API requests with offline support
async function handleApiRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache successful API responses (only GET requests)
        if (networkResponse.ok && request.method === 'GET') {
            const cache = await caches.open(CACHE_NAME + '-api');
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[ServiceWorker] Network failed, trying cache for:', request.url);
        
        // Try cached API response
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline farming data for specific endpoints
        const url = new URL(request.url);
        if (url.pathname.includes('recommendation') || url.pathname.includes('crop')) {
            return getOfflineCropRecommendation(request);
        }
        if (url.pathname.includes('weather')) {
            return getOfflineWeatherData();
        }
        if (url.pathname.includes('pest')) {
            return getOfflinePestData(request);
        }
        
        // Generic offline response
        return new Response(JSON.stringify({
            offline: true,
            message: 'You are offline. Limited data available.',
            data: OFFLINE_FARMING_DATA
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Offline crop recommendation
async function getOfflineCropRecommendation(request) {
    const cache = await caches.open(CACHE_NAME + '-data');
    const dataResponse = await cache.match('./offline-farming-data.json');
    const data = dataResponse ? await dataResponse.json() : OFFLINE_FARMING_DATA;
    
    return new Response(JSON.stringify({
        offline: true,
        recommendation: 'Based on offline data',
        crops: Object.keys(data.crops),
        details: data.crops,
        message: 'Showing cached recommendations. Connect to internet for AI-powered analysis.'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// Offline weather data
function getOfflineWeatherData() {
    return new Response(JSON.stringify({
        offline: true,
        tips: OFFLINE_FARMING_DATA.weather_tips,
        message: 'Weather data requires internet. Here are general weather tips for farming.',
        general_advice: 'Monitor local weather signs: cloud patterns, wind direction, humidity feel.'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// Offline pest data
async function getOfflinePestData(request) {
    return new Response(JSON.stringify({
        offline: true,
        pests: OFFLINE_FARMING_DATA.pests,
        message: 'Showing common pests for major crops. Connect to internet for detailed analysis.'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// Background sync for offline data
self.addEventListener('sync', (event) => {
    console.log('[ServiceWorker] Background sync:', event.tag);
    if (event.tag === 'sync-farm-data') {
        event.waitUntil(syncFarmData());
    }
});

async function syncFarmData() {
    try {
        const cache = await caches.open(CACHE_NAME + '-pending');
        const requests = await cache.keys();
        
        for (const request of requests) {
            const response = await cache.match(request);
            const data = await response.json();
            
            // Try to sync with server
            try {
                await fetch(request.url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                // Remove from pending cache
                await cache.delete(request);
                console.log('[ServiceWorker] Synced:', request.url);
            } catch (err) {
                console.log('[ServiceWorker] Sync failed, will retry:', request.url);
            }
        }
    } catch (error) {
        console.error('[ServiceWorker] Sync error:', error);
    }
}

// Push notifications for weather alerts
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || '🌾 AgriSmart Alert';
    const options = {
        body: data.body || 'New farming update available',
        icon: './icons/icon.svg',
        badge: './icons/icon.svg',
        vibrate: [200, 100, 200],
        tag: data.tag || 'agrismart-notification',
        requireInteraction: true,
        actions: [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };
    
    event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(clients.openWindow('./'));
    }
});

console.log('[ServiceWorker] Script loaded v3.0');
// Removed: Migrated to farm-growth-hub
