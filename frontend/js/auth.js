/**
 * AuthManager - Frontend Authentication
 * Phase 0: Handles all authentication logic on client side
 * 
 * Responsibilities:
 * - Store/retrieve JWT tokens in localStorage
 * - Login and registration
 * - Automatic token refresh
 * - Token validation
 * - Auto-logout on token expiry
 */

class AuthManager {
    constructor() {
        // Token configuration
        this.accessTokenKey = 'access_token';
        this.refreshTokenKey = 'refresh_token';
        this.userKey = 'current_user';
        this.rememberMeKey = 'remember_me';
        
        // Auto-refresh interval (check every 10 minutes)
        this.refreshInterval = 10 * 60 * 1000;
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize auth manager
     * - Check if user is already logged in
     * - Setup auto-refresh
     */
    init() {
        console.log('[Auth] Initializing...');
        
        if (this.isLoggedIn()) {
            console.log('[Auth] User logged in:', this.getCurrentUser().email);
            this.setupTokenRefreshInterval();
        } else {
            console.log('[Auth] No active session');
        }
    }
    
    /**
     * Register new user
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {string} passwordConfirm - Password confirmation
     * @returns {Promise} Response from backend
     */
    async register(email, password, passwordConfirm) {
        console.log('[Auth] Register attempt:', email);
        
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    password: password,
                    password_confirm: passwordConfirm
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }
            
            // Store tokens and user info
            this.storeTokens(data.access_token, data.refresh_token);
            this.storeUserInfo(data.email, data.user_id);
            
            console.log('[Auth] Registration successful');
            return data;
        } catch (error) {
            console.error('[Auth] Registration error:', error);
            throw error;
        }
    }
    
    /**
     * Login user
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {boolean} rememberMe - Whether to keep logged in for 30 days
     * @returns {Promise} Response from backend
     */
    async login(email, password, rememberMe = false) {
        console.log('[Auth] Login attempt:', email);
        
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    password: password
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }
            
            // Store tokens and user info
            this.storeTokens(data.access_token, data.refresh_token);
            this.storeUserInfo(data.email, data.user_id);
            
            // Store remember me preference
            if (rememberMe) {
                localStorage.setItem(this.rememberMeKey, 'true');
                console.log('[Auth] Remember me enabled (30 days)');
            }
            
            // Setup auto-refresh
            this.setupTokenRefreshInterval();
            
            console.log('[Auth] Login successful');
            return data;
        } catch (error) {
            console.error('[Auth] Login error:', error);
            throw error;
        }
    }
    
    /**
     * Logout user
     * - Clear tokens from localStorage
     * - Clear user info
     * - Stop auto-refresh
     */
    logout() {
        console.log('[Auth] Logout');
        
        // Clear tokens
        localStorage.removeItem(this.accessTokenKey);
        localStorage.removeItem(this.refreshTokenKey);
        localStorage.removeItem(this.userKey);
        localStorage.removeItem(this.rememberMeKey);
        
        // Stop auto-refresh interval
        if (this.refreshIntervalId) {
            clearInterval(this.refreshIntervalId);
        }
        
        console.log('[Auth] Tokens cleared, user logged out');
    }
    
    /**
     * Request password reset
     * @param {string} email - User email
     * @returns {Promise} Response from backend
     */
    async requestPasswordReset(email) {
        console.log('[Auth] Password reset request:', email);
        
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email.trim().toLowerCase()
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Password reset request failed');
            }
            
            console.log('[Auth] Password reset email sent');
            return data;
        } catch (error) {
            console.error('[Auth] Password reset error:', error);
            throw error;
        }
    }
    
    /**
     * Reset password with token from email
     * @param {string} token - Reset token from email
     * @param {string} password - New password
     * @param {string} passwordConfirm - Password confirmation
     * @returns {Promise} Response from backend
     */
    async resetPassword(token, password, passwordConfirm) {
        console.log('[Auth] Password reset with token');
        
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/auth/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: token,
                    password: password,
                    password_confirm: passwordConfirm
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Password reset failed');
            }
            
            console.log('[Auth] Password reset successful');
            return data;
        } catch (error) {
            console.error('[Auth] Password reset error:', error);
            throw error;
        }
    }
    
    /**
     * Refresh access token
     * Called when access token expires (15 min)
     * Uses refresh token (7 days) to get new access token
     * @returns {Promise<string>} New access token
     */
    async refreshAccessToken() {
        console.log('[Auth] Refreshing access token...');
        
        const refreshToken = localStorage.getItem(this.refreshTokenKey);
        
        if (!refreshToken) {
            console.warn('[Auth] No refresh token available');
            return null;
        }
        
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    refresh_token: refreshToken
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                // Refresh token expired, force logout
                console.warn('[Auth] Refresh failed, logging out');
                this.logout();
                throw new Error('Session expired, please login again');
            }
            
            // Update access token
            localStorage.setItem(this.accessTokenKey, data.access_token);
            
            console.log('[Auth] Token refreshed successfully');
            return data.access_token;
        } catch (error) {
            console.error('[Auth] Token refresh error:', error);
            throw error;
        }
    }
    
    /**
     * Get current user info
     * @returns {object} {user_id, email} or null
     */
    getCurrentUser() {
        const user = localStorage.getItem(this.userKey);
        return user ? JSON.parse(user) : null;
    }
    
    /**
     * Get access token
     * @returns {string} Access token or null
     */
    getAccessToken() {
        return localStorage.getItem(this.accessTokenKey);
    }
    
    /**
     * Check if user is logged in
     * @returns {boolean} True if valid token exists
     */
    isLoggedIn() {
        const token = this.getAccessToken();
        return token !== null && token !== '';
    }
    
    /**
     * Check if access token will expire soon (within 1 minute)
     * @returns {boolean} True if needs refresh
     */
    tokenNeedsRefresh() {
        const token = this.getAccessToken();
        if (!token) return false;
        
        try {
            // Decode token (without verifying signature)
            const parts = token.split('.');
            const payload = JSON.parse(atob(parts[1]));
            
            // Check if expires within 1 minute
            const expiresIn = (payload.exp * 1000) - Date.now();
            return expiresIn < 60 * 1000; // Less than 1 minute
        } catch (error) {
            console.warn('[Auth] Could not parse token');
            return false;
        }
    }
    
    /**
     * Setup automatic token refresh interval
     * Checks every 10 minutes and refreshes if needed
     */
    setupTokenRefreshInterval() {
        // Clear existing interval
        if (this.refreshIntervalId) {
            clearInterval(this.refreshIntervalId);
        }
        
        // Check and refresh every 10 minutes
        this.refreshIntervalId = setInterval(() => {
            if (this.tokenNeedsRefresh()) {
                console.log('[Auth] Token expiring soon, auto-refreshing...');
                this.refreshAccessToken()
                    .catch(error => console.error('[Auth] Auto-refresh failed:', error));
            }
        }, this.refreshInterval);
        
        console.log('[Auth] Auto-refresh interval set');
    }
    
    /**
     * Store tokens in localStorage
     * @param {string} accessToken - JWT access token
     * @param {string} refreshToken - JWT refresh token
     */
    storeTokens(accessToken, refreshToken) {
        localStorage.setItem(this.accessTokenKey, accessToken);
        localStorage.setItem(this.refreshTokenKey, refreshToken);
        console.log('[Auth] Tokens stored');
    }
    
    /**
     * Store user info in localStorage
     * @param {string} email - User email
     * @param {number} userId - User ID
     */
    storeUserInfo(email, userId) {
        const userInfo = { email, user_id: userId };
        localStorage.setItem(this.userKey, JSON.stringify(userInfo));
        console.log('[Auth] User info stored');
    }
}

// Initialize global auth manager
const auth = new AuthManager();
