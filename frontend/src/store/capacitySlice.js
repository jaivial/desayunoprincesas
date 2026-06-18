/**
 * @fileoverview Capacity slice for real-time ticket availability
 * 
 * Manages ticket capacity state with:
 * - Initial REST API fetch on page load
 * - Real-time updates via WebSocket connection
 * - Automatic recalculation of available tickets
 * 
 * @module store/capacitySlice
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

/** Backend API base URL from environment */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/**
 * Async thunk to fetch current capacity from backend.
 * Called on initial page load before WebSocket connects.
 * 
 * @async
 * @function fetchCapacity
 * @returns {Promise<Object>} Capacity object with max, sold, and available counts
 * @throws {Error} When API request fails
 */
export const fetchCapacity = createAsyncThunk('capacity/fetch', async () => {
  const res = await fetch(`${API_URL}/api/public/capacity`);
  if (!res.ok) throw new Error('Failed to fetch capacity');
  return res.json();
});

/**
 * Capacity slice managing real-time ticket availability.
 * 
 * State shape:
 * @property {number} maxCapacity - Maximum event capacity from settings
 * @property {number} soldTickets - Total tickets sold (paid bookings)
 * @property {number} availableTickets - Remaining tickets (max - sold)
 * @property {boolean} loading - Whether initial fetch is in progress
 * @property {string|null} error - Error message if fetch failed
 */
const capacitySlice = createSlice({
  name: 'capacity',
  initialState: {
    maxCapacity: 0,
    soldTickets: 0,
    availableTickets: 0,
    loading: false,
    error: null,
  },
  reducers: {
    /**
     * Updates capacity from WebSocket message.
     * Called when server broadcasts capacity.updated event.
     * 
     * @param {Object} state - Current state
     * @param {Object} action - Action with payload
     * @param {number} action.payload.maxCapacity - New max capacity
     * @param {number} action.payload.soldTickets - New sold count
     * @param {number} action.payload.availableTickets - New available count
     */
    updateCapacity: (state, action) => {
      state.maxCapacity = action.payload.maxCapacity;
      state.soldTickets = action.payload.soldTickets;
      state.availableTickets = action.payload.availableTickets;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCapacity.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCapacity.fulfilled, (state, action) => {
        state.loading = false;
        state.maxCapacity = action.payload.maxCapacity;
        state.soldTickets = action.payload.soldTickets;
        state.availableTickets = action.payload.availableTickets;
      })
      .addCase(fetchCapacity.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export const { updateCapacity } = capacitySlice.actions;
export default capacitySlice.reducer;
