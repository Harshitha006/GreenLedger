import api from './api';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

class AuthService {
    // Store auth data
    setAuthData(token, user) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    // Get token
    getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    // Get user
    getUser() {
        const userStr = localStorage.getItem(USER_KEY);
        return userStr ? JSON.parse(userStr) : null;
    }

    // Check if logged in
    isLoggedIn() {
        return !!this.getToken();
    }

    // Clear auth data
    clearAuthData() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    // Register user
    async register(userData) {
        const response = await api.post('/auth/register', userData);
        if (response.data.data?.token) {
            this.setAuthData(response.data.data.token, response.data.data);
        }
        return response.data;
    }

    // Login user
    async login(email, password) {
        const response = await api.post('/auth/login', { email, password });
        if (response.data.data?.token) {
            this.setAuthData(response.data.data.token, response.data.data);
        }
        return response.data;
    }

    // Logout
    logout() {
        this.clearAuthData();
        // Optional: Call logout endpoint
        api.post('/auth/logout').catch(() => { });
    }

    // Get current user profile
    async getProfile() {
        const response = await api.get('/auth/profile');
        return response.data;
    }

    // Update profile
    async updateProfile(profileData) {
        const response = await api.put('/auth/profile', profileData);
        if (response.data.data) {
            // Update stored user data
            const currentUser = this.getUser();
            const updatedUser = { ...currentUser, ...response.data.data };
            localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        }
        return response.data;
    }

    // Change password
    async changePassword(currentPassword, newPassword) {
        const response = await api.put('/auth/change-password', {
            currentPassword,
            newPassword,
        });
        return response.data;
    }

    // Verify email
    async verifyEmail(token) {
        const response = await api.get(`/auth/verify-email/${token}`);
        return response.data;
    }

    // Resend verification email
    async resendVerification(email) {
        const response = await api.post('/auth/resend-verification', { email });
        return response.data;
    }

    // Forgot password
    async forgotPassword(email) {
        const response = await api.post('/auth/forgot-password', { email });
        return response.data;
    }

    // Reset password
    async resetPassword(token, password) {
        const response = await api.post(`/auth/reset-password/${token}`, { password });
        return response.data;
    }

    // Refresh token
    async refreshToken() {
        const token = this.getToken();
        if (!token) return null;

        try {
            const response = await api.post('/auth/refresh-token', { token });
            if (response.data.data?.token) {
                const currentUser = this.getUser();
                this.setAuthData(response.data.data.token, currentUser);
            }
            return response.data;
        } catch (error) {
            this.logout();
            throw error;
        }
    }

    // Check if token is expired (client-side check)
    isTokenExpired(token) {
        if (!token) return true;

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp * 1000 < Date.now();
        } catch {
            return true;
        }
    }
}

export default new AuthService();
