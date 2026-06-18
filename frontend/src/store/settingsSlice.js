/**
 * @fileoverview Settings slice for managing event configuration
 * 
 * Handles fetching and storing public settings from the backend API:
 * - Maximum capacity
 * - Adult and child ticket prices
 * - Event date
 * - Event information
 * 
 * @module store/settingsSlice
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

/** Backend API base URL from environment */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/**
 * Async thunk to fetch public settings from backend.
 * Called on app initialization to load event configuration.
 * 
 * @async
 * @function fetchSettings
 * @returns {Promise<Object>} Settings object from API
 * @throws {Error} When API request fails
 * 
 * @example
 * dispatch(fetchSettings());
 */
export const fetchSettings = createAsyncThunk('settings/fetch', async (dateId) => {
  const url = dateId
    ? `${API_URL}/api/public/settings?dateId=${dateId}`
    : `${API_URL}/api/public/settings`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
});

/**
 * Settings slice managing event configuration state.
 * 
 * @type {import('@reduxjs/toolkit').Slice}
 * 
 * State shape:
 * @property {Object|null} data - Settings data from API
 * @property {number} data.maxCapacity - Maximum event capacity
 * @property {number} data.adultPriceCents - Adult ticket price in cents
 * @property {number} data.childPriceCents - Child ticket price in cents
 * @property {string|null} data.eventDate - ISO date string of event
 * @property {boolean} loading - Whether settings are being fetched
 * @property {string|null} error - Error message if fetch failed
 */
const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export default settingsSlice.reducer;
