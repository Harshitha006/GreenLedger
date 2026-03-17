import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useSelector } from 'react-redux';
import marketplaceService from '../services/marketplaceService';
import creditService from '../services/creditService';
import toast from 'react-hot-toast';

const Marketplace = () => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [stats, setStats] = useState({
    listings: { total: 0, active: 0 },
    rewards: { total: 0, distinct: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('listings');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    type: 'all',
    category: 'all',
    search: '',
    sort: '-createdAt',
    page: 1
  });
  const [pagination, setPagination] = useState(null);

  const [newListing, setNewListing] = useState({
    title: '',
    description: '',
    creditAmount: '',
    pricePerCredit: '',
    listingType: 'fixed',
    category: 'personal',
    tags: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  // Redirect admins away from the marketplace
  useEffect(() => {
    if (user && user.role === 'admin') {
      toast.error('Admins are not allowed to access the marketplace');
      navigate('/admin');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (activeTab === 'listings') {
      loadListings();
    } else {
      loadRewards();
    }
  }, [activeTab, filters]);

  const loadData = async () => {
    try {
      const [listingsData, rewardsData, statsData] = await Promise.all([
        marketplaceService.getListings({ limit: 10 }),
        marketplaceService.getRewards({ limit: 10 }),
        marketplaceService.getMarketplaceStats()
      ]);
      
      setListings(listingsData.data);
      setRewards(rewardsData.data);
      setStats(statsData.data);
      setPagination(listingsData.pagination);
    } catch (error) {
      console.error('Failed to load marketplace:', error);
      toast.error('Failed to load marketplace data');
    } finally {
      setLoading(false);
    }
  };

  const loadListings = async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        type: filters.type !== 'all' ? filters.type : undefined,
        category: filters.category !== 'all' ? filters.category : undefined
      };
      
      const response = await marketplaceService.getListings(params);
      setListings(response.data);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Failed to load listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRewards = async () => {
    setLoading(true);
    try {
      const params = {
        category: filters.category !== 'all' ? filters.category : undefined,
        minCredits: filters.minCredits,
        maxCredits: filters.maxCredits,
        sort: filters.sort
      };
      
      const response = await marketplaceService.getRewards(params);
      setRewards(response.data);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Failed to load rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    
    try {
      const listingData = {
        ...newListing,
        creditAmount: parseInt(newListing.creditAmount),
        pricePerCredit: parseFloat(newListing.pricePerCredit),
        tags: newListing.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };

      await marketplaceService.createListing(listingData);
      toast.success('Listing created successfully');
      setIsCreateModalOpen(false);
      loadListings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create listing');
    }
  };

  const handleRedeem = async (rewardId) => {
    try {
      const result = await marketplaceService.redeemReward(rewardId);
      toast.success('Reward redeemed successfully!');
      
      // Show redemption code
      if (result.data.redemption?.redemptionCode) {
        navigator.clipboard.writeText(result.data.redemption.redemptionCode);
        toast.success('Redemption code copied to clipboard!');
      }
      
      loadRewards();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Redemption failed');
    }
  };

  if (loading && !listings.length && !rewards.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Green Marketplace</h1>
          <p className="text-gray-600 mt-1">Trade credits and redeem rewards</p>
        </div>
        <div className="flex space-x-3">
          <Link
            to="/my-listings"
            className="btn-secondary"
          >
            My Listings
          </Link>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-primary"
          >
            + Create Listing
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <p className="text-sm text-gray-600 mb-1">Active Listings</p>
            <p className="text-2xl font-bold text-gray-900">{stats.listings.totalListings}</p>
            <p className="text-xs text-green-600 mt-2">
              {stats.listings.totalCredits} credits available
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <p className="text-sm text-gray-600 mb-1">Available Rewards</p>
            <p className="text-2xl font-bold text-gray-900">{stats.rewards.totalRewards}</p>
            <p className="text-xs text-blue-600 mt-2">
              Avg {Math.round(stats.rewards.avgCredits)} credits
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <p className="text-sm text-gray-600 mb-1">30-Day Volume</p>
            <p className="text-2xl font-bold text-gray-900">
              {creditService.formatCredits(stats.transactions.totalVolume)}
            </p>
            <p className="text-xs text-purple-600 mt-2">
              {stats.transactions.totalTransactions} transactions
            </p>
          </div>

        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {['listings', 'rewards'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })}
            className="input-field"
          >
            <option value="all">All Types</option>
            <option value="fixed">Fixed Price</option>
            <option value="negotiable">Negotiable</option>
            <option value="auction">Auction</option>
            <option value="bulk">Bulk</option>
          </select>

          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
            className="input-field"
          >
            <option value="all">All Categories</option>
            <option value="personal">Personal</option>
            <option value="institutional">Institutional</option>
            <option value="csr">CSR</option>
            <option value="charity">Charity</option>
            <option value="business">Business</option>
          </select>



          <select
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value, page: 1 })}
            className="input-field"
          >
            <option value="-createdAt">Newest First</option>
            <option value="createdAt">Oldest First</option>

            <option value="-creditAmount">Credits: High to Low</option>
            <option value="creditAmount">Credits: Low to High</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'listings' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <div key={listing._id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-2xl mr-2">{marketplaceService.getListingTypeIcon(listing.listingType)}</span>
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      {listing.listingType}
                    </span>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    listing.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {listing.status}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">{listing.title}</h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{listing.description}</p>

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Credits</p>
                    <p className="text-xl font-bold text-primary-600">
                      {creditService.formatCredits(listing.creditAmount)}
                    </p>
                  </div>

                </div>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <div className="flex items-center">
                    <span className="mr-1">👤</span>
                    {listing.sellerName}
                  </div>
                  <div className="flex items-center">
                    <span className="mr-1">⏳</span>
                    {marketplaceService.getTimeRemaining(listing.expiresAt)}
                  </div>
                </div>

                {listing.listingType === 'auction' ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Current Bid</span>
                      <span className="font-semibold text-gray-900">
                        {marketplaceService.formatPrice(listing.currentBid || listing.startingBid)}
                      </span>
                    </div>
                    <Link
                      to={`/marketplace/listing/${listing._id}`}
                      className="block w-full text-center btn-primary"
                    >
                      Place Bid
                    </Link>
                  </div>
                ) : (
                  <Link
                    to={`/marketplace/listing/${listing._id}`}
                    className="block w-full text-center btn-primary"
                  >
                    View Details
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rewards.map((reward) => (
            <div key={reward._id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition">
              <div className="h-48 bg-gray-200 relative">
                {reward.imageUrl ? (
                  <img
                    src={reward.imageUrl}
                    alt={reward.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl">
                    {marketplaceService.getRewardCategoryIcon(reward.category)}
                  </div>
                )}
                {reward.featured && (
                  <span className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded">
                    Featured
                  </span>
                )}
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary-600">
                    {marketplaceService.getRewardCategoryIcon(reward.category)} {reward.category}
                  </span>
                  <span className="text-sm text-gray-500">
                    by {reward.partnerName}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">{reward.name}</h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{reward.description}</p>

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Credits Needed</p>
                    <p className="text-2xl font-bold text-primary-600">
                      {creditService.formatCredits(reward.creditCost)}
                    </p>
                  </div>

                </div>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <div className="flex items-center">
                    <span className="mr-1">⭐</span>
                    {reward.averageRating.toFixed(1)} ({reward.reviewCount})
                  </div>
                  <div className="flex items-center">
                    <span className="mr-1">📦</span>
                    {reward.stock === -1 ? 'Unlimited' : `${reward.stock} left`}
                  </div>
                </div>

                <button
                  onClick={() => handleRedeem(reward._id)}
                  className="w-full btn-primary"
                >
                  Redeem Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            disabled={filters.page === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            disabled={filters.page === pagination.pages}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Create Listing Modal */}
      <Transition appear show={isCreateModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="fixed inset-0 z-10 overflow-y-auto"
          onClose={() => setIsCreateModalOpen(false)}
        >
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <span className="inline-block h-screen align-middle" aria-hidden="true">
              &#8203;
            </span>

            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900"
                >
                  Create New Listing
                </Dialog.Title>

                <form onSubmit={handleCreateListing} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Title
                    </label>
                    <input
                      type="text"
                      required
                      value={newListing.title}
                      onChange={(e) => setNewListing({ ...newListing, title: e.target.value })}
                      className="mt-1 block w-full input-field"
                      placeholder="e.g., 100 Green Credits for Sale"
                      maxLength="100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      required
                      value={newListing.description}
                      onChange={(e) => setNewListing({ ...newListing, description: e.target.value })}
                      className="mt-1 block w-full input-field"
                      rows="3"
                      placeholder="Describe your credits and why you're selling..."
                      maxLength="2000"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Credit Amount
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="100000"
                        value={newListing.creditAmount}
                        onChange={(e) => setNewListing({ ...newListing, creditAmount: e.target.value })}
                        className="mt-1 block w-full input-field"
                        placeholder="100"
                      />
                    </div>


                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Listing Type
                      </label>
                      <select
                        value={newListing.listingType}
                        onChange={(e) => setNewListing({ ...newListing, listingType: e.target.value })}
                        className="mt-1 block w-full input-field"
                      >
                        <option value="fixed">Fixed Price</option>
                        <option value="negotiable">Negotiable</option>
                        <option value="auction">Auction</option>
                        <option value="bulk">Bulk</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Category
                      </label>
                      <select
                        value={newListing.category}
                        onChange={(e) => setNewListing({ ...newListing, category: e.target.value })}
                        className="mt-1 block w-full input-field"
                      >
                        <option value="personal">Personal</option>
                        <option value="institutional">Institutional</option>
                        <option value="csr">CSR</option>
                        <option value="charity">Charity</option>
                        <option value="business">Business</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      value={newListing.tags}
                      onChange={(e) => setNewListing({ ...newListing, tags: e.target.value })}
                      className="mt-1 block w-full input-field"
                      placeholder="green, renewable, carbon"
                    />
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                    >
                      Create Listing
                    </button>
                  </div>
                </form>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default Marketplace;
