import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../services/api';
import { updateProfile } from '../store/slices/authSlice';
import toast from 'react-hot-toast';

const ProfileSchema = Yup.object().shape({
    name: Yup.string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name cannot exceed 50 characters'),
    phoneNumber: Yup.string()
        .matches(/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number')
        .nullable(),
    address: Yup.object().shape({
        street: Yup.string(),
        city: Yup.string(),
        state: Yup.string(),
        pincode: Yup.string()
            .matches(/^[0-9]{6}$/, 'Please enter a valid 6-digit pincode')
            .nullable()
    })
});

const Profile = () => {
    const dispatch = useDispatch();
    const { user } = useSelector((state) => state.auth);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const response = await api.get('/dashboard/stats');
            setStats(response.data.data);
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    };

    const handleSubmit = async (values, { setSubmitting }) => {
        try {
            await dispatch(updateProfile(values)).unwrap();
            toast.success('Profile updated successfully');
        } catch (error) {
            toast.error(error || 'Failed to update profile');
        } finally {
            setSubmitting(false);
        }
    };

    const handleExportData = async () => {
        try {
            const response = await api.get('/dashboard/export');
            const dataStr = JSON.stringify(response.data.data, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

            const exportFileDefaultName = `greenledger-export-${new Date().toISOString().split('T')[0]}.json`;

            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();

            toast.success('Data exported successfully');
        } catch (error) {
            toast.error('Failed to export data');
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile Settings</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Form */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">Personal Information</h3>

                        <Formik
                            initialValues={{
                                name: user?.name || '',
                                phoneNumber: user?.phoneNumber || '',
                                address: {
                                    street: user?.address?.street || '',
                                    city: user?.address?.city || '',
                                    state: user?.address?.state || '',
                                    pincode: user?.address?.pincode || ''
                                }
                            }}
                            validationSchema={ProfileSchema}
                            onSubmit={handleSubmit}
                        >
                            {({ isSubmitting }) => (
                                <Form className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            value={user?.email || ''}
                                            disabled
                                            className="input-field bg-gray-50"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">
                                            Email cannot be changed
                                        </p>
                                    </div>

                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                            Full Name
                                        </label>
                                        <Field
                                            type="text"
                                            id="name"
                                            name="name"
                                            className="input-field"
                                        />
                                        <ErrorMessage name="name" component="p" className="mt-1 text-sm text-red-600" />
                                    </div>

                                    <div>
                                        <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                                            Phone Number
                                        </label>
                                        <Field
                                            type="tel"
                                            id="phoneNumber"
                                            name="phoneNumber"
                                            className="input-field"
                                            placeholder="10-digit mobile number"
                                        />
                                        <ErrorMessage name="phoneNumber" component="p" className="mt-1 text-sm text-red-600" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label htmlFor="address.street" className="block text-sm font-medium text-gray-700 mb-2">
                                                Street Address
                                            </label>
                                            <Field
                                                type="text"
                                                id="address.street"
                                                name="address.street"
                                                className="input-field"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="address.city" className="block text-sm font-medium text-gray-700 mb-2">
                                                City
                                            </label>
                                            <Field
                                                type="text"
                                                id="address.city"
                                                name="address.city"
                                                className="input-field"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="address.state" className="block text-sm font-medium text-gray-700 mb-2">
                                                State
                                            </label>
                                            <Field
                                                type="text"
                                                id="address.state"
                                                name="address.state"
                                                className="input-field"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="address.pincode" className="block text-sm font-medium text-gray-700 mb-2">
                                                Pincode
                                            </label>
                                            <Field
                                                type="text"
                                                id="address.pincode"
                                                name="address.pincode"
                                                className="input-field"
                                                placeholder="6-digit pincode"
                                            />
                                            <ErrorMessage name="address.pincode" component="p" className="mt-1 text-sm text-red-600" />
                                        </div>
                                    </div>

                                    <div className="flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="btn-primary"
                                        >
                                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </Form>
                            )}
                        </Formik>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Profile Summary */}
                    <div className="bg-white rounded-xl shadow-md p-6 text-center">
                        <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            {user?.profileImage ? (
                                <img
                                    src={user.profileImage}
                                    alt={user.name}
                                    className="w-full h-full rounded-full object-cover"
                                />
                            ) : (
                                <span className="text-4xl text-primary-600">
                                    {user?.name?.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">{user?.name}</h3>
                        <p className="text-sm text-gray-600 mb-4">{user?.email}</p>
                        <div className="flex justify-center space-x-4">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-primary-600">{stats?.user?.verifiedActionsCount || 0}</p>
                                <p className="text-xs text-gray-600">Actions</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-primary-600">{stats?.user?.sustainabilityScore || 0}</p>
                                <p className="text-xs text-gray-600">Score</p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                        <div className="space-y-3">
                            <button
                                onClick={handleExportData}
                                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                            >
                                <span className="text-sm font-medium">Export My Data</span>
                                <span className="text-xl">📥</span>
                            </button>
                            <button
                                onClick={() => window.location.href = '/change-password'}
                                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                            >
                                <span className="text-sm font-medium">Change Password</span>
                                <span className="text-xl">🔐</span>
                            </button>
                            <button
                                onClick={() => window.location.href = '/preferences'}
                                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                            >
                                <span className="text-sm font-medium">Notification Settings</span>
                                <span className="text-xl">🔔</span>
                            </button>
                        </div>
                    </div>

                    {/* Account Info */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
                        <dl className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <dt className="text-gray-600">Member since</dt>
                                <dd className="font-medium text-gray-900">
                                    {user?.createdAt ? format(new Date(user.createdAt), 'dd MMM yyyy') : 'N/A'}
                                </dd>
                            </div>
                            <div className="flex justify-between text-sm">
                                <dt className="text-gray-600">Account type</dt>
                                <dd className="font-medium text-gray-900 capitalize">{user?.role}</dd>
                            </div>
                            <div className="flex justify-between text-sm">
                                <dt className="text-gray-600">Email verified</dt>
                                <dd className="font-medium text-gray-900">
                                    {user?.isEmailVerified ? (
                                        <span className="text-green-600">✓ Yes</span>
                                    ) : (
                                        <span className="text-red-600">✗ No</span>
                                    )}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
