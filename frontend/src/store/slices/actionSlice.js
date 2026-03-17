import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchMyActions = createAsyncThunk(
    'actions/fetchMyActions',
    async (params, { rejectWithValue }) => {
        try {
            const response = await api.get('/actions/my-actions', { params });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch actions');
        }
    }
);

export const fetchActionById = createAsyncThunk(
    'actions/fetchActionById',
    async (id, { rejectWithValue }) => {
        try {
            const response = await api.get(`/actions/${id}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch action');
        }
    }
);

const actionSlice = createSlice({
    name: 'actions',
    initialState: {
        actions: [],
        currentAction: null,
        pagination: {},
        isLoading: false,
        error: null,
    },
    reducers: {
        clearActionError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchMyActions.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(fetchMyActions.fulfilled, (state, action) => {
                state.isLoading = false;
                state.actions = action.payload.data;
                state.pagination = action.payload.pagination;
            })
            .addCase(fetchMyActions.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            })
            .addCase(fetchActionById.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(fetchActionById.fulfilled, (state, action) => {
                state.isLoading = false;
                state.currentAction = action.payload.data;
            })
            .addCase(fetchActionById.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            });
    },
});

export const { clearActionError } = actionSlice.actions;
export default actionSlice.reducer;
