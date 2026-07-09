import { useState, useMemo } from 'react';
import { tw } from '../utils/colors.js';

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DAY_NAMES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

function formatDateShort(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [pickStart, setPickStart] = useState(true); // true = picking from, false = picking to

  const initialMonth = useMemo(() => {
    const d = from ? new Date(from + 'T12:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [from]);

  const [viewYear, setViewYear] = useState(initialMonth.year);
  const [viewMonth, setViewMonth] = useState(initialMonth.month);
  const [tempFrom, setTempFrom] = useState(from);
  const [tempTo, setTempTo] = useState(to);

  const days = useMemo(() => {
    const count = getDaysInMonth(viewYear, viewMonth);
    const start = getFirstDayOfMonth(viewYear, viewMonth);
    const result: (number | null)[] = [];
    for (let i = 0; i < start; i++) result.push(null);
    for (let d = 1; d <= count; d++) result.push(d);
    return result;
  }, [viewYear, viewMonth]);

  const handleDayClick = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (pickStart) {
      setTempFrom(iso);
      setTempTo('');
      setPickStart(false);
    } else {
      if (iso < tempFrom) {
        setTempTo(tempFrom);
        setTempFrom(iso);
      } else {
        setTempTo(iso);
      }
      setPickStart(true);
    }
  };

  const handleConfirm = () => {
    onChange(tempFrom, tempTo || tempFrom);
    setOpen(false);
  };

  const handleClear = () => {
    setTempFrom('');
    setTempTo('');
    setPickStart(true);
  };

  const handleOpen = () => {
    setTempFrom(from);
    setTempTo(to);
    setPickStart(true);
    if (from) {
      const d = new Date(from + 'T12:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
    setOpen(true);
  };

  const isInRange = (day: number): boolean => {
    if (!tempFrom || !tempTo) return false;
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return iso >= tempFrom && iso <= tempTo;
  };

  const isToday = (day: number): boolean => {
    const now = new Date();
    return day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="h-12 w-full rounded-lg bg-[#141414] px-4 text-left text-sm text-[#E8E0D0] active:bg-[#1E1E1E]"
      >
        📅{' '}
        {from && to
          ? `${formatDateShort(from)} — ${formatDateShort(to)}`
          : 'Seleccionar rango de fechas'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#141414] p-5 shadow-2xl">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <button onClick={prevMonth} className={`h-10 w-10 rounded-lg ${tw.bgHover} text-lg font-bold ${tw.text} active:bg-[#1E1E1E]`}>
                ‹
              </button>
              <span className="font-bold text-[#E8E0D0]">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button onClick={nextMonth} className={`h-10 w-10 rounded-lg ${tw.bgHover} text-lg font-bold ${tw.text} active:bg-[#1E1E1E]`}>
                ›
              </button>
            </div>

            {/* Status */}
            <p className={`mb-3 text-center text-sm ${tw.textMuted}`}>
              {pickStart ? 'Seleccioná la fecha inicial' : 'Seleccioná la fecha final'}
            </p>

            {/* Day names */}
            <div className="mb-1 grid grid-cols-7 gap-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className={`py-1 text-center text-xs font-bold ${tw.textMuted}`}>
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} />;
                const isSelected =
                  (tempFrom && `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` === tempFrom) ||
                  (tempTo && `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` === tempTo);
                const inRange = isInRange(day);
                const today = isToday(day);

                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={`h-10 rounded-lg text-sm font-bold ${
                      isSelected
                        ? 'bg-[#C8A84E] text-[#E8E0D0]'
                        : inRange
                          ? 'bg-[#C8A84E]/20 text-[#E8E0D0]'
                          : today
                            ? 'bg-[#1E1E1E] text-[#E8E0D0]'
                            : 'text-[#7A7060] active:bg-[#1E1E1E]'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Quick shortcuts */}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  const now = new Date();
                  const first = new Date(now.getFullYear(), now.getMonth(), 1);
                  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  setTempFrom(fmt(first));
                  setTempTo(fmt(now));
                  setViewYear(now.getFullYear());
                  setViewMonth(now.getMonth());
                  setPickStart(true);
                }}
                className={`flex-1 rounded-lg ${tw.bgHover} py-2 text-xs font-bold ${tw.textMuted} active:bg-[#1E1E1E]`}
              >
                Este mes
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
                  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  setTempFrom(fmt(lastMonth));
                  setTempTo(fmt(lastDay));
                  setViewYear(lastMonth.getFullYear());
                  setViewMonth(lastMonth.getMonth());
                  setPickStart(true);
                }}
                className={`flex-1 rounded-lg ${tw.bgHover} py-2 text-xs font-bold ${tw.textMuted} active:bg-[#1E1E1E]`}
              >
                Mes anterior
              </button>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleClear}
                className={`h-12 flex-1 rounded-xl ${tw.bgHover} font-bold ${tw.text} active:bg-[#1E1E1E]`}
              >
                Limpiar
              </button>
              <button
                onClick={() => setOpen(false)}
                className={`h-12 flex-1 rounded-xl ${tw.bgHover} font-bold ${tw.text} active:bg-[#1E1E1E]`}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="h-12 flex-1 rounded-xl bg-[#C8A84E] font-bold text-[#E8E0D0] active:bg-[#C8A84E]/80"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
