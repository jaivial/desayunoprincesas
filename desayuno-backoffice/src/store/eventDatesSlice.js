import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getAuthHeaders } from './authSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const fetchEventDates = createAsyncThunk('eventDates/fetch', async () => {
  const res = await fetch(`${API_URL}/api/admin/event-dates`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch event dates');
  return res.json();
});

export const createEventDate = createAsyncThunk('eventDates/create', async (date, { dispatch }) => {
  const res = await fetch(`${API_URL}/api/admin/event-dates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ date }),
  });
  if (!res.ok) throw new Error('Failed to create event date');
  await dispatch(fetchEventDates());
  return res.json();
});

export const patchEventDate = createAsyncThunk('eventDates/patch', async ({ id, data }, { dispatch }) => {
  const res = await fetch(`${API_URL}/api/admin/event-dates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update event date');
  await dispatch(fetchEventDates());
  return { id, data };
});

export const patchEventDatePacks = createAsyncThunk('eventDates/patchPacks', async ({ id, packs }, { dispatch }) => {
  const res = await fetch(`${API_URL}/api/admin/event-dates/${id}/packs`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(packs),
  });
  if (!res.ok) throw new Error('Failed to update event date packs');
  await dispatch(fetchEventDates());
  return { id, packs };
});

const eventDatesSlice = createSlice({
  name: 'eventDates',
  initialState: { list: [], loading: false, saving: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchEventDates.pending, (state) => { state.loading = true; })
      .addCase(fetchEventDates.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchEventDates.rejected, (state, action) => { state.loading = false; state.error = action.error.message; })
      .addCase(createEventDate.pending, (state) => { state.saving = true; })
      .addCase(createEventDate.fulfilled, (state) => { state.saving = false; })
      .addCase(createEventDate.rejected, (state) => { state.saving = false; })
      .addCase(patchEventDate.pending, (state) => { state.saving = true; })
      .addCase(patchEventDate.fulfilled, (state) => { state.saving = false; })
      .addCase(patchEventDate.rejected, (state) => { state.saving = false; })
      .addCase(patchEventDatePacks.pending, (state) => { state.saving = true; })
      .addCase(patchEventDatePacks.fulfilled, (state) => { state.saving = false; })
      .addCase(patchEventDatePacks.rejected, (state) => { state.saving = false; });
  },
});

export default eventDatesSlice.reducer;
