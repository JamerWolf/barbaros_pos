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
  sm: { container: 'w-20 h-20 p-2', name: 'text-[10px]', total: 'text-xs' },
  md: { container: 'w-32 h-32 p-4', name: 'text-sm', total: 'text-lg' },
  lg: { container: 'w-44 h-44 p-5', name: 'text-base', total: 'text-xl' },
};

export const AccountCard: React.FC<AccountCardProps> = ({ name, total, pendingAmount = 0, status, onClick, size = 'md' }) => {
  const getStatusStyles = () => {
    if (status === 'open' && pendingAmount > 0) {
      return {
        bg: 'bg-[#1A1408]',
        border: 'border-[#B87333]',
        amountColor: 'text-[#CD7F32]',
      };
    }
    switch (status) {
      case 'open':
        return {
          bg: 'bg-[#1A1408]',
          border: 'border-[#C8A84E]',
          amountColor: 'text-[#7CCD7C]',
        };
      case 'closed':
        return {
          bg: 'bg-[#141414]',
          border: 'border-[#3A3A3A]',
          amountColor: 'text-[#7A7060]',
        };
      case 'payment_pending':
        return {
          bg: 'bg-[#1A1408]',
          border: 'border-[#CD7F32]',
          amountColor: 'text-[#CD7F32]',
        };
      default:
        return {
          bg: 'bg-[#1A1408]',
          border: 'border-[#3A3A3A]',
          amountColor: 'text-[#E8E0D0]',
        };
    }
  };

  const s = SIZE_CLASSES[size];
  const styles = getStatusStyles();

  return (
    <div 
      className={`${s.container} ${styles.bg} border ${styles.border} rounded-xl shadow-lg flex flex-col justify-between cursor-pointer select-none transition-all active:scale-95`}
      onClick={onClick}
    >
      <div className={`font-bold truncate text-[#C8A84E] ${s.name}`}>{name}</div>
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-widest text-[#7A7060] font-mono">Pendiente</span>
        <span className={`font-bold font-mono ${styles.amountColor} ${s.total}`}>{formatCOP(pendingAmount)}</span>
      </div>
    </div>
  );
};
