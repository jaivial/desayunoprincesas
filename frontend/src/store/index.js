/**
 * @fileoverview Redux store configuration for Desayuno con Princesas frontend
 * 
 * This store manages the global state for:
 * - Settings: Event configuration from backend (prices, dates, capacity)
 * - Capacity: Real-time ticket availability via WebSocket
 * - Booking: Multi-step booking wizard state
 * 
 * @module store
 * @see {@link ./settingsSlice.js} for settings state management
 * @see {@link ./capacitySlice.js} for capacity state management
 * @see {@link ./bookingSlice.js} for booking wizard state management
 */

import { configureStore } from '@reduxjs/toolkit';
import settingsReducer from './settingsSlice';
import capacityReducer from './capacitySlice';
import bookingReducer from './bookingSlice';

/**
 * Configured Redux store instance.
 * 
 * @type {import('@reduxjs/toolkit').EnhancedStore}
 * 
 * @example
 * // Access store in components
 * import { useSelector, useDispatch } from 'react-redux';
 * const settings = useSelector((state) => state.settings.data);
 * const dispatch = useDispatch();
 */
export const store = configureStore({
  reducer: {
    /** Event settings from backend */
    settings: settingsReducer,
    /** Real-time capacity data */
    capacity: capacityReducer,
    /** Booking wizard form state */
    booking: bookingReducer,
  },
});

/**
 * Root state type (for TypeScript usage)
 * @typedef {ReturnType<typeof store.getState>} RootState
 */

/**
 * Dispatch type (for TypeScript usage)
 * @typedef {typeof store.dispatch} AppDispatch
 */
