import api from './api';

class CreditService {
    // Get user credit summary
    async getCreditSummary() {
        const response = await api.get('/credits/summary');
        return response.data;
    }

    // Get credit history
    async getCreditHistory(params = {}) {
        const response = await api.get('/credits/history', { params });
        return response.data;
    }

    // Transfer credits
    async transferCredits(toUserId, amount, description = '') {
        const response = await api.post('/credits/transfer', {
            toUserId,
            amount,
            description
        });
        return response.data;
    }

    // Get leaderboard
    async getLeaderboard(params = {}) {
        const response = await api.get('/credits/leaderboard', { params });
        return response.data;
    }

    // Get transaction by ID
    async getTransaction(transactionId) {
        const response = await api.get(`/credits/transaction/${transactionId}`);
        return response.data;
    }

    // Admin: Get all transactions
    async getAllTransactions(params = {}) {
        const response = await api.get('/credits/admin/transactions', { params });
        return response.data;
    }

    // Admin: Get platform stats
    async getPlatformStats() {
        const response = await api.get('/credits/admin/stats');
        return response.data;
    }

    // Admin: Reverse transaction
    async reverseTransaction(transactionId, reason) {
        const response = await api.post(`/credits/admin/reverse/${transactionId}`, { reason });
        return response.data;
    }

    // Format credit amount
    formatCredits(amount) {
        return new Intl.NumberFormat('en-IN').format(amount);
    }

    // Get credit color class based on amount
    getCreditColorClass(amount) {
        if (amount >= 1000) return 'text-purple-600';
        if (amount >= 500) return 'text-blue-600';
        if (amount >= 100) return 'text-green-600';
        return 'text-gray-600';
    }

    // Get transaction icon
    getTransactionIcon(type) {
        const icons = {
            earned: '💰',
            transferred: '↗️',
            redeemed: '🎁',
            purchased: '💳',
            issued: '📜',
            burned: '🔥'
        };
        return icons[type] || '💱';
    }

    // Get transaction color
    getTransactionColor(type) {
        const colors = {
            earned: 'text-green-600',
            transferred: 'text-blue-600',
            redeemed: 'text-purple-600',
            purchased: 'text-orange-600',
            issued: 'text-gray-600',
            burned: 'text-red-600'
        };
        return colors[type] || 'text-gray-600';
    }
}

export default new CreditService();
