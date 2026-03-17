import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import marketplaceService from '../services/marketplaceService';
import toast from 'react-hot-toast';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import ReviewSection from '../components/Marketplace/ReviewSection';

const RewardDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);
    const [reward, setReward] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
    const [redemptionResult, setRedemptionResult] = useState(null);

    useEffect(() => {
        loadReward();
    }, [id]);

    const loadReward = async () => {
        setLoading(true);
        try {
            const response = await marketplaceService.getRewardById(id);
            setReward(response.data);
        } catch (error) {
            console.error('Failed to load reward:', error);
            toast.error('Reward not found');
            navigate('/marketplace');
        } finally {
            setLoading(false);
        }
    };

    const handleRedeem = async () => {
        try {
            const response = await marketplaceService.redeemReward(id);
            setRedemptionResult(response.data);
            toast.success('Reward redeemed successfully!');
            // Update local user state if needed (handled by interceptors usually, but good to refresh)
            loadReward();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Redemption failed');
            setIsRedeemModalOpen(false);
        }
    };
    const handleAddReview = async (reviewData) => {
        try {
            await marketplaceService.addRewardReview(id, reviewData);
            loadReward(); // Refresh reward to show new review
        } catch (error) {
            throw error;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    const isEligible = () => {
        if (!reward.eligibility) return true;
        const { minSustainabilityScore, minCreditsEarned } = reward.eligibility;
        return (
            (user.sustainabilityScore >= (minSustainabilityScore || 0)) &&
            (user.totalCreditsEarned >= (minCreditsEarned || 0))
        );
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <Link to="/marketplace" className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-6">
                <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Marketplace
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Image Section */}
                <div className="space-y-4">
                    <div className="aspect-square bg-gray-100 rounded-3xl overflow-hidden shadow-inner">
                        <img
                            src={reward.imageUrl || 'https://via.placeholder.com/600x600'}
                            alt={reward.name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>

                {/* Content Section */}
                <div className="space-y-8">
                    <div>
                        <div className="flex items-center space-x-2 mb-4">
                            <span className="px-3 py-1 bg-primary-100 text-primary-700 text-xs font-bold rounded-full uppercase tracking-wider">
                                {reward.category}
                            </span>
                            {reward.featured && (
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full uppercase tracking-wider">
                                    ⭐ Featured
                                </span>
                            )}
                        </div>
                        <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">
                            {reward.name}
                        </h1>
                        <p className="mt-2 text-lg text-gray-600 flex items-center">
                            By <span className="font-semibold text-gray-900 ml-1">{reward.partnerName}</span>
                            {reward.partnerVerified && (
                                <svg className="w-5 h-5 text-blue-500 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.24.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            )}
                        </p>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border border-gray-100">
                        <div>
                            <p className="text-sm text-gray-500">Redemption Cost</p>
                            <p className="text-3xl font-bold text-primary-600">
                                {reward.creditCost} <span className="text-lg font-medium">Credits</span>
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Approx. Value</p>
                            <p className="text-2xl font-semibold text-gray-900">₹{reward.monetaryValue}</p>
                        </div>
                    </div>

                    <div className="prose prose-primary max-w-none">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">About this Reward</h3>
                        <p className="text-gray-600 leading-relaxed">{reward.description}</p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-gray-900">Eligibility & Availability</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-800">
                                <p className="text-xs uppercase font-bold opacity-60">Stock Remaining</p>
                                <p className="text-lg font-bold">{reward.stock === -1 ? 'Unlimited' : reward.stock}</p>
                            </div>
                            <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 text-orange-800">
                                <p className="text-xs uppercase font-bold opacity-60">Expires On</p>
                                <p className="text-lg font-bold">{format(new Date(reward.validUntil), 'dd MMM yyyy')}</p>
                            </div>
                        </div>
                        {!isEligible() && (
                            <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-start text-red-700">
                                <svg className="w-5 h-5 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <p className="font-bold">Not Yet Eligible</p>
                                    <p className="text-sm">You need a higher sustainability score to unlock this reward.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setIsRedeemModalOpen(true)}
                        disabled={!isEligible() || user.walletBalance < reward.creditCost || reward.stock === 0}
                        className={`w-full py-5 rounded-2xl font-bold text-lg shadow-xl transition-all ${
                            !isEligible() || user.walletBalance < reward.creditCost || reward.stock === 0
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-primary-600 text-white hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                    >
                        {reward.stock === 0 ? 'Out of Stock' :
                         user.walletBalance < reward.creditCost ? 'Insufficient Credits' :
                         'Redeem Now'}
                    </button>

                    <div className="text-center">
                        <p className="text-sm text-gray-500">
                            Your Current Balance: <span className="font-bold text-gray-900">{user.walletBalance} Credits</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Reviews Section */}
            <div className="max-w-4xl mx-auto mt-16">
                <ReviewSection 
                    reviews={reward.reviews} 
                    onAddReview={handleAddReview}
                    title="Experience Reviews"
                />
            </div>

            {/* Redemption Modal */}
            <Transition appear show={isRedeemModalOpen} as={Fragment}>
                <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={() => !redemptionResult && setIsRedeemModalOpen(false)}>
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
                            <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
                        </Transition.Child>

                        <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>

                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <div className="inline-block w-full max-w-lg p-10 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-2xl rounded-[2.5rem]">
                                {!redemptionResult ? (
                                    <>
                                        <div className="text-center mb-8">
                                            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                                <span className="text-4xl">🎁</span>
                                            </div>
                                            <Dialog.Title as="h3" className="text-2xl font-extrabold text-gray-900">
                                                Confirm Redemption
                                            </Dialog.Title>
                                            <p className="mt-2 text-gray-600">
                                                Are you sure you want to spend <span className="font-bold text-primary-600">{reward.creditCost} credits</span> for this reward?
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                                <span className="text-gray-600">Reward</span>
                                                <span className="font-bold text-gray-900">{reward.name}</span>
                                            </div>
                                            <div className="flex justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                                <span className="text-gray-600">Cost</span>
                                                <span className="font-bold text-gray-900">{reward.creditCost} Credits</span>
                                            </div>
                                            <div className="flex justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                                <span className="text-gray-600">New Balance</span>
                                                <span className="font-bold text-primary-600">{user.walletBalance - reward.creditCost} Credits</span>
                                            </div>
                                        </div>

                                        <div className="mt-10 flex space-x-4">
                                            <button
                                                type="button"
                                                className="flex-1 px-4 py-4 text-sm font-bold text-gray-700 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors"
                                                onClick={() => setIsRedeemModalOpen(false)}
                                            >
                                                Maybe Later
                                            </button>
                                            <button
                                                type="button"
                                                className="flex-1 px-4 py-4 text-sm font-bold text-white bg-primary-600 rounded-2xl hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all active:scale-95"
                                                onClick={handleRedeem}
                                            >
                                                Confirm & Redeem
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center">
                                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                                            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <Dialog.Title as="h3" className="text-3xl font-extrabold text-gray-900 mb-4">
                                            Redemption Successful!
                                        </Dialog.Title>
                                        <p className="text-gray-600 mb-8">
                                            Your unique redemption code has been generated. Use this at the store to claim your reward.
                                        </p>

                                        <div className="p-8 bg-gray-900 rounded-3xl mb-8 relative group overflow-hidden">
                                            <div className="absolute top-0 left-0 w-full h-1 bg-primary-500"></div>
                                            <p className="text-xs uppercase tracking-widest text-primary-400 font-bold mb-2">Redemption Code</p>
                                            <p className="text-4xl font-black text-white tracking-widest font-mono">
                                                {redemptionResult.redemptionCode}
                                            </p>
                                        </div>

                                        <div className="text-left bg-blue-50 border border-blue-100 p-6 rounded-2xl mb-8">
                                            <h4 className="text-sm font-bold text-blue-900 mb-2">How to Use:</h4>
                                            <p className="text-sm text-blue-800 leading-relaxed">
                                                {redemptionResult.instructions || 'Show this code to the partner at the time of purchase. Code is valid for 30 days.'}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            className="w-full py-4 text-center font-bold text-white bg-gray-900 rounded-2xl hover:bg-gray-800 transition-all"
                                            onClick={() => {
                                                setIsRedeemModalOpen(false);
                                                setRedemptionResult(null);
                                                navigate('/wallet'); // Or wherever redemptions are listed
                                            }}
                                        >
                                            View in My Wallet
                                        </button>
                                    </div>
                                )}
                            </div>
                        </Transition.Child>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
};

export default RewardDetails;
