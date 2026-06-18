import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getAuthHeaders } from './authSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const fetchKpis = createAsyncThunk('kpis/fetch', async () => {
  const res = await fetch(`${API_URL}/api/admin/kpis`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch KPIs');
  return res.json();
});

const kpisSlice = createSlice({
  name: 'kpis',
  initialState: { data: null, loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchKpis.pending, (state) => { state.loading = true; })
      .addCase(fetchKpis.fulfilled, (state, action) => { state.loading = false; state.data = action.payload; })
      .addCase(fetchKpis.rejected, (state, action) => { state.loading = false; state.error = action.error.message; });
  },
});

export default kpisSlice.reducer;
