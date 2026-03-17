import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import api from '../services/api';
import toast from 'react-hot-toast';

const InstitutionDashboard = () => {
    const { user } = useSelector((state) => state.auth);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('leaderboard');

    useEffect(() => {
        loadInstitutionData();
    }, []);

    const loadInstitutionData = async () => {
        setLoading(true);
        try {
            const response = await api.get('/institutions/my');
            setData(response.data.data);
        } catch (error) {
            console.error('Failed to load institution data:', error);
            toast.error('Failed to load institution dashboard');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (!data) return <div className="p-8 text-center text-gray-500">No institution data found.</div>;

    const { institution, summary, topPerformers, monthlyTrend } = data;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Header section with Institution Info */}
            <div className="bg-white rounded-3xl shadow-xl p-8 mb-8 flex flex-col md:flex-row items-center justify-between border border-gray-100">
                <div className="flex items-center mb-6 md:mb-0">
                    <div className="h-20 w-20 bg-primary-100 rounded-2xl flex items-center justify-center text-3xl mr-6">
                        🏫
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{institution.name}</h1>
                        <p className="text-gray-500 flex items-center">
                            <span className="mr-2 capitalize">{institution.type} Dashboard</span>
                            • <span className="ml-2">{summary.totalMembers} active members</span>
                        </p>
                    </div>
                </div>
                <div className="flex space-x-3">
                    <button 
                        onClick={() => loadInstitutionData()}
                        className="bg-gray-100 text-gray-700 font-bold py-3 px-6 rounded-2xl hover:bg-gray-200 transition-all flex items-center"
                    >
                        Refresh Stats
                    </button>
                    <button className="bg-primary-600 text-white font-bold py-3 px-6 rounded-2xl hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all active:scale-95">
                        Download Report
                    </button>
                </div>
            </div>

            {/* Impact Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-3xl text-white shadow-lg">
                    <p className="text-blue-100 text-sm font-bold uppercase tracking-wider mb-1">Total Impact</p>
                    <h3 className="text-3xl font-black">{summary.totalCO2.toLocaleString()} kg</h3>
                    <p className="text-blue-100 text-xs mt-2 font-medium">CO2 Emissions Saved</p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-3xl text-white shadow-lg">
                    <p className="text-green-100 text-sm font-bold uppercase tracking-wider mb-1">Total Credits</p>
                    <h3 className="text-3xl font-black">{summary.totalCredits.toLocaleString()} GC</h3>
                    <p className="text-green-100 text-xs mt-2 font-medium">Earned by all members</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-1">Avg. Score</p>
                    <h3 className="text-3xl font-black text-gray-800">{Math.round(summary.avgSustainabilityScore)} pts</h3>
                    <div className="w-full bg-gray-100 h-2 rounded-full mt-3">
                        <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${Math.min(summary.avgSustainabilityScore, 100)}%` }}></div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-1">Resource Saving</p>
                    <h3 className="text-2xl font-black text-gray-800">{summary.totalEnergy.toLocaleString()} kWh</h3>
                    <p className="text-gray-400 text-xs mt-1 font-medium">{summary.totalWater.toLocaleString()} Liters of Water</p>
                </div>
            </div>

            {/* Main Content Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Side: Performance Metrics & Leaderboard */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-gray-50">
                        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                            <div className="flex space-x-6">
                                <button 
                                    onClick={() => setActiveTab('leaderboard')}
                                    className={`text-sm font-bold pb-2 transition-all ${activeTab === 'leaderboard' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}
                                >
                                    Top Performers
                                </button>
                                <button 
                                    onClick={() => setActiveTab('trend')}
                                    className={`text-sm font-bold pb-2 transition-all ${activeTab === 'trend' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}
                                >
                                    Growth Trend
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            {activeTab === 'leaderboard' && (
                                <div className="space-y-4">
                                    {topPerformers.map((p, idx) => (
                                        <div key={p._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all">
                                            <div className="flex items-center">
                                                <div className="font-black text-gray-300 text-xl mr-6 w-6">#{idx + 1}</div>
                                                <div className="h-12 w-12 bg-white rounded-xl shadow-sm mr-4 flex items-center justify-center text-xl">
                                                    {p.profileImage ? <img src={p.profileImage} alt="" className="rounded-xl" /> : '👤'}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900">{p.name}</h4>
                                                    <p className="text-xs text-gray-500">{p.totalCO2Saved}kg CO2 saved</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-primary-600 font-black text-lg">{p.sustainabilityScore}</span>
                                                <span className="text-xs text-gray-400 block uppercase font-bold">Points</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'trend' && (
                                <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                                    <div className="flex items-end space-x-2 h-48 mb-6">
                                        {monthlyTrend.map((t, i) => (
                                            <div 
                                                key={i} 
                                                className="bg-primary-500 rounded-t-lg transition-all hover:bg-primary-600 cursor-pointer group relative"
                                                style={{ height: `${(t.co2 / Math.max(...monthlyTrend.map(x => x.co2 || 1))) * 100}%`, width: '20px' }}
                                            >
                                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                                                    {t.co2} kg
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-sm font-medium">Daily CO2 Saving Trend (Last 30 Days)</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: Quick Stats & Info */}
                <div className="space-y-8">
                    <div className="bg-primary-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold mb-4">Eco-Advantage Plan</h3>
                            <p className="text-primary-200 text-sm mb-6 leading-relaxed">
                                Your institution is currently in the <strong>Top 10%</strong> of organizations globally.
                            </p>
                            <div className="p-4 bg-primary-800/50 rounded-2xl border border-primary-700 mb-6">
                                <div className="flex justify-between text-xs font-bold uppercase mb-2">
                                    <span>Goal Progress</span>
                                    <span>{Math.round((summary.totalCO2 / 10000) * 100)}%</span>
                                </div>
                                <div className="w-full bg-primary-900 h-2 rounded-full">
                                    <div className="bg-green-400 h-2 rounded-full" style={{ width: `${Math.min((summary.totalCO2 / 10000) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                            <button className="w-full bg-white text-primary-900 font-bold py-3 rounded-2xl hover:bg-primary-50 transition-all">
                                View Plan Details
                            </button>
                        </div>
                        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-primary-600 rounded-full blur-3xl opacity-20"></div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-lg p-8 border border-gray-100">
                        <h3 className="text-lg font-bold mb-6 flex items-center">
                            <span className="mr-2">💡</span> Sustainability Tips
                        </h3>
                        <div className="space-y-6">
                            <div className="flex items-start">
                                <span className="bg-yellow-100 text-yellow-600 p-2 rounded-xl mr-4">☀️</span>
                                <div>
                                    <h4 className="font-bold text-sm">Solar Peak Hours</h4>
                                    <p className="text-xs text-gray-500 mt-1">Encourage members to run high-energy tasks between 10am-2pm.</p>
                                </div>
                            </div>
                            <div className="flex items-start">
                                <span className="bg-blue-100 text-blue-600 p-2 rounded-xl mr-4">💧</span>
                                <div>
                                    <h4 className="font-bold text-sm">Water Contest</h4>
                                    <p className="text-xs text-gray-500 mt-1">Next week is 'Water Wise' week. Top saver gets 500 bonus GC.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstitutionDashboard;
