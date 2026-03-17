import api from './api';

class MarketplaceService {
  // Listings
  async getListings(params = {}) {
    const response = await api.get('/marketplace/listings', { params });
    return response.data;
  }

  async getListingById(id) {
    const response = await api.get(`/marketplace/listings/${id}`);
    return response.data;
  }

  async createListing(listingData) {
    const response = await api.post('/marketplace/listings', listingData);
    return response.data;
  }

  async updateListing(id, listingData) {
    const response = await api.put(`/marketplace/listings/${id}`, listingData);
    return response.data;
  }

  async deleteListing(id) {
    const response = await api.delete(`/marketplace/listings/${id}`);
    return response.data;
  }

  async purchaseCredits(id, amount) {
    const response = await api.post(`/marketplace/listings/${id}/purchase`, { amount });
    return response.data;
  }

  async placeBid(id, amount) {
    const response = await api.post(`/marketplace/listings/${id}/bid`, { amount });
    return response.data;
  }

  async getMyListings(params = {}) {
    const response = await api.get('/marketplace/my-listings', { params });
    return response.data;
  }

  // Rewards
  async getRewards(params = {}) {
    const response = await api.get('/marketplace/rewards', { params });
    return response.data;
  }

  async getRewardById(id) {
    const response = await api.get(`/marketplace/rewards/${id}`);
    return response.data;
  }

  async redeemReward(id) {
    const response = await api.post(`/marketplace/rewards/${id}/redeem`);
    return response.data;
  }

  // Reviews
  async addListingReview(id, reviewData) {
    const response = await api.post(`/marketplace/listings/${id}/review`, reviewData);
    return response.data;
  }

  async addRewardReview(id, reviewData) {
    const response = await api.post(`/marketplace/rewards/${id}/review`, reviewData);
    return response.data;
  }

  // Stats
  async getMarketplaceStats() {
    const response = await api.get('/marketplace/stats');
    return response.data;
  }

  // Helper methods
  formatPrice(price, currency = 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency
    }).format(price);
  }

  getListingTypeIcon(type) {
    const icons = {
      fixed: '💰',
      negotiable: '🤝',
      auction: '🔨',
      bulk: '📦'
    };
    return icons[type] || '📋';
  }

  getCategoryIcon(category) {
    const icons = {
      personal: '👤',
      institutional: '🏛️',
      csr: '🏢',
      charity: '❤️',
      business: '💼'
    };
    return icons[category] || '📌';
  }

  getRewardCategoryIcon(category) {
    const icons = {
      food: '🍔',
      shopping: '🛍️',
      transport: '🚗',
      donation: '🎁',
      education: '📚',
      entertainment: '🎬',
      health: '💪',
      travel: '✈️',
      other: '🎯'
    };
    return icons[category] || '🎁';
  }

  getTimeRemaining(expiryDate) {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diff = expiry - now;

    if (diff < 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}

export default new MarketplaceService();
