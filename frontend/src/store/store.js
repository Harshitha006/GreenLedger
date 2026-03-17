import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import actionReducer from './slices/actionSlice';
import creditReducer from './slices/creditSlice';
import marketplaceReducer from './slices/marketplaceSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        user: userReducer,
        actions: actionReducer,
        credits: creditReducer,
        marketplace: marketplaceReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }),
});
