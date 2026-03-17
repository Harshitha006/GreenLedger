import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layout Components
import Layout from './components/Layout/Layout';
import PrivateRoute from './components/Auth/PrivateRoute';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import UploadAction from './pages/UploadAction';
import Profile from './pages/Profile';
import Marketplace from './pages/Marketplace';
import ListingDetails from './pages/ListingDetails';
import MyListings from './pages/MyListings';
import RewardDetails from './pages/RewardDetails';
import AdminDashboard from './pages/AdminDashboard';
import FraudDashboard from './pages/FraudDashboard';
import InstitutionDashboard from './pages/InstitutionDashboard';
import ActionsList from './pages/ActionsList';
import ActionDetails from './pages/ActionDetails';
import CreditWallet from './pages/CreditWallet';

function App() {
    return (
        <>
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: '#363636',
                        color: '#fff',
                    },
                    success: {
                        duration: 3000,
                        iconTheme: {
                            primary: '#22c55e',
                            secondary: '#fff',
                        },
                    },
                    error: {
                        duration: 4000,
                        iconTheme: {
                            primary: '#ef4444',
                            secondary: '#fff',
                        },
                    },
                }}
            />

            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />

                    <Route path="dashboard" element={
                        <PrivateRoute>
                            <Dashboard />
                        </PrivateRoute>
                    } />

                    <Route path="upload-action" element={
                        <PrivateRoute>
                            <UploadAction />
                        </PrivateRoute>
                    } />

                    <Route path="actions" element={
                        <PrivateRoute>
                            <ActionsList />
                        </PrivateRoute>
                    } />

                    <Route path="actions/:id" element={
                        <PrivateRoute>
                            <ActionDetails />
                        </PrivateRoute>
                    } />

                    <Route path="wallet" element={
                        <PrivateRoute>
                            <CreditWallet />
                        </PrivateRoute>
                    } />

                    <Route path="marketplace" element={
                        <PrivateRoute>
                            <Marketplace />
                        </PrivateRoute>
                    } />

                    <Route path="marketplace/listing/:id" element={
                        <PrivateRoute>
                            <ListingDetails />
                        </PrivateRoute>
                    } />

                    <Route path="marketplace/reward/:id" element={
                        <PrivateRoute>
                            <RewardDetails />
                        </PrivateRoute>
                    } />

                    <Route path="my-listings" element={
                        <PrivateRoute>
                            <MyListings />
                        </PrivateRoute>
                    } />

                    <Route path="profile" element={
                        <PrivateRoute>
                            <Profile />
                        </PrivateRoute>
                    } />

                    <Route path="admin" element={
                        <PrivateRoute adminOnly={true}>
                            <AdminDashboard />
                        </PrivateRoute>
                    } />

                    <Route path="admin/fraud" element={
                        <PrivateRoute adminOnly={true}>
                            <FraudDashboard />
                        </PrivateRoute>
                    } />

                    <Route path="institution" element={
                        <PrivateRoute>
                            <InstitutionDashboard />
                        </PrivateRoute>
                    } />
                </Route>
            </Routes>
        </>
    );
}

export default App;
