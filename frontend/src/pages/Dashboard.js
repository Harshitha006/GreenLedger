import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { format, subDays } from 'date-fns';
import api from '../services/api';
import creditService from '../services/creditService';
import toast from 'react-hot-toast';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
);

const Dashboard = () => {
    const { user } = useSelector((state) => state.auth);
    const [stats, setStats] = useState(null);
    const [timeline, setTimeline] = useState(null);
    const [breakdown, setBreakdown] = useState(null);
    const [comparison, setComparison] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState('month');

    useEffect(() => {
        loadDashboardData();
        const interval = setInterval(loadNotifications, 60000); // Refresh notifications every minute
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedPeriod) {
            loadTimeline();
        }
    }, [selectedPeriod]);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [statsRes, breakdownRes, comparisonRes, notifRes] = await Promise.all([
                api.get('/dashboard/stats'),
                api.get('/dashboard/breakdown'),
                api.get('/dashboard/comparison'),
                api.get('/dashboard/notifications')
            ]);

            setStats(statsRes.data.data);
            setBreakdown(breakdownRes.data.data);
            setComparison(comparisonRes.data.data);
            setNotifications(notifRes.data.data.notifications);

            await loadTimeline();
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const loadTimeline = async () => {
        try {
            const response = await api.get(`/dashboard/timeline?period=${selectedPeriod}`);
            setTimeline(response.data.data);
        } catch (error) {
            console.error('Failed to load timeline:', error);
        }
    };

    const loadNotifications = async () => {
        try {
            const response = await api.get('/dashboard/notifications');
            setNotifications(response.data.data.notifications);
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    // Chart data preparation
    const timelineData = {
        labels: timeline?.timeline.map(day =>
            format(new Date(day._id.year, day._id.month - 1, day._id.day), 'dd MMM')
        ) || [],
        datasets: [
            {
                label: 'CO2 Saved (kg)',
                data: timeline?.timeline.map(day => day.co2Saved) || [],
                borderColor: 'rgb(34, 197, 94)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'Credits Earned',
                data: timeline?.timeline.map(day => day.credits) || [],
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
            }
        ]
    };

    const breakdownData = {
        labels: breakdown?.map(item =>
            item.type.charAt(0).toUpperCase() + item.type.slice(1)
        ) || [],
        datasets: [
            {
                data: breakdown?.map(item => item.count) || [],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(249, 115, 22, 0.8)',
                    'rgba(168, 85, 247, 0.8)',
                    'rgba(236, 72, 153, 0.8)',
                    'rgba(234, 179, 8, 0.8)'
                ],
                borderWidth: 0
            }
        ]
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                Welcome back, {user?.name?.split(' ')[0]}! 👋
                            </h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Here's your sustainability impact overview
                            </p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <Link
                                to="/upload"
                                className="btn-primary flex items-center"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                New Action
                            </Link>
                            <button
                                onClick={() => window.location.href = '/wallet'}
                                className="btn-secondary"
                            >
                                View Wallet
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Notifications Bar */}
                {notifications.length > 0 && (
                    <div className="mb-6 space-y-2">
                        {notifications.map((notif, index) => (
                            <div
                                key={index}
                                className={`flex items-center p-4 rounded-lg ${notif.priority === 'high' ? 'bg-red-50 border border-red-200' :
                                        notif.priority === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
                                            'bg-blue-50 border border-blue-200'
                                    }`}
                            >
                                <span className="text-2xl mr-3">{notif.icon}</span>
                                <div className="flex-1">
                                    <p className={`font-medium ${notif.priority === 'high' ? 'text-red-800' :
                                            notif.priority === 'medium' ? 'text-yellow-800' :
                                                'text-blue-800'
                                        }`}>
                                        {notif.title}
                                    </p>
                                    <p className={`text-sm ${notif.priority === 'high' ? 'text-red-600' :
                                            notif.priority === 'medium' ? 'text-yellow-600' :
                                                'text-blue-600'
                                        }`}>
                                        {notif.message}
                                    </p>
                                </div>
                                {notif.link && (
                                    <Link
                                        to={notif.link}
                                        className="ml-4 text-sm font-medium text-gray-700 hover:text-gray-900"
                                    >
                                        View →
                                    </Link>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Wallet Balance</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {creditService.formatCredits(stats.user.walletBalance)}
                                    </p>
                                    <p className="text-xs text-green-600 mt-2">
                                        ↑ Lifetime: {creditService.formatCredits(stats.user.totalCreditsEarned)}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                    <span className="text-2xl">💰</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-md p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">CO₂ Saved</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {stats.user.totalCO2Saved.toFixed(1)} kg
                                    </p>
                                    <p className="text-xs text-green-600 mt-2">
                                        ≈ {Math.round(stats.user.totalCO2Saved / 20)} trees
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-2xl">🌳</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-md p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Actions Verified</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {stats.user.verifiedActionsCount}
                                    </p>
                                    <p className="text-xs text-purple-600 mt-2">
                                        ↑ +{stats.recentActions?.length || 0} this month
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                    <span className="text-2xl">✅</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-md p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Sustainability Score</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {stats.user.sustainabilityScore}
                                    </p>
                                    <p className="text-xs text-blue-600 mt-2">
                                        {stats.user.institutionRank ? `Rank #${stats.user.institutionRank} in institution` : 'Top 10%'}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                                    <span className="text-2xl">🏆</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Charts */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Impact Timeline */}
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Impact Timeline</h3>
                                <div className="flex space-x-2">
                                    {['week', 'month', 'year'].map((period) => (
                                        <button
                                            key={period}
                                            onClick={() => setSelectedPeriod(period)}
                                            className={`px-3 py-1 text-sm rounded-lg ${selectedPeriod === period
                                                    ? 'bg-primary-600 text-white'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            {period.charAt(0).toUpperCase() + period.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="h-80">
                                <Line
                                    data={timelineData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                display: true,
                                                position: 'top'
                                            }
                                        },
                                        scales: {
                                            y: {
                                                beginAtZero: true,
                                                grid: {
                                                    color: 'rgba(0, 0, 0, 0.05)'
                                                }
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* Recent Actions */}
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Recent Actions</h3>
                                <Link to="/actions" className="text-sm text-primary-600 hover:text-primary-700">
                                    View All →
                                </Link>
                            </div>
                            <div className="space-y-3">
                                {stats?.recentActions.map((action) => (
                                    <div
                                        key={action._id}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                    >
                                        <div className="flex items-center">
                                            <span className="text-2xl mr-3">
                                                {action.actionType === 'electricity' ? '⚡' :
                                                    action.actionType === 'solar' ? '☀️' :
                                                        action.actionType === 'transport' ? '🚇' :
                                                            action.actionType === 'water' ? '💧' :
                                                                action.actionType === 'waste' ? '♻️' : '🌳'}
                                            </span>
                                            <div>
                                                <p className="font-medium text-gray-900">
                                                    {action.actionType.charAt(0).toUpperCase() + action.actionType.slice(1)}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {format(new Date(action.createdAt), 'dd MMM yyyy')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-green-600">
                                                +{action.impact?.creditsEarned || 0} credits
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {action.impact?.co2SavedKg?.toFixed(1)} kg CO₂
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Stats & Insights */}
                    <div className="space-y-6">
                        {/* Action Breakdown */}
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Action Breakdown</h3>
                            <div className="h-48 mb-4">
                                <Doughnut
                                    data={breakdownData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                display: false
                                            }
                                        },
                                        cutout: '65%'
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                {breakdown?.map((item, index) => (
                                    <div key={item.type} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center">
                                            <span
                                                className="w-3 h-3 rounded-full mr-2"
                                                style={{ backgroundColor: breakdownData.datasets[0].backgroundColor[index] }}
                                            ></span>
                                            <span className="text-gray-600">
                                                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                                            </span>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <span className="text-gray-900 font-medium">{item.count}</span>
                                            <span className="text-gray-500 text-xs">{item.percentage.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Peer Comparison */}
                        {comparison && (
                            <div className="bg-white rounded-xl shadow-md p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">vs. Peers</h3>

                                {/* Global Comparison */}
                                <div className="mb-4">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Global</p>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600">Your score</span>
                                            <span className="font-medium text-gray-900">{stats.user.sustainabilityScore}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600">Average</span>
                                            <span className="font-medium text-gray-900">{comparison.global.average?.score}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                            <div
                                                className="bg-primary-600 rounded-full h-2"
                                                style={{
                                                    width: `${(stats.user.sustainabilityScore / comparison.global.top?.score) * 100}%`
                                                }}
                                            ></div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            You're in the top {comparison.global.userPercentile?.score}%
                                        </p>
                                    </div>
                                </div>

                                {/* Institution Comparison */}
                                {comparison.institutional && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 mb-2">Institution</p>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-600">Your rank</span>
                                                <span className="font-medium text-gray-900">
                                                    #{comparison.institutional.rank} of {comparison.institutional.totalMembers}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-600">Institution avg</span>
                                                <span className="font-medium text-gray-900">{comparison.institutional.average?.score}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-600">Top score</span>
                                                <span className="font-medium text-gray-900">{comparison.institutional.top?.score}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Active Competitions */}
                        {stats?.activeCompetitions?.length > 0 && (
                            <div className="bg-white rounded-xl shadow-md p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Competitions</h3>
                                <div className="space-y-3">
                                    {stats.activeCompetitions.map((comp) => (
                                        <Link
                                            key={comp._id}
                                            to={`/competitions/${comp._id}`}
                                            className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                                        >
                                            <p className="font-medium text-gray-900">{comp.name}</p>
                                            <p className="text-sm text-gray-600 mt-1">{comp.description}</p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-gray-500">
                                                    Ends {format(new Date(comp.endDate), 'dd MMM')}
                                                </span>
                                                <span className="text-xs font-medium text-primary-600">
                                                    {comp.participants?.length || 0} participants
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick Tips */}
                        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-md p-6 text-white">
                            <h3 className="text-lg font-semibold mb-2">💡 Quick Tips</h3>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start">
                                    <span className="mr-2">•</span>
                                    Upload bills monthly to maintain your streak
                                </li>
                                <li className="flex items-start">
                                    <span className="mr-2">•</span>
                                    Different actions earn different credits
                                </li>
                                <li className="flex items-start">
                                    <span className="mr-2">•</span>
                                    Redeem credits at local partner stores
                                </li>
                                <li className="flex items-start">
                                    <span className="mr-2">•</span>
                                    Invite friends to earn bonus credits
                                </li>
                            </ul>
                            <button className="mt-4 w-full bg-white text-primary-600 py-2 rounded-lg font-medium hover:bg-gray-100 transition">
                                View All Tips
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
