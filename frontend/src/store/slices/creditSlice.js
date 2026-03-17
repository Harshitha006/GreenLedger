import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import creditService from '../../services/creditService';

export const fetchCreditSummary = createAsyncThunk(
    'credits/fetchSummary',
    async (_, { rejectWithValue }) => {
        try {
            const response = await creditService.getCreditSummary();
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch credit summary');
        }
    }
);

export const fetchCreditHistory = createAsyncThunk(
    'credits/fetchHistory',
    async (params, { rejectWithValue }) => {
        try {
            const response = await creditService.getCreditHistory(params);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch credit history');
        }
    }
);

const creditSlice = createSlice({
    name: 'credits',
    initialState: {
        summary: null,
        history: [],
        isLoading: false,
        error: null,
    },
    reducers: {
        clearCreditError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchCreditSummary.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(fetchCreditSummary.fulfilled, (state, action) => {
                state.isLoading = false;
                state.summary = action.payload;
            })
            .addCase(fetchCreditSummary.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            })
            .addCase(fetchCreditHistory.fulfilled, (state, action) => {
                state.history = action.payload;
            });
    },
});

export const { clearCreditError } = creditSlice.actions;
export default creditSlice.reducer;
