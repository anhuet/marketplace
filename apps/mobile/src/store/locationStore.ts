import { create } from 'zustand';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationState {
  lastKnownLocation: Coordinates | null;
  setLastKnownLocation: (coords: Coordinates) => void;
  clearLocation: () => void;
}

/**
 * In-memory store for the device's last-known GPS coordinates.
 * Not persisted — stale coordinates on a fresh launch are better than a
 * persistent stale position from a previous session in a different city.
 */
export const useLocationStore = create<LocationState>()((set) => ({
  lastKnownLocation: null,
  setLastKnownLocation: (coords) => set({ lastKnownLocation: coords }),
  clearLocation: () => set({ lastKnownLocation: null }),
}));
