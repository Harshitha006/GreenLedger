import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../services/api';
import creditService from '../services/creditService';
import toast from 'react-hot-toast';

const ActionDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [action, setAction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [verificationDetails, setVerificationDetails] = useState(false);

    useEffect(() => {
        loadAction();
    }, [id]);

    const loadAction = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/actions/${id}`);
            setAction(response.data.data);
        } catch (error) {
            console.error('Failed to load action:', error);
            toast.error('Failed to load action details');
            navigate('/actions');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: 'bg-yellow-100 text-yellow-800',
            verifying: 'bg-blue-100 text-blue-800',
            approved: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800',
            flagged: 'bg-orange-100 text-orange-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const getActionIcon = (type) => {
        const icons = {
            electricity: '⚡',
            solar: '☀️',
            ev: '🚗',
            transport: '🚇',
            water: '💧',
            waste: '♻️',
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

    if (!action) return null;

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => navigate('/actions')}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                >
                    <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Actions
                </button>

                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <span className="text-4xl mr-3">{getActionIcon(action.actionType)}</span>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                {action.actionType.charAt(0).toUpperCase() + action.actionType.slice(1)} Action
                            </h1>
                            <p className="text-gray-600">
                                Submitted on {format(new Date(action.createdAt), 'dd MMMM yyyy, h:mm a')}
                            </p>
                        </div>
                    </div>
                    <span className={`px-4 py-2 text-sm font-medium rounded-full ${getStatusColor(action.status)}`}>
                        {action.status.charAt(0).toUpperCase() + action.status.slice(1)}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Proof Documents */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Proof Documents</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {action.proofUrls.map((url, index) => (
                                <a
                                    key={index}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block aspect-square bg-gray-100 rounded-lg overflow-hidden hover:opacity-90 transition"
                                >
                                    {url.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                        <img src={url} alt={`Proof ${index + 1}`} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="text-4xl">📄</span>
                                        </div>
                                    )}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Extracted Data */}
                    {action.extractedData && Object.keys(action.extractedData).length > 0 && (
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Extracted Information</h3>
                            <dl className="grid grid-cols-2 gap-4">
                                {Object.entries(action.extractedData).map(([key, value]) => (
                                    value && (
                                        <div key={key}>
                                            <dt className="text-sm text-gray-500 capitalize">
                                                {key.replace(/([A-Z])/g, ' $1').trim()}
                                            </dt>
                                            <dd className="mt-1 text-sm font-medium text-gray-900">
                                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                            </dd>
                                        </div>
                                    )
                                ))}
                            </dl>
                        </div>
                    )}

                    {/* Impact Calculation */}
                    {action.impact && (
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Impact Summary</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 rounded-lg p-4">
                                    <p className="text-sm text-green-600 mb-1">CO₂ Saved</p>
                                    <p className="text-2xl font-bold text-green-700">{action.impact.co2SavedKg?.toFixed(1)} kg</p>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-4">
                                    <p className="text-sm text-blue-600 mb-1">Credits Earned</p>
                                    <p className="text-2xl font-bold text-blue-700">+{action.impact.creditsEarned}</p>
                                </div>
                                {action.impact.energySavedKwh > 0 && (
                                    <div className="bg-purple-50 rounded-lg p-4">
                                        <p className="text-sm text-purple-600 mb-1">Energy Saved</p>
                                        <p className="text-2xl font-bold text-purple-700">{action.impact.energySavedKwh} kWh</p>
                                    </div>
                                )}
                                {action.impact.waterSavedL > 0 && (
                                    <div className="bg-indigo-50 rounded-lg p-4">
                                        <p className="text-sm text-indigo-600 mb-1">Water Saved</p>
                                        <p className="text-2xl font-bold text-indigo-700">{action.impact.waterSavedL} L</p>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-4">
                                Calculated using: {action.impact.calculationFormula}
                            </p>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Status Timeline */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Timeline</h3>
                        <div className="space-y-4">
                            <div className="flex items-start">
                                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                    <span className="text-green-600">✓</span>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-900">Submitted</p>
                                    <p className="text-xs text-gray-500">{format(new Date(action.createdAt), 'dd MMM yyyy, HH:mm')}</p>
                                </div>
                            </div>

                            {action.verifiedAt && (
                                <div className="flex items-start">
                                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="text-blue-600">✓</span>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-gray-900">Verified</p>
                                        <p className="text-xs text-gray-500">{format(new Date(action.verifiedAt), 'dd MMM yyyy, HH:mm')}</p>
                                    </div>
                                </div>
                            )}

                            {action.status === 'approved' && action.creditsIssuedAt && (
                                <div className="flex items-start">
                                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                        <span className="text-green-600">✓</span>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-gray-900">Credits Issued</p>
                                        <p className="text-xs text-gray-500">{format(new Date(action.creditsIssuedAt), 'dd MMM yyyy, HH:mm')}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Verification Results */}
                    {action.verificationResults && (
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Results</h3>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Overall Confidence</span>
                                        <span className="font-medium">
                                            {(action.verificationResults.overallConfidence * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                        <div
                                            className="bg-primary-600 rounded-full h-2"
                                            style={{ width: `${action.verificationResults.overallConfidence * 100}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {action.verificationResults.layers && (
                                    <div className="mt-4 space-y-2">
                                        {Object.entries(action.verificationResults.layers).map(([layer, result]) => (
                                            <div key={layer} className="flex items-center justify-between text-sm">
                                                <span className="text-gray-600 capitalize">
                                                    {layer.replace(/([A-Z])/g, ' $1').trim()}
                                                </span>
                                                <span className={`font-medium ${result.passed ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                    {result.passed ? '✓ Passed' : '✗ Failed'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {action.verificationResults.fraudDetection && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <p className="text-sm font-medium text-gray-900 mb-2">Fraud Detection</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Risk Level</span>
                                        <span className={`text-sm font-medium px-2 py-1 rounded ${action.verificationResults.fraudDetection.riskLevel === 'LOW' ? 'bg-green-100 text-green-800' :
                                                action.verificationResults.fraudDetection.riskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                            }`}>
                                            {action.verificationResults.fraudDetection.riskLevel}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Admin Actions (if user is admin) */}
                    {action.status === 'pending' && window.userRole === 'admin' && (
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Actions</h3>
                            <div className="space-y-3">
                                <button className="w-full btn-primary">
                                    Approve Action
                                </button>
                                <button className="w-full btn-secondary">
                                    Request Changes
                                </button>
                                <button className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700">
                                    Reject Action
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActionDetails;
