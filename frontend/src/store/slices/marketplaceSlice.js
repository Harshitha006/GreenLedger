import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import marketplaceService from '../../services/marketplaceService';

export const fetchListings = createAsyncThunk(
    'marketplace/fetchListings',
    async (params, { rejectWithValue }) => {
        try {
            const response = await marketplaceService.getListings(params);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch listings');
        }
    }
);

export const fetchRewards = createAsyncThunk(
    'marketplace/fetchRewards',
    async (params, { rejectWithValue }) => {
        try {
            const response = await marketplaceService.getRewards(params);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch rewards');
        }
    }
);

const marketplaceSlice = createSlice({
    name: 'marketplace',
    initialState: {
        listings: [],
        rewards: [],
        pagination: {},
        isLoading: false,
        error: null,
    },
    reducers: {
        clearMarketplaceError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchListings.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(fetchListings.fulfilled, (state, action) => {
                state.isLoading = false;
                state.listings = action.payload;
            })
            .addCase(fetchListings.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            })
            .addCase(fetchRewards.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(fetchRewards.fulfilled, (state, action) => {
                state.isLoading = false;
                state.rewards = action.payload;
            })
            .addCase(fetchRewards.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            });
    },
});

export const { clearMarketplaceError } = marketplaceSlice.actions;
export default marketplaceSlice.reducer;
