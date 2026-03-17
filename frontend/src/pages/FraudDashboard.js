import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../services/api';
import toast from 'react-hot-toast';

const FraudDashboard = () => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('new');
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [reviewNotes, setReviewNotes] = useState('');

    useEffect(() => {
        loadAlerts();
    }, [filter]);

    const loadAlerts = async () => {
        setLoading(true);
        try {
            const response = await api.get('/verification/fraud-alerts', {
                params: { status: filter }
            });
            setAlerts(response.data.data);
        } catch (error) {
            toast.error('Failed to load fraud alerts');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (alertId, status) => {
        try {
            await api.put(`/verification/fraud-alerts/${alertId}`, {
                status,
                reviewNotes
            });
            toast.success(`Alert marked as ${status}`);
            setSelectedAlert(null);
            setReviewNotes('');
            loadAlerts();
        } catch (error) {
            toast.error('Failed to update alert');
        }
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'critical': return 'bg-red-600 text-white';
            case 'high': return 'bg-red-100 text-red-800';
            case 'medium': return 'bg-yellow-100 text-yellow-800';
            case 'low': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Fraud & Risk Control</h1>
                    <p className="text-gray-600">AI-driven anomaly detection and security monitoring</p>
                </div>
                <div className="flex space-x-2">
                    {['new', 'investigating', 'confirmed', 'false_positive', 'all'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                filter === f 
                                ? 'bg-primary-600 text-white shadow-lg' 
                                : 'bg-white text-gray-600 border hover:bg-gray-50'
                            }`}
                        >
                            {f.replace('_', ' ').toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Alerts List */}
                <div className="lg:col-span-2 space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                        </div>
                    ) : alerts.length > 0 ? (
                        alerts.map((alert) => (
                            <div 
                                key={alert._id}
                                onClick={() => setSelectedAlert(alert)}
                                className={`bg-white p-6 rounded-2xl shadow-sm border-2 transition-all cursor-pointer hover:shadow-md ${
                                    selectedAlert?._id === alert._id ? 'border-primary-500' : 'border-transparent'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center space-x-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getSeverityColor(alert.severity)}`}>
                                            {alert.severity}
                                        </span>
                                        <h3 className="text-lg font-bold text-gray-900 capitalize">
                                            {alert.alertType.replace('_', ' ')}
                                        </h3>
                                    </div>
                                    <span className="text-sm text-gray-500">
                                        {format(new Date(alert.createdAt), 'dd MMM HH:mm')}
                                    </span>
                                </div>
                                
                                <p className="text-gray-600 mb-4 line-clamp-2">{alert.description}</p>
                                
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center space-x-4 text-gray-500">
                                        <span>User: <strong>{alert.userId?.name}</strong></span>
                                        <span>Confidence: <strong>{(alert.confidence * 100).toFixed(1)}%</strong></span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className={`w-2 h-2 rounded-full ${
                                            alert.status === 'new' ? 'bg-blue-500' :
                                            alert.status === 'confirmed' ? 'bg-red-500' : 'bg-green-500'
                                        }`}></span>
                                        <span className="capitalize font-medium text-gray-700">{alert.status}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="bg-gray-50 rounded-2xl p-12 text-center text-gray-500">
                            <div className="text-5xl mb-4">🛡️</div>
                            <p className="text-lg font-medium">No fraud alerts matching this filter</p>
                        </div>
                    )}
                </div>

                {/* Details Panel */}
                <div className="lg:col-span-1">
                    {selectedAlert ? (
                        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sticky top-8">
                            <h2 className="text-xl font-bold text-gray-900 mb-6">Alert Details</h2>
                            
                            <div className="space-y-6">
                                <div>
                                    <p className="text-xs uppercase font-bold text-gray-400 mb-1">Evidence Summary</p>
                                    <div className="bg-gray-50 p-4 rounded-xl text-sm font-mono break-all">
                                        {alert.evidence?.similarityScore && (
                                            <p className="mb-2">Similarity: {alert.evidence.similarityScore}</p>
                                        )}
                                        <p>Detected By: {selectedAlert.detectedBy}</p>
                                        <p>Model: {selectedAlert.modelVersion || 'v1.0.4-ensemble'}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs uppercase font-bold text-gray-400 mb-2">Internal Notes</p>
                                    <textarea
                                        value={reviewNotes}
                                        onChange={(e) => setReviewNotes(e.target.value)}
                                        placeholder="Add notes for the investigation..."
                                        className="w-full h-32 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                                    ></textarea>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => handleUpdateStatus(selectedAlert._id, 'false_positive')}
                                        className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200"
                                    >
                                        False Positive
                                    </button>
                                    <button
                                        onClick={() => handleUpdateStatus(selectedAlert._id, 'investigating')}
                                        className="px-4 py-3 bg-blue-100 text-blue-700 rounded-xl font-bold text-sm hover:bg-blue-200"
                                    >
                                        Investigate
                                    </button>
                                    <button
                                        onClick={() => handleUpdateStatus(selectedAlert._id, 'confirmed')}
                                        className="col-span-2 px-4 py-4 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-all active:scale-95"
                                    >
                                        Confirm Fraud & Block
                                    </button>
                                </div>

                                <div className="pt-4 border-t text-center">
                                    <a 
                                        href={`/admin/action/${selectedAlert.actionId}`}
                                        className="text-sm text-primary-600 font-bold hover:underline"
                                    >
                                        View Original Action Proof
                                    </a>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-primary-50 rounded-2xl p-8 border border-primary-100 text-center">
                            <h3 className="font-bold text-primary-900 mb-2">Select an alert</h3>
                            <p className="text-sm text-primary-700">Click on any fraud alert to view detailed evidence and take action.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FraudDashboard;
