import type { IOrderItem } from '@barbaros/shared';
import { formatCOP } from '../utils/format.js';

interface OrderItemListProps {
  items: IOrderItem[];
  onRemoveItem: (itemId: string) => void;
  onIncrementItem: (itemId: string) => void;
}

export function OrderItemList({ items, onRemoveItem, onIncrementItem }: OrderItemListProps): JSX.Element {
  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-gray-800 p-4 text-center text-gray-500">
        Sin productos cargados
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onIncrementItem(item.id)}
          className="flex items-center gap-3 rounded-xl bg-gray-800 px-4 py-3 active:bg-gray-700 cursor-pointer"
        >
          <div className="flex-1 min-w-0">
            <p className="truncate font-bold text-white">{item.product?.name ?? 'Producto'}</p>
            <p className="text-sm text-gray-400">
              {Number(item.quantity)} x {formatCOP(Number(item.unitPrice))}
            </p>
          </div>
          <span className="font-bold text-white">
            {formatCOP(Number(item.quantity) * Number(item.unitPrice))}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); }}
            className="h-8 w-8 shrink-0 rounded-lg bg-red-600 text-lg font-bold text-white active:bg-red-700"
          >
            🗑️
          </button>
        </div>
      ))}
    </div>
  );
}
