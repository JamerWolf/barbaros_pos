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
  cardSizes: Record<string, CardSize>;
  canvasLocked: boolean;
  selectionSnapshot: { nodePositions: Record<string, Position>; cardSizes: Record<string, CardSize> } | null;
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
  fitToContent: (containerWidth: number, containerHeight: number, shapes?: { x: number; y: number; width: number; height: number; points?: { x: number; y: number }[] }[]) => void;
  setCanvasHeight: (height: number | null) => void;
  setCardSize: (size: CardSize) => void;
  getCardSize: (accountId: string) => CardSize;
  getCardDimensions: (accountId: string) => { w: number; h: number };
  setCanvasLocked: (locked: boolean) => void;
  saveSelectionSnapshot: () => void;
  restoreSelectionSnapshot: () => void;
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
      cardSizes: {},
      canvasLocked: false,
      selectionSnapshot: null,
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
            nodePositions: { ...state.nodePositions, [accountId]: freeSpace },
            cardSizes: { ...state.cardSizes, [accountId]: state.cardSize }
          };
        });
      },

      assignPositionsBatch: (accountIds) => {
        set((state) => {
          const { w, h } = CARD_SIZES[state.cardSize];
          const newPositions = { ...state.nodePositions };
          const currentPositions = { ...state.nodePositions };
          const newCardSizes = { ...state.cardSizes };
          for (const id of accountIds) {
            if (!newPositions[id]) {
              const freeSpace = calculateFirstFreeSpace(
                currentPositions,
                w + NODE_GAP,
                h + NODE_GAP
              );
              newPositions[id] = freeSpace;
              currentPositions[id] = freeSpace;
              // Only set cardSize if not already set (from backend)
              if (!newCardSizes[id]) {
                newCardSizes[id] = state.cardSize;
              }
            }
          }
          return { nodePositions: newPositions, cardSizes: newCardSizes };
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
      getCardSize: (accountId) => {
        const s = _get();
        return s.cardSizes[accountId] ?? s.cardSize;
      },
      getCardDimensions: (accountId) => {
        const s = _get();
        const size = s.cardSizes[accountId] ?? s.cardSize;
        return CARD_SIZES[size];
      },
      setCardSize: (size: CardSize) => set((state) => {
        // If in selection mode with selected cards, change those too
        if (state.selectionMode && state.selectedIds.size > 0) {
          const cardSizes = { ...state.cardSizes };
          for (const id of state.selectedIds) {
            cardSizes[id] = size;
          }
          return { cardSize: size, cardSizes };
        }
        return { cardSize: size };
      }),
      fitToContent: (containerWidth: number, containerHeight: number, shapes?: { x: number; y: number; width: number; height: number; points?: { x: number; y: number }[] }[]) => set((state) => {
        const entries = Object.entries(state.nodePositions);
        const hasCards = entries.length > 0;
        const hasShapes = shapes && shapes.length > 0;

        if (!hasCards && !hasShapes) return { zoom: 1, panOffset: { x: 0, y: 0 } };

        const padding = 20;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        // Include account cards
        for (const [id, pos] of entries) {
          const overrideSize = state.cardSizes[id];
          const { w, h } = overrideSize
            ? CARD_SIZES[overrideSize]
            : CARD_SIZES[state.cardSize];
          minX = Math.min(minX, pos.x);
          minY = Math.min(minY, pos.y);
          maxX = Math.max(maxX, pos.x + w);
          maxY = Math.max(maxY, pos.y + h);
        }

        // Include shapes
        if (shapes) {
          for (const shape of shapes) {
            if (shape.points && shape.points.length > 0) {
              // LINE: use actual point bounds
              for (const p of shape.points) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
              }
            } else {
              // RECTANGLE: use x, y, width, height
              minX = Math.min(minX, shape.x);
              minY = Math.min(minY, shape.y);
              maxX = Math.max(maxX, shape.x + shape.width);
              maxY = Math.max(maxY, shape.y + shape.height);
            }
          }
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
      setCanvasLocked: (locked) => set({ canvasLocked: locked }),
      saveSelectionSnapshot: () => set((state) => ({
        selectionSnapshot: {
          nodePositions: { ...state.nodePositions },
          cardSizes: { ...state.cardSizes }
        }
      })),
      restoreSelectionSnapshot: () => set((state) => {
        if (!state.selectionSnapshot) return state;
        return {
          nodePositions: state.selectionSnapshot.nodePositions,
          cardSizes: state.selectionSnapshot.cardSizes,
          selectionSnapshot: null
        };
      }),
      setHasHydrated: (val: boolean) => set({ _hasHydrated: val })
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
        cardSizes: state.cardSizes,
        canvasLocked: state.canvasLocked,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
