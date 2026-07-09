import type { IOrderItem } from '@barbaros/shared';
import { formatCOP } from '../utils/format.js';
import { productPhotoUrl } from '../utils/productPhoto.js';

interface OrderItemListProps {
  items: IOrderItem[];
  onRemoveItem: (itemId: string) => void;
  onIncrementItem: (itemId: string) => void;
}

export function OrderItemList({ items, onRemoveItem, onIncrementItem }: OrderItemListProps): JSX.Element {
  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-[#141414] p-4 text-center text-[#7A7060]">
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
          className="flex items-center gap-3 rounded-xl bg-[#141414] px-4 py-3 active:bg-[#1E1E1E] cursor-pointer"
        >
          {item.product?.photoUrl ? (
            <img
              src={productPhotoUrl(item.product.photoUrl)}
              alt={item.product.name}
              className="h-10 w-10 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1E1E1E] text-lg">
              📦
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate font-bold text-[#E8E0D0]">{item.product?.name ?? 'Producto'}</p>
            <p className="text-sm text-[#7A7060]">
              {Number(item.quantity)} x {formatCOP(Number(item.unitPrice))}
            </p>
          </div>
          <span className="font-bold text-[#E8E0D0]">
            {formatCOP(Number(item.quantity) * Number(item.unitPrice))}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); }}
            className="h-8 w-8 shrink-0 rounded-lg bg-[#5C1A1A] text-lg font-bold text-[#E85050] active:bg-[#5C1A1A]/80"
          >
            🗑️
          </button>
        </div>
      ))}
    </div>
  );
}
