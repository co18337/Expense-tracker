/**
 * Configuration Constants
 * Phase 0: Frontend settings and constants
 */

const CONFIG = {
    // API Configuration
    API_BASE_URL: 'http://localhost:5000/api',

    // App Info
    APP_NAME: 'ExpenseAI',
    APP_VERSION: '0.1.0',

    // Token Keys
    TOKEN_KEY: 'access_token',
    REFRESH_TOKEN_KEY: 'refresh_token',
    USER_KEY: 'current_user',
    REMEMBER_ME_KEY: 'remember_me',

    // Auto-refresh interval (10 minutes)
    TOKEN_REFRESH_INTERVAL: 10 * 60 * 1000,

    // Password Requirements
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_REQUIREMENTS: {
        uppercase: true,      // Require A-Z
        lowercase: true,      // Require a-z
        numbers: true,        // Require 0-9
        special: false        // Optional: special chars
    },

    // Email Validation
    EMAIL_MIN_LENGTH: 5,
    EMAIL_MAX_LENGTH: 120,

    // Token Expiry
    ACCESS_TOKEN_EXPIRY_MINUTES: 15,
    REFRESH_TOKEN_EXPIRY_DAYS: 7,
    RESET_TOKEN_EXPIRY_HOURS: 1,

    // Remember Me Duration
    REMEMBER_ME_DAYS: 30,

    // API Error Messages
    ERRORS: {
        NETWORK_ERROR: 'Network error. Please check your connection.',
        INVALID_EMAIL: 'Please enter a valid email address.',
        WEAK_PASSWORD: 'Password must be at least 8 characters with uppercase, lowercase, and number.',
        PASSWORD_MISMATCH: 'Passwords do not match.',
        EMAIL_REQUIRED: 'Email is required.',
        PASSWORD_REQUIRED: 'Password is required.',
        SESSION_EXPIRED: 'Your session has expired. Please login again.',
        UNAUTHORIZED: 'You are not authorized to access this resource.',
        UNKNOWN_ERROR: 'An unknown error occurred. Please try again.'
    },

    // Routes
    ROUTES: {
        LOGIN: '/login.html',
        DASHBOARD: '/index.html',
        RESET_PASSWORD: '/reset.html'
    }
};

// Validate that required config values exist
console.log('[Config] Loaded:', {
    api_url: CONFIG.API_BASE_URL,
    app_name: CONFIG.APP_NAME,
    app_version: CONFIG.APP_VERSION
});
