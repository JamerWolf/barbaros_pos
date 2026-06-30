import React from 'react';
import { formatCOP } from '../../utils/format.js';
import type { CardSize } from '../../store/accountUIStore.js';

export interface AccountCardProps {
  id?: string;
  name: string;
  total: number;
  pendingAmount?: number;
  status: 'open' | 'closed' | 'payment_pending';
  onClick?: () => void;
  size?: CardSize;
}

const SIZE_CLASSES: Record<CardSize, { container: string; name: string; total: string }> = {
  sm: { container: 'w-20 h-20 p-2', name: 'text-xs', total: 'text-sm' },
  md: { container: 'w-32 h-32 p-4', name: 'text-lg', total: 'text-xl' },
  lg: { container: 'w-44 h-44 p-5', name: 'text-xl', total: 'text-2xl' },
};

export const AccountCard: React.FC<AccountCardProps> = ({ name, total, pendingAmount = 0, status, onClick, size = 'md' }) => {
  const getStatusColor = () => {
    if (status === 'open' && pendingAmount > 0) {
      return 'bg-orange-600';
    }
    switch (status) {
      case 'open':
        return 'bg-green-600';
      case 'closed':
        return 'bg-gray-700';
      case 'payment_pending':
        return 'bg-blue-600';
      default:
        return 'bg-gray-800';
    }
  };

  const s = SIZE_CLASSES[size];

  return (
    <div 
      className={`${s.container} rounded-xl shadow-lg flex flex-col justify-between cursor-pointer select-none transition-transform active:scale-95 ${getStatusColor()} text-white`}
      onClick={onClick}
    >
      <div className={`font-bold truncate ${s.name}`}>{name}</div>
      <div className="flex flex-col">
        <span className="text-[10px] opacity-75 uppercase tracking-wider">Total</span>
        <span className={`font-bold ${s.total}`}>{formatCOP(total)}</span>
      </div>
    </div>
  );
};
