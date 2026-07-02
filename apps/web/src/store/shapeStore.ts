import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IShape } from '@barbaros/shared';

import API_URL from '../utils/apiUrl.js';

export type ShapeTool = null | 'rectangle' | 'line' | 'text';

export interface ShapeState {
  shapes: IShape[];
  activeTool: ShapeTool;
  drawingColor: string;
  isLoading: boolean;
  selectedShapeId: string | null;
  editingShapeId: string | null;

  setActiveTool: (tool: ShapeTool) => void;
  setDrawingColor: (color: string) => void;
  setSelectedShapeId: (id: string | null) => void;
  setEditingShapeId: (id: string | null) => void;
  loadShapes: () => Promise<void>;
  addShape: (shape: Omit<IShape, 'id' | 'createdAt' | 'updatedAt'>) => Promise<IShape>;
  updateShape: (id: string, input: Partial<IShape>) => Promise<void>;
  deleteShape: (id: string) => Promise<void>;
}

export const useShapeStore = create<ShapeState>()(
  persist(
    (set, get) => ({
      shapes: [],
      activeTool: null,
      drawingColor: '#3b82f6',
      isLoading: false,
      selectedShapeId: null,
      editingShapeId: null,

      setActiveTool: (tool) => set({ activeTool: tool }),
      setDrawingColor: (color) => set({ drawingColor: color }),
      setSelectedShapeId: (id) => set({ selectedShapeId: id }),
      setEditingShapeId: (id) => set({ editingShapeId: id }),

      loadShapes: async () => {
        set({ isLoading: true });
        try {
          const res = await fetch(`${API_URL}/shapes`);
          if (res.ok) {
            const shapes = await res.json();
            set({ shapes });
          }
        } catch (err) {
          console.error('Failed to load shapes:', err);
        } finally {
          set({ isLoading: false });
        }
      },

      addShape: async (shapeData) => {
        const res = await fetch(`${API_URL}/shapes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shapeData),
        });
        if (!res.ok) throw new Error('Failed to create shape');
        const shape = await res.json();
        set((state) => ({ shapes: [...state.shapes, shape] }));
        return shape;
      },

      updateShape: async (id, input) => {
        const res = await fetch(`${API_URL}/shapes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error('Failed to update shape');
        const updated = await res.json();
        set((state) => ({
          shapes: state.shapes.map((s) => (s.id === id ? updated : s)),
        }));
      },

      deleteShape: async (id) => {
        const res = await fetch(`${API_URL}/shapes/${id}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete shape');
        set((state) => ({
          shapes: state.shapes.filter((s) => s.id !== id),
        }));
      },
    }),
    {
      name: 'shape-storage',
      partialize: (state) => ({
        drawingColor: state.drawingColor,
      }),
    }
  )
);
