import { create } from 'zustand';
import { api } from '../lib/api';

interface SavedState {
  savedIds: Set<string>;
  loading: boolean;
  fetchSavedIds: () => Promise<void>;
  toggleSave: (listingId: string) => Promise<void>;
  isSaved: (listingId: string) => boolean;
  clear: () => void;
}

export const useSavedStore = create<SavedState>()((set, get) => ({
  savedIds: new Set<string>(),
  loading: false,

  fetchSavedIds: async () => {
    try {
      set({ loading: true });
      const response = await api.getSavedIds();
      const ids = (response.data as { listingIds: string[] }).listingIds;
      set({ savedIds: new Set(ids) });
    } catch {
      // Non-critical — saved state will be empty until next fetch
    } finally {
      set({ loading: false });
    }
  },

  toggleSave: async (listingId: string) => {
    const { savedIds } = get();
    const wasSaved = savedIds.has(listingId);

    // Optimistic update
    const next = new Set(savedIds);
    if (wasSaved) {
      next.delete(listingId);
    } else {
      next.add(listingId);
    }
    set({ savedIds: next });

    try {
      if (wasSaved) {
        await api.unsaveListing(listingId);
      } else {
        await api.saveListing(listingId);
      }
    } catch {
      // Rollback on failure
      const rollback = new Set(get().savedIds);
      if (wasSaved) {
        rollback.add(listingId);
      } else {
        rollback.delete(listingId);
      }
      set({ savedIds: rollback });
    }
  },

  isSaved: (listingId: string) => get().savedIds.has(listingId),

  clear: () => set({ savedIds: new Set() }),
}));
