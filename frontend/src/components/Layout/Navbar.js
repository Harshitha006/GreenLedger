import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';

const Navbar = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useSelector((state) => state.auth);

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    if (!isAuthenticated) return null;

    return (
        <nav className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <Link to="/dashboard" className="flex items-center">
                            <span className="text-2xl font-bold text-primary-600">🌿 GreenLedger</span>
                        </Link>

                        <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                            <Link
                                to="/dashboard"
                                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900"
                            >
                                Dashboard
                            </Link>
                            <Link
                                to="/actions"
                                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900"
                            >
                                My Actions
                            </Link>
                            <Link
                                to="/wallet"
                                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900"
                            >
                                Wallet
                            </Link>
                            <Link
                                to="/marketplace"
                                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900"
                            >
                                Marketplace
                            </Link>
                            {user?.role === 'admin' && (
                                <Link
                                    to="/admin"
                                    className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900"
                                >
                                    Admin
                                </Link>
                            )}
                            {user?.role === 'admin' && (
                                <Link
                                    to="/admin/fraud"
                                    className="inline-flex items-center px-1 pt-1 text-sm font-medium text-red-500 hover:text-red-700"
                                >
                                    🛡️ Fraud
                                </Link>
                            )}
                            {user?.institutionId && (
                                <Link
                                    to="/institution"
                                    className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900"
                                >
                                    Institution
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center">
                        {/* Quick actions */}
                        <Link
                            to="/upload"
                            className="mr-4 btn-primary text-sm py-2"
                        >
                            + New Action
                        </Link>

                        {/* User menu */}
                        <Menu as="div" className="relative">
                            <Menu.Button className="flex items-center space-x-3 focus:outline-none">
                                <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                                    <p className="text-xs text-gray-500">{user?.walletBalance} credits</p>
                                </div>
                                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                                    {user?.profileImage ? (
                                        <img
                                            src={user.profileImage}
                                            alt={user.name}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-lg font-semibold text-primary-600">
                                            {user?.name?.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                            </Menu.Button>

                            <Transition
                                as={Fragment}
                                enter="transition ease-out duration-100"
                                enterFrom="transform opacity-0 scale-95"
                                enterTo="transform opacity-100 scale-100"
                                leave="transition ease-in duration-75"
                                leaveFrom="transform opacity-100 scale-100"
                                leaveTo="transform opacity-0 scale-95"
                            >
                                <Menu.Items className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50">
                                    <Menu.Item>
                                        {({ active }) => (
                                            <Link
                                                to="/profile"
                                                className={`${active ? 'bg-gray-100' : ''
                                                    } block px-4 py-2 text-sm text-gray-700`}
                                            >
                                                Your Profile
                                            </Link>
                                        )}
                                    </Menu.Item>
                                    <Menu.Item>
                                        {({ active }) => (
                                            <Link
                                                to="/wallet"
                                                className={`${active ? 'bg-gray-100' : ''
                                                    } block px-4 py-2 text-sm text-gray-700`}
                                            >
                                                Wallet
                                            </Link>
                                        )}
                                    </Menu.Item>
                                    <Menu.Item>
                                        {({ active }) => (
                                            <Link
                                                to="/settings"
                                                className={`${active ? 'bg-gray-100' : ''
                                                    } block px-4 py-2 text-sm text-gray-700`}
                                            >
                                                Settings
                                            </Link>
                                        )}
                                    </Menu.Item>
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                onClick={handleLogout}
                                                className={`${active ? 'bg-gray-100' : ''
                                                    } block w-full text-left px-4 py-2 text-sm text-red-600`}
                                            >
                                                Sign out
                                            </button>
                                        )}
                                    </Menu.Item>
                                </Menu.Items>
                            </Transition>
                        </Menu>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
