import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getAuthHeaders } from './authSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const fetchBookings = createAsyncThunk('bookings/fetch', async (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
  const res = await fetch(`${API_URL}/api/admin/bookings?${params}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch bookings');
  return res.json();
});

export const updateBooking = createAsyncThunk('bookings/update', async ({ id, data }) => {
  const res = await fetch(`${API_URL}/api/admin/bookings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let message = 'No se han podido guardar los cambios';
    try {
      const response = await res.json();
      message = response.error || message;
    } catch {
      // Keep default message when API does not return JSON.
    }
    throw new Error(message);
  }
  return { id, data };
});

export const deleteBooking = createAsyncThunk('bookings/delete', async (id) => {
  const res = await fetch(`${API_URL}/api/admin/bookings/${id}`, {
    method: 'DELETE',
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error('Failed to delete booking');
  return id;
});

export const resendEmail = createAsyncThunk('bookings/resendEmail', async (id) => {
  const res = await fetch(`${API_URL}/api/admin/bookings/${id}/resend-email`, {
    method: 'POST',
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error('Failed to resend email');
  return id;
});

const bookingsSlice = createSlice({
  name: 'bookings',
  initialState: { list: [], loading: false, error: null, filters: {} },
  reducers: {
    setFilters: (state, action) => { state.filters = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBookings.pending, (state) => { state.loading = true; })
      .addCase(fetchBookings.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchBookings.rejected, (state, action) => { state.loading = false; state.error = action.error.message; })
      .addCase(deleteBooking.fulfilled, (state, action) => { state.list = state.list.filter(b => b.id !== action.payload); });
  },
});

export const { setFilters } = bookingsSlice.actions;
export default bookingsSlice.reducer;
