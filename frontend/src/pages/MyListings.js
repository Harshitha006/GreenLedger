import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import marketplaceService from '../services/marketplaceService';
import creditService from '../services/creditService';
import toast from 'react-hot-toast';

const MyListings = () => {
  const [listings, setListings] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    page: 1
  });
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    loadListings();
  }, [filters]);

  const loadListings = async () => {
    setLoading(true);
    try {
      const params = {
        status: filters.status !== 'all' ? filters.status : undefined,
        page: filters.page,
        limit: 10
      };
      
      const response = await marketplaceService.getMyListings(params);
      setListings(response.data);
      setSummary(response.summary);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Failed to load listings:', error);
      toast.error('Failed to load your listings');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (listingId) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    
    try {
      await marketplaceService.deleteListing(listingId);
      toast.success('Listing deleted successfully');
      loadListings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete listing');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      sold: 'bg-blue-100 text-blue-800',
      expired: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
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
          <h1 className="text-3xl font-bold text-gray-900">My Listings</h1>
          <p className="text-gray-600 mt-1">Manage your credit listings</p>
        </div>
        <Link
          to="/marketplace"
          className="btn-secondary"
        >
          Browse Marketplace
        </Link>
      </div>

      {/* Summary Cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {summary.map((item) => (
            <div key={item._id} className="bg-white rounded-xl shadow-md p-6">
              <p className="text-sm text-gray-600 mb-1 capitalize">{item._id}</p>
              <p className="text-2xl font-bold text-gray-900">{item.count}</p>
              <p className="text-xs text-gray-500 mt-2">
                {item.totalCredits} total credits
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
          className="input-field w-48"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="sold">Sold</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Listings Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Listing
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Credits
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price/Credit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expires
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {listings.map((listing) => (
              <tr key={listing._id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{listing.title}</p>
                    <p className="text-sm text-gray-500 truncate max-w-xs">{listing.description}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="capitalize">{listing.listingType}</span>
                </td>
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">
                      {creditService.formatCredits(listing.creditAmount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {listing.availableAmount} available
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {marketplaceService.formatPrice(listing.pricePerCredit)}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(listing.status)}`}>
                    {listing.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {marketplaceService.getTimeRemaining(listing.expiresAt)}
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <Link
                    to={`/marketplace/listing/${listing._id}`}
                    className="text-primary-600 hover:text-primary-900 font-medium text-sm"
                  >
                    View
                  </Link>
                  {listing.status === 'active' && (
                    <>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => handleDelete(listing._id)}
                        className="text-red-600 hover:text-red-900 font-medium text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {listings.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No listings found</h3>
            <p className="text-gray-600 mb-6">Start selling your credits in the marketplace</p>
            <Link to="/marketplace" className="btn-primary">
              Create Listing
            </Link>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
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
    </div>
  );
};

export default MyListings;
