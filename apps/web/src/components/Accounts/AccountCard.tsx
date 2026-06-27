import React from 'react';
import { formatCOP } from '../../utils/format.js';

export interface AccountCardProps {
  id?: string;
  name: string;
  total: number;
  pendingAmount?: number;
  status: 'open' | 'closed' | 'payment_pending';
  onClick?: () => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({ name, total, pendingAmount = 0, status, onClick }) => {
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

  return (
    <div 
      className={`w-32 h-32 rounded-xl shadow-lg flex flex-col justify-between p-4 cursor-pointer select-none transition-transform active:scale-95 ${getStatusColor()} text-white`}
      onClick={onClick}
    >
      <div className="font-bold text-lg truncate">{name}</div>
      <div className="flex flex-col">
        <span className="text-xs opacity-75 uppercase tracking-wider">Total</span>
        <span className="font-bold text-xl">{formatCOP(total)}</span>
      </div>
    </div>
  );
};
