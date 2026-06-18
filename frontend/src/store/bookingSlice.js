/**
 * @fileoverview Booking slice for multi-step ticket purchase wizard
 */

import { createSlice } from '@reduxjs/toolkit';

/**
 * Selector: returns the list of packs loaded from the backend settings.
 * Packs are stored in the database and delivered via /api/public/settings.
 */
export const selectPacks = (state) => state.settings.data?.packs || [];

/**
 * Selector: returns a map of pack id -> pack object for quick lookup.
 */
export const selectPacksMap = (state) =>
  Object.fromEntries(selectPacks(state).map((p) => [p.id, p]));

/**
 * Selector: aggregate adults/children across packs (qty * pack composition)
 * plus the individual (non-pack) tickets. Used for capacity and allergies.
 */
export const selectBookingTotals = (state) => {
  const packsMap = selectPacksMap(state);
  const { packQuantities, adultsCount, childrenCount } = state.booking;
  let adults = adultsCount || 0;
  let children = childrenCount || 0;
  Object.entries(packQuantities || {}).forEach(([packId, qty]) => {
    const pack = packsMap[packId];
    if (pack && qty > 0) {
      adults += (pack.adults || 0) * qty;
      children += (pack.children || 0) * qty;
    }
  });
  return { adults, children, totalTickets: adults + children };
};

/**
 * Selector: builds the items payload sent to the backend (packs + individual).
 */
export const selectCartItems = (state) => {
  const { packQuantities, adultsCount, childrenCount } = state.booking;
  const items = [];
  Object.entries(packQuantities || {}).forEach(([packId, qty]) => {
    if (qty > 0) items.push({ itemType: 'pack', packType: packId, quantity: qty });
  });
  if ((adultsCount || 0) > 0 || (childrenCount || 0) > 0) {
    items.push({ itemType: 'individual', adultsCount: adultsCount || 0, childrenCount: childrenCount || 0 });
  }
  return items;
};

const initialState = {
  step: 1,
  packQuantities: {},
  adultsCount: 0,
  childrenCount: 0,
  name: '',
  surname: '',
  email: '',
  phoneCountryCode: '+34',
  phoneNumber: '',
  acceptedTerms: false,
  acceptedPrivacy: false,
  memberAllergies: [],
};

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    setStep: (state, action) => {
      state.step = action.payload;
    },
    setPackQuantity: (state, action) => {
      const { packId, quantity } = action.payload;
      if (quantity > 0) {
        state.packQuantities[packId] = quantity;
      } else {
        delete state.packQuantities[packId];
      }
    },
    setAdultsCount: (state, action) => {
      state.adultsCount = action.payload;
    },
    setChildrenCount: (state, action) => {
      state.childrenCount = action.payload;
    },
    setFormField: (state, action) => {
      const { field, value } = action.payload;
      state[field] = value;
    },
    setAcceptedTerms: (state, action) => {
      state.acceptedTerms = action.payload;
    },
    setAcceptedPrivacy: (state, action) => {
      state.acceptedPrivacy = action.payload;
    },
    setMemberAllergies: (state, action) => {
      state.memberAllergies = action.payload;
    },
    updateMemberAllergy: (state, action) => {
      const { memberType, memberIndex, data } = action.payload;
      const existingIndex = state.memberAllergies.findIndex(
        m => m.memberType === memberType && m.memberIndex === memberIndex
      );
      if (existingIndex >= 0) {
        state.memberAllergies[existingIndex] = { ...state.memberAllergies[existingIndex], ...data };
      } else {
        state.memberAllergies.push({ memberType, memberIndex, name: '', lastname: '', allergies: [], ...data });
      }
    },
    resetBooking: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setStep,
  setPackQuantity,
  setAdultsCount,
  setChildrenCount,
  setFormField,
  setAcceptedTerms,
  setAcceptedPrivacy,
  setMemberAllergies,
  updateMemberAllergy,
  resetBooking,
} = bookingSlice.actions;

export default bookingSlice.reducer;
