import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import kpisReducer from './kpisSlice';
import bookingsReducer from './bookingsSlice';
import settingsReducer from './settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    kpis: kpisReducer,
    bookings: bookingsReducer,
    settings: settingsReducer,
  },
});
