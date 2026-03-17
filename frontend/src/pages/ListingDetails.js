import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import marketplaceService from '../services/marketplaceService';
import creditService from '../services/creditService';
import toast from 'react-hot-toast';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import ReviewSection from '../components/Marketplace/ReviewSection';

const ListingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  useEffect(() => {
    loadListing();
  }, [id]);

  const loadListing = async () => {
    setLoading(true);
    try {
      const response = await marketplaceService.getListingById(id);
      setListing(response.data);
    } catch (error) {
      console.error('Failed to load listing:', error);
      toast.error('Failed to load listing details');
      navigate('/marketplace');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    const amount = purchaseAmount ? parseInt(purchaseAmount) : listing.creditAmount;
    
    try {
      await marketplaceService.purchaseCredits(id, amount);
      toast.success('Purchase successful!');
      setShowPurchaseModal(false);
      loadListing();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Purchase failed');
    }
  };

  const handleBid = async (e) => {
    e.preventDefault();
    
    try {
      await marketplaceService.placeBid(id, parseFloat(bidAmount));
      toast.success('Bid placed successfully!');
      setBidAmount('');
      loadListing();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to place bid');
    }
  };
  const handleAddReview = async (reviewData) => {
    try {
      await marketplaceService.addListingReview(id, reviewData);
      loadListing(); // Refresh listing to show new review
    } catch (error) {
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    
    try {
      await marketplaceService.deleteListing(id);
      toast.success('Listing deleted successfully');
      navigate('/marketplace');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete listing');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!listing) return null;

  const isOwner = user?._id === listing.sellerId?._id;
  const canBid = listing.listingType === 'auction' && listing.status === 'active' && !isOwner;
  const canBuy = listing.listingType !== 'auction' && listing.status === 'active' && !isOwner;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Back button */}
      <button
        onClick={() => navigate('/marketplace')}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Marketplace
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-4xl mb-2 block">
                  {marketplaceService.getListingTypeIcon(listing.listingType)}
                </span>
                <h1 className="text-3xl font-bold text-gray-900">{listing.title}</h1>
              </div>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                listing.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {listing.status}
              </span>
            </div>

            <div className="prose max-w-none mb-6">
              <p className="text-gray-700">{listing.description}</p>
            </div>

            {/* Seller Info */}
            <div className="border-t border-gray-200 pt-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Seller Information</h3>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                  {listing.sellerId?.profileImage ? (
                    <img
                      src={listing.sellerId.profileImage}
                      alt={listing.sellerName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-semibold text-primary-600">
                      {listing.sellerName?.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{listing.sellerName}</p>
                  <p className="text-sm text-gray-500">
                    Member since {listing.sellerId?.createdAt ? format(new Date(listing.sellerId.createdAt), 'MMM yyyy') : 'N/A'}
                  </p>
                  <div className="flex items-center mt-1">
                    <span className="text-yellow-400 mr-1">★</span>
                    <span className="text-sm text-gray-600">{listing.sellerRating?.toFixed(1) || '0.0'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bid History (for auctions) */}
            {listing.listingType === 'auction' && listing.bidHistory?.length > 0 && (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Bid History</h3>
                <div className="space-y-3">
                  {listing.bidHistory.slice(-5).reverse().map((bid, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-900">{bid.bidderName}</span>
                        <span className="text-gray-500 mx-2">•</span>
                        <span className="text-gray-500">{format(new Date(bid.timestamp), 'dd MMM HH:mm')}</span>
                      </div>
                      <span className="font-semibold text-primary-600">
                        {marketplaceService.formatPrice(bid.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews Section */}
            <ReviewSection 
              reviews={listing.reviews} 
              onAddReview={handleAddReview}
              title="Listing Reviews"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Price Card */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Listing Details</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Credits</span>
                <span className="font-semibold text-gray-900">
                  {creditService.formatCredits(listing.creditAmount)}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Available</span>
                <span className="font-semibold text-green-600">
                  {creditService.formatCredits(listing.availableAmount)}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Price per Credit</span>
                <span className="font-semibold text-gray-900">
                  {marketplaceService.formatPrice(listing.pricePerCredit)}
                </span>
              </div>
              
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-4">
                <span className="text-gray-900">Total Price</span>
                <span className="text-primary-600">
                  {marketplaceService.formatPrice(listing.totalPrice)}
                </span>
              </div>

              <div className="flex justify-between text-sm text-gray-500">
                <span>Listing Type</span>
                <span className="capitalize">{listing.listingType}</span>
              </div>

              <div className="flex justify-between text-sm text-gray-500">
                <span>Category</span>
                <span className="capitalize">{listing.category}</span>
              </div>

              <div className="flex justify-between text-sm text-gray-500">
                <span>Expires In</span>
                <span>{marketplaceService.getTimeRemaining(listing.expiresAt)}</span>
              </div>

              <div className="flex justify-between text-sm text-gray-500">
                <span>Views</span>
                <span>{listing.views}</span>
              </div>
            </div>

            {/* Action Buttons */}
            {canBuy && (
              <button
                onClick={() => setShowPurchaseModal(true)}
                className="w-full mt-6 btn-primary"
              >
                Purchase Credits
              </button>
            )}

            {canBid && (
              <form onSubmit={handleBid} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Bid (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min={listing.currentBid ? listing.currentBid + 0.01 : listing.startingBid}
                    step="0.01"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="input-field"
                    placeholder={`Min: ₹${listing.currentBid || listing.startingBid}`}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full btn-primary"
                >
                  Place Bid
                </button>
              </form>
            )}

            {isOwner && listing.status === 'active' && (
              <button
                onClick={handleDelete}
                className="w-full mt-6 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
              >
                Cancel Listing
              </button>
            )}
          </div>

          {/* Tags */}
          {listing.tags?.length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {listing.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Purchase Modal */}
      <Transition appear show={showPurchaseModal} as={Fragment}>
        <Dialog
          as="div"
          className="fixed inset-0 z-10 overflow-y-auto"
          onClose={() => setShowPurchaseModal(false)}
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
                  Purchase Credits
                </Dialog.Title>

                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-4">
                    You are about to purchase credits from {listing.sellerName}
                  </p>

                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">Price per Credit</span>
                      <span className="font-medium text-gray-900">
                        {marketplaceService.formatPrice(listing.pricePerCredit)}
                      </span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">Available Credits</span>
                      <span className="font-medium text-gray-900">{listing.availableAmount}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount to Purchase
                    </label>
                    <input
                      type="number"
                      min={listing.minPurchaseAmount}
                      max={listing.maxPurchaseAmount || listing.availableAmount}
                      value={purchaseAmount}
                      onChange={(e) => setPurchaseAmount(e.target.value)}
                      className="input-field"
                      placeholder={`Enter amount (1-${listing.availableAmount})`}
                    />
                  </div>

                  {purchaseAmount && (
                    <div className="bg-primary-50 rounded-lg p-4 mb-4">
                      <div className="flex justify-between text-lg font-bold">
                        <span className="text-primary-800">Total Price</span>
                        <span className="text-primary-600">
                          {marketplaceService.formatPrice(purchaseAmount * listing.pricePerCredit)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowPurchaseModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePurchase}
                    disabled={!purchaseAmount || purchaseAmount < (listing.minPurchaseAmount || 1)}
                    className="btn-primary disabled:opacity-50"
                  >
                    Confirm Purchase
                  </button>
                </div>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default ListingDetails;
