import { create } from 'zustand';
import type { IProduct, ICategory } from '@barbaros/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ProductState {
  products: IProduct[];
  categories: ICategory[];
  loading: boolean;
  fetchProducts: (activeOnly?: boolean) => Promise<void>;
  fetchCategories: () => Promise<void>;
  createProduct: (data: { name: string; price: number; categoryId?: string; photoUrl?: string; active?: boolean }) => Promise<IProduct>;
  updateProduct: (id: string, data: { name?: string; price?: number; categoryId?: string; photoUrl?: string; active?: boolean }) => Promise<IProduct>;
  deleteProduct: (id: string) => Promise<void>;
  createCategory: (name: string) => Promise<ICategory>;
  updateCategory: (id: string, name: string) => Promise<ICategory>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useProductStore = create<ProductState>((set) => ({
  products: [],
  categories: [],
  loading: false,

  fetchProducts: async (activeOnly) => {
    set({ loading: true });
    try {
      const query = activeOnly !== undefined ? `?active=${activeOnly}` : '';
      const res = await fetch(`${API_URL}/products${query}`);
      if (res.ok) {
        const products = await res.json();
        set({ products });
      }
    } finally {
      set({ loading: false });
    }
  },

  fetchCategories: async () => {
    const res = await fetch(`${API_URL}/categories`);
    if (res.ok) {
      const categories = await res.json();
      set({ categories });
    }
  },

  createProduct: async (data) => {
    const res = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create product');
    const product = await res.json();
    set((state) => ({ products: [...state.products, product] }));
    return product;
  },

  updateProduct: async (id, data) => {
    const res = await fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update product');
    const product = await res.json();
    set((state) => ({
      products: state.products.map((p) => (p.id === id ? product : p)),
    }));
    return product;
  },

  deleteProduct: async (id) => {
    const res = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete product');
    set((state) => ({ products: state.products.filter((p) => p.id !== id) }));
  },

  createCategory: async (name) => {
    const res = await fetch(`${API_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to create category');
    const category = await res.json();
    set((state) => ({ categories: [...state.categories, category] }));
    return category;
  },

  updateCategory: async (id, name) => {
    const res = await fetch(`${API_URL}/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to update category');
    const category = await res.json();
    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? category : c)),
    }));
    return category;
  },

  deleteCategory: async (id) => {
    const res = await fetch(`${API_URL}/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete category');
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }));
  },
}));
