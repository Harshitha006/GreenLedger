import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { format } from 'date-fns';
import creditService from '../services/creditService';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import toast from 'react-hot-toast';

const CreditWallet = () => {
    const { user } = useSelector((state) => state.auth);
    const [summary, setSummary] = useState(null);
    const [history, setHistory] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('wallet');
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferData, setTransferData] = useState({
        toEmail: '',
        amount: '',
        description: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [summaryData, historyData, leaderboardData] = await Promise.all([
                creditService.getCreditSummary(),
                creditService.getCreditHistory({ limit: 20 }),
                creditService.getLeaderboard({ limit: 10 })
            ]);

            setSummary(summaryData.data);
            setHistory(historyData.data);
            setLeaderboard(leaderboardData.data);
        } catch (error) {
            console.error('Failed to load credit data:', error);
            toast.error('Failed to load credit data');
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async (e) => {
        e.preventDefault();

        try {
            const result = await creditService.transferCredits(
                transferData.toEmail,
                parseInt(transferData.amount),
                transferData.description
            );

            toast.success(`Successfully transferred ${transferData.amount} credits`);
            setIsTransferModalOpen(false);
            setTransferData({ toEmail: '', amount: '', description: '' });
            loadData(); // Refresh data
        } catch (error) {
            toast.error(error.response?.data?.message || 'Transfer failed');
        }
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
                    <h1 className="text-3xl font-bold text-gray-900">Credit Wallet</h1>
                    <p className="text-gray-600 mt-1">Manage and track your Green Credits</p>
                </div>
                <button
                    onClick={() => setIsTransferModalOpen(true)}
                    className="btn-primary flex items-center"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Transfer Credits
                </button>
            </div>

            {/* Credit Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg p-6 text-white">
                        <p className="text-sm opacity-90 mb-1">Current Balance</p>
                        <p className="text-3xl font-bold">{creditService.formatCredits(summary.currentBalance)}</p>
                        <p className="text-xs opacity-75 mt-2">Green Credits</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-6">
                        <p className="text-sm text-gray-600 mb-1">Total Earned</p>
                        <p className="text-2xl font-bold text-gray-900">{creditService.formatCredits(summary.totalEarned)}</p>
                        <p className="text-xs text-green-600 mt-2">↑ Lifetime earnings</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-6">
                        <p className="text-sm text-gray-600 mb-1">Total Redeemed</p>
                        <p className="text-2xl font-bold text-gray-900">{creditService.formatCredits(summary.totalRedeemed)}</p>
                        <p className="text-xs text-purple-600 mt-2">↓ {summary.utilizationRate}% utilization</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-6">
                        <p className="text-sm text-gray-600 mb-1">Sustainability Score</p>
                        <p className="text-2xl font-bold text-gray-900">{summary.sustainabilityScore}</p>
                        <p className="text-xs text-blue-600 mt-2">/100 points</p>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="flex space-x-8">
                    {['wallet', 'history', 'leaderboard'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${activeTab === tab
                                    ? 'border-primary-500 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'wallet' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Monthly Stats */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Activity</h3>
                        <div className="space-y-4">
                            {summary?.monthlyStats?.map((stat) => (
                                <div key={stat._id} className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">{stat._id}</span>
                                    <div className="flex items-center space-x-4">
                                        <span className="text-sm text-green-600">+{stat.earned}</span>
                                        <span className="text-sm text-red-600">-{stat.spent}</span>
                                        <div className="w-24 bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-primary-600 rounded-full h-2"
                                                style={{ width: `${(stat.earned / (stat.earned + stat.spent || 1)) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                        <div className="space-y-3">
                            <button
                                onClick={() => setIsTransferModalOpen(true)}
                                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                            >
                                <span className="text-sm font-medium">Transfer Credits</span>
                                <span className="text-2xl">↗️</span>
                            </button>
                            <button
                                onClick={() => window.location.href = '/marketplace'}
                                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                            >
                                <span className="text-sm font-medium">Browse Rewards</span>
                                <span className="text-2xl">🎁</span>
                            </button>
                            <button
                                onClick={() => window.location.href = '/upload'}
                                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                            >
                                <span className="text-sm font-medium">Upload Action</span>
                                <span className="text-2xl">📤</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'history' && history && (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Description
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Amount
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Balance
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {history.transactions.map((tx) => (
                                    <tr key={tx._id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {format(new Date(tx.createdAt), 'dd MMM yyyy')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-xl ${creditService.getTransactionColor(tx.type)}`}>
                                                {creditService.getTransactionIcon(tx.type)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {tx.description || tx.type}
                                            {tx.fromUser && <span className="text-xs text-gray-500 block">From: {tx.fromUser.name}</span>}
                                            {tx.toUser && <span className="text-xs text-gray-500 block">To: {tx.toUser.name}</span>}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${tx.type === 'earned' ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {tx.type === 'earned' ? '+' : '-'}{tx.amount}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                            {tx.balanceAfter?.toUser || tx.balanceAfter?.fromUser || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'leaderboard' && (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600">
                        <h3 className="text-lg font-semibold text-white">Top Contributors</h3>
                    </div>
                    <div className="divide-y divide-gray-200">
                        {leaderboard.map((user, index) => (
                            <div key={user._id} className="flex items-center px-6 py-4 hover:bg-gray-50">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                        index === 1 ? 'bg-gray-300 text-gray-700' :
                                            index === 2 ? 'bg-orange-300 text-orange-800' :
                                                'bg-gray-100 text-gray-600'
                                    }`}>
                                    {index + 1}
                                </div>
                                <div className="ml-4 flex-1">
                                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                                    <p className="text-xs text-gray-500">{user.institutionId?.name || 'Independent'}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-lg font-bold ${creditService.getCreditColorClass(user.walletBalance)}`}>
                                        {creditService.formatCredits(user.walletBalance)}
                                    </p>
                                    <p className="text-xs text-gray-500">credits</p>
                                </div>
                                <div className="ml-6 w-24">
                                    <div className="bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-primary-600 rounded-full h-2"
                                            style={{ width: `${user.sustainabilityScore}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-center mt-1">{user.sustainabilityScore} score</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Transfer Modal */}
            <Transition appear show={isTransferModalOpen} as={Fragment}>
                <Dialog
                    as="div"
                    className="fixed inset-0 z-10 overflow-y-auto"
                    onClose={() => setIsTransferModalOpen(false)}
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
                                    Transfer Green Credits
                                </Dialog.Title>

                                <form onSubmit={handleTransfer} className="mt-4 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Recipient Email
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={transferData.toEmail}
                                            onChange={(e) => setTransferData({ ...transferData, toEmail: e.target.value })}
                                            className="mt-1 block w-full input-field"
                                            placeholder="user@example.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Amount (Credits)
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            max="10000"
                                            value={transferData.amount}
                                            onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                                            className="mt-1 block w-full input-field"
                                            placeholder="Enter amount"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">
                                            Available: {creditService.formatCredits(summary?.currentBalance || 0)} credits
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Description (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={transferData.description}
                                            onChange={(e) => setTransferData({ ...transferData, description: e.target.value })}
                                            className="mt-1 block w-full input-field"
                                            placeholder="What's this for?"
                                            maxLength="200"
                                        />
                                    </div>

                                    <div className="mt-6 flex justify-end space-x-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsTransferModalOpen(false)}
                                            className="btn-secondary"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn-primary"
                                            disabled={!transferData.amount || !transferData.toEmail}
                                        >
                                            Transfer
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

export default CreditWallet;
