import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calculateFirstFreeSpace, Position } from '../utils/canvasUtils.js';

export type { Position };

export type CardSize = 'sm' | 'md' | 'lg';

export interface AccountUIState {
  nodePositions: Record<string, Position>;
  panOffset: Position;
  zoom: number;
  viewMode: 'list' | 'canvas';
  selectionMode: boolean;
  selectedIds: Set<string>;
  canvasHeight: number | null;
  cardSize: CardSize;
  _hasHydrated: boolean;
  updatePosition: (accountId: string, pos: Position) => void;
  assignInitialPosition: (accountId: string) => void;
  assignPositionsBatch: (accountIds: string[]) => void;
  clearOrphanPositions: (activeAccountIds: string[]) => void;
  setPanOffset: (pos: Position) => void;
  setZoom: (zoom: number) => void;
  setViewMode: (mode: 'list' | 'canvas') => void;
  setSelectionMode: (on: boolean) => void;
  toggleSelection: (accountId: string) => void;
  clearSelection: () => void;
  movePositions: (accountIds: string[], delta: Position) => void;
  fitToContent: (containerWidth: number, containerHeight: number) => void;
  setCanvasHeight: (height: number | null) => void;
  setCardSize: (size: CardSize) => void;
  setHasHydrated: (state: boolean) => void;
}

const CARD_SIZES: Record<CardSize, { w: number; h: number }> = {
  sm: { w: 80, h: 80 },
  md: { w: 128, h: 128 },
  lg: { w: 176, h: 176 },
};
const NODE_GAP = 16;

export const useAccountUIStore = create<AccountUIState>()(
  persist(
    (set, _get) => ({
      nodePositions: {},
      panOffset: { x: 0, y: 0 },
      zoom: 1,
      viewMode: 'list',
      selectionMode: false,
      selectedIds: new Set<string>(),
      canvasHeight: null,
      cardSize: 'md',
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
          const { w, h } = CARD_SIZES[state.cardSize];
          const freeSpace = calculateFirstFreeSpace(
            state.nodePositions,
            w + NODE_GAP,
            h + NODE_GAP
          );
          return {
            nodePositions: { ...state.nodePositions, [accountId]: freeSpace }
          };
        });
      },

      assignPositionsBatch: (accountIds) => {
        set((state) => {
          const { w, h } = CARD_SIZES[state.cardSize];
          const newPositions = { ...state.nodePositions };
          const currentPositions = { ...state.nodePositions };
          for (const id of accountIds) {
            if (!newPositions[id]) {
              const freeSpace = calculateFirstFreeSpace(
                currentPositions,
                w + NODE_GAP,
                h + NODE_GAP
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
      setSelectionMode: (on) => set({ selectionMode: on, selectedIds: on ? new Set() : new Set() }),
      toggleSelection: (accountId) => set((state) => {
        const next = new Set(state.selectedIds);
        if (next.has(accountId)) {
          next.delete(accountId);
        } else {
          next.add(accountId);
        }
        return { selectedIds: next };
      }),
      clearSelection: () => set({ selectedIds: new Set() }),
      movePositions: (accountIds, delta) => set((state) => {
        const next = { ...state.nodePositions };
        for (const id of accountIds) {
          if (next[id]) {
            next[id] = { x: next[id].x + delta.x, y: next[id].y + delta.y };
          }
        }
        return { nodePositions: next };
      }),
      setCanvasHeight: (height) => set({ canvasHeight: height }),
      setCardSize: (size) => set({ cardSize: size, nodePositions: {} }),
      fitToContent: (containerWidth, containerHeight) => set((state) => {
        const positions = Object.values(state.nodePositions);
        if (positions.length === 0) return { zoom: 1, panOffset: { x: 0, y: 0 } };

        const { w, h } = CARD_SIZES[state.cardSize];
        const padding = 20;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (const pos of positions) {
          minX = Math.min(minX, pos.x);
          minY = Math.min(minY, pos.y);
          maxX = Math.max(maxX, pos.x + w);
          maxY = Math.max(maxY, pos.y + h);
        }

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;

        if (contentWidth <= 0 || contentHeight <= 0) return state;

        const availableWidth = containerWidth - padding * 2;
        const availableHeight = containerHeight - padding * 2;

        const zoomX = availableWidth / contentWidth;
        const zoomY = availableHeight / contentHeight;
        const zoom = Math.min(zoomX, zoomY, 1.5); // cap at 1.5 so cards don't get huge

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const panOffset = {
          x: containerWidth / (2 * zoom) - centerX,
          y: containerHeight / (2 * zoom) - centerY,
        };

        return { zoom, panOffset };
      }),
      setHasHydrated: (state) => set({ _hasHydrated: state })
    }),
    {
      name: 'account-ui-storage',
      partialize: (state) => ({
        nodePositions: state.nodePositions,
        panOffset: state.panOffset,
        zoom: state.zoom,
        viewMode: state.viewMode,
        canvasHeight: state.canvasHeight,
        cardSize: state.cardSize,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
