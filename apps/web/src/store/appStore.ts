import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AppMode = 'personal' | 'admin'

interface AppState {
  mode: AppMode
  setMode: (mode: AppMode) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      mode: 'personal',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({ mode: state.mode }),
    },
  ),
)
