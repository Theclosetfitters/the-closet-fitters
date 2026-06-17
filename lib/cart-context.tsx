'use client';

// Client-side shopping cart. Holds multiple closet configurations and persists
// to localStorage. Prices stored here are for DISPLAY only — the server
// recomputes authoritative prices at checkout (CLAUDE.md #1).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { ClosetConfig } from '@/types';
import { makeSectionId } from '@/lib/config';

export interface CartItem {
  id: string;
  config: ClosetConfig;
  totalCents: number;
}

interface CartContextValue {
  items: CartItem[];
  add: (config: ClosetConfig, totalCents: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  count: number;
  totalCents: number;
  ready: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'closet-cart-v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      // ignore corrupt storage
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, [items, ready]);

  const add = useCallback(
    (config: ClosetConfig, totalCents: number) =>
      setItems((prev) => [...prev, { id: makeSectionId(), config, totalCents }]),
    []
  );
  const remove = useCallback(
    (id: string) => setItems((prev) => prev.filter((i) => i.id !== id)),
    []
  );
  const clear = useCallback(() => setItems([]), []);

  const value: CartContextValue = {
    items,
    add,
    remove,
    clear,
    count: items.length,
    totalCents: items.reduce((a, i) => a + i.totalCents, 0),
    ready,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
