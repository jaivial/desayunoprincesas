import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getAuthHeaders } from './authSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const fetchSettings = createAsyncThunk('settings/fetch', async () => {
  const res = await fetch(`${API_URL}/api/admin/settings`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
});

export const updateSettings = createAsyncThunk('settings/update', async (data) => {
  const res = await fetch(`${API_URL}/api/admin/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return data;
});

// savePack creates or updates a single pack by reusing the settings endpoint,
// then refreshes settings so the packs list stays in sync.
export const savePack = createAsyncThunk('settings/savePack', async (pack, { dispatch }) => {
  const res = await fetch(`${API_URL}/api/admin/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ packs: [pack] }),
  });
  if (!res.ok) throw new Error('Failed to save pack');
  await dispatch(fetchSettings()).unwrap();
  return pack;
});

const settingsSlice = createSlice({
  name: 'settings',
  initialState: { data: null, loading: false, error: null, saving: false },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => { state.loading = true; })
      .addCase(fetchSettings.fulfilled, (state, action) => { state.loading = false; state.data = action.payload; })
      .addCase(fetchSettings.rejected, (state, action) => { state.loading = false; state.error = action.error.message; })
      .addCase(updateSettings.pending, (state) => { state.saving = true; })
      .addCase(updateSettings.fulfilled, (state, action) => { state.saving = false; state.data = { ...state.data, ...action.payload }; })
      .addCase(updateSettings.rejected, (state) => { state.saving = false; })
      .addCase(savePack.pending, (state) => { state.saving = true; })
      .addCase(savePack.fulfilled, (state) => { state.saving = false; })
      .addCase(savePack.rejected, (state) => { state.saving = false; });
  },
});

export default settingsSlice.reducer;
