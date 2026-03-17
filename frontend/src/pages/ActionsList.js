import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../services/api';
import creditService from '../services/creditService';
import toast from 'react-hot-toast';

const ActionsList = () => {
    const { user } = useSelector((state) => state.auth);
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        status: 'all',
        type: 'all',
        page: 1
    });
    const [pagination, setPagination] = useState(null);

    useEffect(() => {
        loadActions();
    }, [filters]);

    const loadActions = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.status !== 'all') params.append('status', filters.status);
            if (filters.type !== 'all') params.append('type', filters.type);
            params.append('page', filters.page);
            params.append('limit', 10);

            const response = await api.get(`/actions/my-actions?${params.toString()}`);
            setActions(response.data.data);
            setPagination(response.data.pagination);
        } catch (error) {
            console.error('Failed to load actions:', error);
            toast.error('Failed to load actions');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: 'bg-yellow-100 text-yellow-800',
            verifying: 'bg-blue-100 text-blue-800',
            approved: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800',
            flagged: 'bg-orange-100 text-orange-800'
        };
        return badges[status] || 'bg-gray-100 text-gray-800';
    };

    const getActionIcon = (type) => {
        const icons = {
            electricity: '⚡',
            solar: '☀️',
            ev: '🚗',
            transport: '🚇',
            water: '💧',
            tree: '🌳'
        };
        return icons[type] || '📝';
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
                    <h1 className="text-3xl font-bold text-gray-900">My Actions</h1>
                    <p className="text-gray-600 mt-1">Track all your sustainability actions</p>
                </div>
                {user?.role !== 'admin' && (
                    <Link
                        to="/upload-action"
                        className="btn-primary"
                    >
                        + New Action
                    </Link>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-md p-4 mb-6">
                <div className="flex flex-wrap gap-4">
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                        className="input-field w-40"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="verifying">Verifying</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="flagged">Flagged</option>
                    </select>

                    <select
                        value={filters.type}
                        onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })}
                        className="input-field w-40"
                    >
                        <option value="all">All Types</option>
                        <option value="electricity">Electricity</option>
                        <option value="solar">Solar</option>
                        <option value="ev">EV</option>
                        <option value="transport">Transport</option>
                        <option value="water">Water</option>
                        <option value="tree">Tree</option>
                    </select>
                </div>
            </div>

            {/* Actions List */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                {actions.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">📭</div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No actions found</h3>
                        <p className="text-gray-600 mb-6">Start your sustainability journey today!</p>
                    </div>
                ) : (
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
                                        Details
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Impact
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {actions.map((action) => (
                                    <tr key={action._id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {format(new Date(action.createdAt), 'dd MMM yyyy')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <span className="text-2xl mr-2">{getActionIcon(action.actionType)}</span>
                                                <span className="text-sm font-medium text-gray-900">
                                                    {action.actionType.charAt(0).toUpperCase() + action.actionType.slice(1)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {action.extractedData?.billNumber && (
                                                <div>Bill: {action.extractedData.billNumber}</div>
                                            )}
                                            {action.extractedData?.unitsConsumed && (
                                                <div className="text-xs text-gray-500">
                                                    {action.extractedData.unitsConsumed} kWh
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {action.impact ? (
                                                <div>
                                                    <div className="text-sm font-medium text-green-600">
                                                        +{action.impact.creditsEarned} credits
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {action.impact.co2SavedKg?.toFixed(1)} kg CO₂
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(action.status)}`}>
                                                {action.status.charAt(0).toUpperCase() + action.status.slice(1)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <Link
                                                to={`/actions/${action._id}`}
                                                className="text-primary-600 hover:text-primary-900 font-medium"
                                            >
                                                View Details
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                                disabled={filters.page === 1}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-gray-700">
                                Page {pagination.page} of {pagination.pages}
                            </span>
                            <button
                                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                                disabled={filters.page === pagination.pages}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActionsList;
