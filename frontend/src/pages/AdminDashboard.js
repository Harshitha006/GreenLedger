import React, { useState, useEffect, Fragment } from 'react';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import api from '../services/api';
import marketplaceService from '../services/marketplaceService';
import toast from 'react-hot-toast';
import { Dialog, Transition } from '@headlessui/react';

const AdminDashboard = () => {
    const { user } = useSelector((state) => state.auth);
    const [stats, setStats] = useState(null);
    const [pendingActions, setPendingActions] = useState([]);
    const [marketplaceListings, setMarketplaceListings] = useState([]);
    const [rewards, setRewards] = useState([]);
    const [adminLogs, setAdminLogs] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
    const [rewardForm, setRewardForm] = useState({
        name: '', description: '', category: '', creditCost: 0, monetaryValue: 0, 
        stock: -1, validUntil: '', redemptionType: 'qr'
    });

    useEffect(() => {
        loadAdminData();
    }, []);

    const loadAdminData = async () => {
        setLoading(true);
        try {
            const [statsRes, actionsRes, listingsRes, rewardsRes, logsRes, usersRes] = await Promise.all([
                api.get('/admin/system-stats'),
                api.get('/verification/pending'),
                marketplaceService.getListings({ status: 'all' }),
                marketplaceService.getRewards(),
                api.get('/admin/logs'),
                api.get('/admin/users')
            ]);

            setStats(statsRes.data.data);
            setPendingActions(actionsRes.data.data);
            setMarketplaceListings(listingsRes.data);
            setRewards(rewardsRes.data);
            setAdminLogs(logsRes.data.data);
            setUsers(usersRes.data.data);
        } catch (error) {
            console.error('Failed to load admin data:', error);
            toast.error('Failed to load admin dashboard');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAction = async (actionId, status) => {
        try {
            await api.post(`/verification/verify/${actionId}`, { status });
            toast.success(`Action ${status} successfully`);
            loadAdminData();
        } catch (error) {
            toast.error('Verification failed');
        }
    };

    const handleCreateReward = async (e) => {
        e.preventDefault();
        try {
            if (rewardForm._id) {
                await api.put(`/marketplace/rewards/${rewardForm._id}`, rewardForm);
                toast.success('Reward updated successfully');
            } else {
                await api.post('/marketplace/rewards', rewardForm);
                toast.success('Reward created successfully');
            }
            setIsRewardModalOpen(false);
            setRewardForm({
                name: '', description: '', category: '', creditCost: 0, monetaryValue: 0, 
                stock: -1, validUntil: '', redemptionType: 'qr'
            });
            loadAdminData();
        } catch (error) {
            toast.error(rewardForm._id ? 'Failed to update reward' : 'Failed to create reward');
        }
    };

    const handleUpdateUser = async (userId, data) => {
        try {
            await api.put(`/admin/users/${userId}`, data);
            toast.success('User updated successfully');
            loadAdminData();
        } catch (error) {
            toast.error('Failed to update user');
        }
    };

    const handleDeleteListing = async (listingId) => {
        if (!window.confirm('Are you sure you want to cancel this listing? Credits will be returned to the seller.')) return;
        try {
            await api.delete(`/marketplace/listings/${listingId}`);
            toast.success('Listing cancelled successfully');
            loadAdminData();
        } catch (error) {
            toast.error('Failed to cancel listing');
        }
    };

    const openEditRewardModal = (reward) => {
        setRewardForm({
            ...reward,
            validUntil: reward.validUntil ? format(new Date(reward.validUntil), 'yyyy-MM-dd') : ''
        });
        setIsRewardModalOpen(true);
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
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Admin Control Center</h1>
                    <p className="text-gray-600">Manage GreenLedger ecosystem and verification</p>
                </div>
                <div className="flex space-x-3">
                    <a 
                        href="/admin/fraud" 
                        className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-all flex items-center"
                    >
                        <span className="mr-2">🛡️</span> Fraud Panel
                    </a>
                    <div className="bg-primary-100 text-primary-800 px-4 py-2 rounded-lg font-semibold flex items-center">
                        System Mode: Production
                    </div>
                </div>
            </div>

            {/* Admin Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500">
                    <p className="text-sm text-gray-500 uppercase">Total Users</p>
                    <p className="text-2xl font-bold">{stats?.counts?.users || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-yellow-500">
                    <p className="text-sm text-gray-500 uppercase">Pending Actions</p>
                    <p className="text-2xl font-bold">{pendingActions.length}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500">
                    <p className="text-sm text-gray-500 uppercase">Credits Circulated</p>
                    <p className="text-2xl font-bold">{(stats?.credits?.totalCredits || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-purple-500">
                    <p className="text-sm text-gray-500 uppercase">Institutions</p>
                    <p className="text-2xl font-bold">{stats?.counts?.institutions || 0}</p>
                </div>
            </div>

            {/* Main Tabs */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="border-b border-gray-200">
                    <nav className="flex">
                        {['overview', 'verification', 'marketplace', 'rewards', 'users', 'logs'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-4 text-sm font-medium capitalize outline-none transition-all ${
                                    activeTab === tab
                                        ? 'border-b-2 border-primary-600 text-primary-600 bg-primary-50'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'verification' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold">Pending Action Verifications</h2>
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {pendingActions.map((action) => (
                                        <tr key={action._id}>
                                            <td className="px-6 py-4 text-sm text-gray-900">{action.userName || 'Anonymous'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500 capitalize">{action.actionType}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {format(new Date(action.createdAt), 'dd MMM yyyy')}
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-2">
                                                <button
                                                    onClick={() => handleVerifyAction(action._id, 'approved')}
                                                    className="bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleVerifyAction(action._id, 'rejected')}
                                                    className="bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200"
                                                >
                                                    Reject
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {pendingActions.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                                                No pending actions to verify
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'marketplace' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold">Marketplace Listings</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {marketplaceListings.map((listing) => (
                                    <div key={listing._id} className="border rounded-lg p-4 bg-gray-50">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-semibold">{listing.title}</h3>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                listing.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200'
                                            }`}>
                                                {listing.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">Seller: {listing.sellerName}</p>
                                        <p className="text-lg font-bold text-primary-600">{listing.creditAmount} GC</p>
                                        <div className="mt-4 flex space-x-2">
                                            <button 
                                                onClick={() => window.open(`/marketplace/listing/${listing._id}`, '_blank')}
                                                className="text-xs text-blue-600 font-medium"
                                            >
                                                View Details
                                            </button>
                                            {listing.status === 'active' && (
                                                <button 
                                                    onClick={() => handleDeleteListing(listing._id)}
                                                    className="text-xs text-red-600 font-medium"
                                                >
                                                    Disable Listing
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'rewards' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold">Platform Rewards</h2>
                                <button 
                                    onClick={() => setIsRewardModalOpen(true)}
                                    className="bg-primary-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-primary-700"
                                >
                                    + Add New Reward
                                </button>
                            </div>
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reward Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Partner</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {rewards.map((reward) => (
                                        <tr key={reward._id}>
                                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">{reward.name}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{reward.partnerName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-900 font-bold">{reward.creditCost} GC</td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                    reward.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {reward.isActive ? 'Active' : 'Hidden'}
                                                </span>
                                            </td>
                                            <td 
                                                onClick={() => openEditRewardModal(reward)}
                                                className="px-6 py-4 text-right text-primary-600 cursor-pointer text-sm font-medium hover:underline"
                                            >
                                                Edit
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold">User Management</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Institution</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wallet</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {users.map((u) => (
                                            <tr key={u._id}>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        <div className="h-10 w-10 flex-shrink-0 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-500">
                                                            {u.name.charAt(0)}
                                                        </div>
                                                        <div className="ml-4">
                                                            <div className="text-sm font-medium text-gray-900">{u.name}</div>
                                                            <div className="text-sm text-gray-500">{u.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {u.institutionId?.name || 'Individual'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <select 
                                                        value={u.role}
                                                        onChange={(e) => handleUpdateUser(u._id, { role: e.target.value })}
                                                        className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer"
                                                    >
                                                        <option value="user">User</option>
                                                        <option value="partner">Partner</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                                                        u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                        {u.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-primary-600">
                                                    {u.walletBalance} GC
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button 
                                                        onClick={() => handleUpdateUser(u._id, { status: u.status === 'active' ? 'banned' : 'active' })}
                                                        className={`text-sm font-medium ${u.status === 'active' ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                                                    >
                                                        {u.status === 'active' ? 'Ban' : 'Unban'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold">Administrative Audit Logs</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {adminLogs.map((log) => (
                                            <tr key={log._id}>
                                                <td className="px-6 py-4 text-sm text-gray-900">
                                                    <div className="font-bold">{log.adminName}</div>
                                                    <div className="text-xs text-gray-500">{log.adminId?.email}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                        log.action.includes('REJECT') || log.action.includes('BAN') 
                                                        ? 'bg-red-100 text-red-700' 
                                                        : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {log.targetType} ({log.targetId?.toString().substring(log.targetId.length - 6)})
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {format(new Date(log.createdAt), 'dd MMM HH:mm')}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 italic">
                                                    {JSON.stringify(log.details)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-gray-50 p-6 rounded-xl">
                                <h3 className="text-lg font-bold mb-4">System Health</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Database Connection</span>
                                        <span className="text-green-600 font-bold">Stable</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">AI OCR Service</span>
                                        <span className="text-green-600 font-bold">Online</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Blockchain Sync</span>
                                        <span className="text-yellow-600 font-bold">Syncing (88%)</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-6 rounded-xl">
                                <h3 className="text-lg font-bold mb-4">Market Activity (30d)</h3>
                                <div className="h-40 flex items-end justify-between space-x-2">
                                    {[40, 65, 30, 85, 45, 90, 55].map((val, i) => (
                                        <div key={i} className="bg-primary-500 w-full rounded-t" style={{ height: `${val}%` }}></div>
                                    ))}
                                </div>
                                <div className="flex justify-between mt-2 text-xs text-gray-500">
                                    <span>Mon</span>
                                    <span>Tue</span>
                                    <span>Wed</span>
                                    <span>Thu</span>
                                    <span>Fri</span>
                                    <span>Sat</span>
                                    <span>Sun</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Reward Creation Modal */}
            <Transition appear show={isRewardModalOpen} as={Fragment}>
                <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={() => setIsRewardModalOpen(false)}>
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
                            <div className="inline-block w-full max-w-2xl p-8 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-2xl rounded-3xl">
                                <Dialog.Title as="h3" className="text-2xl font-bold text-gray-900 mb-6">
                                    {rewardForm._id ? 'Edit Ecosystem Reward' : 'Create New Ecosystem Reward'}
                                </Dialog.Title>

                                <form onSubmit={handleCreateReward} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Reward Name</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full px-4 py-2 border rounded-xl"
                                                value={rewardForm.name}
                                                onChange={(e) => setRewardForm({...rewardForm, name: e.target.value})}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                            <textarea
                                                required
                                                className="w-full px-4 py-2 border rounded-xl h-24"
                                                value={rewardForm.description}
                                                onChange={(e) => setRewardForm({...rewardForm, description: e.target.value})}
                                            ></textarea>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                            <select
                                                required
                                                className="w-full px-4 py-2 border rounded-xl"
                                                value={rewardForm.category}
                                                onChange={(e) => setRewardForm({...rewardForm, category: e.target.value})}
                                            >
                                                <option value="">Select...</option>
                                                <option value="Electronics">Electronics</option>
                                                <option value="Grocery">Grocery</option>
                                                <option value="Travel">Travel</option>
                                                <option value="Lifestyle">Lifestyle</option>
                                                <option value="Energy">Energy</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Credit Cost</label>
                                            <input
                                                type="number"
                                                required
                                                className="w-full px-4 py-2 border rounded-xl"
                                                value={rewardForm.creditCost}
                                                onChange={(e) => setRewardForm({...rewardForm, creditCost: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Monetary Value (₹)</label>
                                            <input
                                                type="number"
                                                required
                                                className="w-full px-4 py-2 border rounded-xl"
                                                value={rewardForm.monetaryValue}
                                                onChange={(e) => setRewardForm({...rewardForm, monetaryValue: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Stock (-1 for Unlimited)</label>
                                            <input
                                                type="number"
                                                required
                                                className="w-full px-4 py-2 border rounded-xl"
                                                value={rewardForm.stock}
                                                onChange={(e) => setRewardForm({...rewardForm, stock: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                                            <input
                                                type="date"
                                                required
                                                className="w-full px-4 py-2 border rounded-xl"
                                                value={rewardForm.validUntil}
                                                onChange={(e) => setRewardForm({...rewardForm, validUntil: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Partner Name</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Amazon, local store"
                                                className="w-full px-4 py-2 border rounded-xl"
                                                value={rewardForm.partnerName}
                                                onChange={(e) => setRewardForm({...rewardForm, partnerName: e.target.value})}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-8 flex space-x-4">
                                        <button
                                            type="button"
                                            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold"
                                            onClick={() => setIsRewardModalOpen(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700"
                                        >
                                            Create Reward
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

export default AdminDashboard;
