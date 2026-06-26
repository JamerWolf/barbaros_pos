import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calculateFirstFreeSpace, Position } from '../utils/canvasUtils.js';

export type { Position };

export interface AccountUIState {
  nodePositions: Record<string, Position>;
  panOffset: Position;
  zoom: number;
  viewMode: 'list' | 'canvas';
  _hasHydrated: boolean;
  updatePosition: (accountId: string, pos: Position) => void;
  assignInitialPosition: (accountId: string) => void;
  assignPositionsBatch: (accountIds: string[]) => void;
  clearOrphanPositions: (activeAccountIds: string[]) => void;
  setPanOffset: (pos: Position) => void;
  setZoom: (zoom: number) => void;
  setViewMode: (mode: 'list' | 'canvas') => void;
  setHasHydrated: (state: boolean) => void;
}

const NODE_WIDTH = 128; // w-32 = 128px
const NODE_HEIGHT = 128; // h-32 = 128px
const NODE_GAP = 16; // 16px gap between nodes

export const useAccountUIStore = create<AccountUIState>()(
  persist(
    (set, _get) => ({
      nodePositions: {},
      panOffset: { x: 0, y: 0 },
      zoom: 1,
      viewMode: 'list',
      _hasHydrated: false,

      updatePosition: (accountId, pos) => set((state) => ({
        nodePositions: {
          ...state.nodePositions,
          [accountId]: pos
        }
      })),

      assignInitialPosition: (accountId) => {
        set((state) => {
          if (state.nodePositions[accountId]) return state;
          const freeSpace = calculateFirstFreeSpace(
            state.nodePositions,
            NODE_WIDTH + NODE_GAP,
            NODE_HEIGHT + NODE_GAP
          );
          return {
            nodePositions: { ...state.nodePositions, [accountId]: freeSpace }
          };
        });
      },

      assignPositionsBatch: (accountIds) => {
        set((state) => {
          const newPositions = { ...state.nodePositions };
          const currentPositions = { ...state.nodePositions };
          for (const id of accountIds) {
            if (!newPositions[id]) {
              const freeSpace = calculateFirstFreeSpace(
                currentPositions,
                NODE_WIDTH + NODE_GAP,
                NODE_HEIGHT + NODE_GAP
              );
              newPositions[id] = freeSpace;
              currentPositions[id] = freeSpace;
            }
          }
          return { nodePositions: newPositions };
        });
      },

      clearOrphanPositions: (activeAccountIds) => set((state) => {
        const newPositions: Record<string, Position> = {};
        let hasChanges = false;

        for (const id of activeAccountIds) {
          if (state.nodePositions[id]) {
            newPositions[id] = state.nodePositions[id];
          }
        }

        // Si el número de claves cambió, hubo eliminación
        if (Object.keys(newPositions).length !== Object.keys(state.nodePositions).length) {
          hasChanges = true;
        }

        return hasChanges ? { nodePositions: newPositions } : state;
      }),

      setPanOffset: (pos) => set({ panOffset: pos }),
      setZoom: (zoom) => set({ zoom }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setHasHydrated: (state) => set({ _hasHydrated: state })
    }),
    {
      name: 'account-ui-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
