/**
 * APIClient - HTTP Request Wrapper
 * Phase 0: Automatically adds JWT authorization to all API calls
 * 
 * Features:
 * - Adds Authorization header with JWT token
 * - Handles 401 (expired token) by auto-refreshing
 * - Handles 403 (forbidden)
 * - Centralized error handling
 * 
 * Usage:
 *   const response = await api.get('/expenses');
 *   const newExpense = await api.post('/expenses', { amount: 500, category: 'Food' });
 */

class APIClient {
    constructor(baseURL = CONFIG.API_BASE_URL) {
        this.baseURL = baseURL;
    }
    
    /**
     * Make HTTP request with automatic JWT token injection
     * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
     * @param {string} endpoint - API endpoint (e.g., '/expenses')
     * @param {object} data - Request body (optional)
     * @returns {Promise} Response from server
     */
    async request(method, endpoint, data = null) {
        let token = auth.getAccessToken();
        
        // Build headers
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add authorization header if token exists
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Build request options
        const options = {
            method: method,
            headers: headers
        };
        
        if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
            options.body = JSON.stringify(data);
        }
        
        try {
            // Make request
            const url = `${this.baseURL}${endpoint}`;
            console.log(`[API] ${method} ${endpoint}`);
            
            const response = await fetch(url, options);
            
            // Handle 401 Unauthorized (token expired)
            if (response.status === 401) {
                console.warn('[API] 401 Unauthorized - Attempting to refresh token');
                
                try {
                    // Try to refresh token
                    const newToken = await auth.refreshAccessToken();
                    
                    if (newToken) {
                        // Retry request with new token
                        console.log('[API] Retrying request with new token');
                        headers['Authorization'] = `Bearer ${newToken}`;
                        options.headers = headers;
                        
                        const retryResponse = await fetch(url, options);
                        return await this.handleResponse(retryResponse);
                    }
                } catch (refreshError) {
                    console.error('[API] Token refresh failed, redirecting to login');
                    // Redirect to login page
                    window.location.href = '/login.html';
                    throw new Error('Session expired, please login again');
                }
            }
            
            // Handle 403 Forbidden
            if (response.status === 403) {
                console.error('[API] 403 Forbidden');
                throw new Error('You do not have permission to access this resource');
            }
            
            return await this.handleResponse(response);
        } catch (error) {
            console.error(`[API] Error: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Handle API response
     * @param {Response} response - Fetch response object
     * @returns {Promise} Parsed JSON response
     */
    async handleResponse(response) {
        // Try to parse JSON
        let data;
        try {
            data = await response.json();
        } catch (error) {
            // If JSON parsing fails, return text
            data = await response.text();
        }
        
        // Check if response is OK (200-299)
        if (!response.ok) {
            const errorMessage = data?.message || data || 'Unknown error';
            console.error(`[API] Error ${response.status}: ${errorMessage}`);
            throw new Error(errorMessage);
        }
        
        return data;
    }
    
    /**
     * GET request
     * @param {string} endpoint - API endpoint
     * @returns {Promise} Response data
     */
    async get(endpoint) {
        return this.request('GET', endpoint);
    }
    
    /**
     * POST request
     * @param {string} endpoint - API endpoint
     * @param {object} data - Request body
     * @returns {Promise} Response data
     */
    async post(endpoint, data) {
        return this.request('POST', endpoint, data);
    }
    
    /**
     * PUT request
     * @param {string} endpoint - API endpoint
     * @param {object} data - Request body
     * @returns {Promise} Response data
     */
    async put(endpoint, data) {
        return this.request('PUT', endpoint, data);
    }
    
    /**
     * PATCH request
     * @param {string} endpoint - API endpoint
     * @param {object} data - Request body
     * @returns {Promise} Response data
     */
    async patch(endpoint, data) {
        return this.request('PATCH', endpoint, data);
    }
    
    /**
     * DELETE request
     * @param {string} endpoint - API endpoint
     * @returns {Promise} Response data
     */
    async delete(endpoint) {
        return this.request('DELETE', endpoint);
    }
}

// Initialize global API client
// All requests will automatically include JWT token
const api = new APIClient();
