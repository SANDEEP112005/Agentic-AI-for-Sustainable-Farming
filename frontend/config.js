// AgriSmart AI Configuration
// This file handles API configuration for both web and mobile

const AppConfig = {
    // API Configuration - Auto-detect environment
    getApiUrl: function() {
        console.log('🔍 Detecting platform...');
        
        // Check if running in Capacitor (mobile app)
        if (typeof Capacitor !== 'undefined') {
            console.log('📱 Capacitor detected - using deployed server');
            return 'https://agrismart-api-m8nz.onrender.com';
        }
        
        // Check if running on localhost
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('💻 Localhost detected');
            return 'http://127.0.0.1:8001';
        }
        
        // For deployed web version — served from same origin (Render)
        console.log('🌐 Web deployment detected — using same origin');
        return window.location.origin;
    },
    
    // Check if running as mobile app
    isMobileApp: function() {
        return typeof Capacitor !== 'undefined';
    },
    
    // Check network status
    isOnline: function() {
        return navigator.onLine;
    },
    
    // App version
    version: '2.2.0',
    
    // Feature flags
    features: {
        offlineMode: true,
        voiceSupport: true,
        pushNotifications: true,
        cameraSupport: true,
        authEnabled: true
    },
    
    // Cache settings (in milliseconds)
    cache: {
        weatherTTL: 30 * 60 * 1000, // 30 minutes
        cropDataTTL: 24 * 60 * 60 * 1000, // 24 hours
        marketDataTTL: 60 * 60 * 1000, // 1 hour
        translationTTL: 7 * 24 * 60 * 60 * 1000 // 7 days
    },
    
    // Default user settings
    defaults: {
        language: 'hi',
        units: 'metric',
        notifications: true
    },
    
    // Offline data defaults
    offlineDefaults: {
        crops: ['Rice', 'Wheat', 'Cotton', 'Sugarcane', 'Corn', 'Soybean', 'Groundnut'],
        soilTypes: ['Loamy', 'Clay', 'Sandy', 'Silt', 'Peat', 'Chalky', 'Black'],
        states: ['Karnataka', 'Maharashtra', 'Tamil Nadu', 'Andhra Pradesh', 'Gujarat', 'Punjab', 'Haryana', 'Uttar Pradesh', 'Madhya Pradesh', 'Rajasthan']
    }
};

// Make API_BASE globally available
window.API_BASE = AppConfig.getApiUrl();
console.log('🚀 API Base URL:', window.API_BASE);

// Export for use
window.AppConfig = AppConfig;
// Removed: Migrated to farm-growth-hub
