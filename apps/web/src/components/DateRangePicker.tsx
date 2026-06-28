import { useState, useMemo } from 'react';

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
        className="h-12 w-full rounded-lg bg-gray-800 px-4 text-left text-sm text-white active:bg-gray-700"
      >
        📅{' '}
        {from && to
          ? `${formatDateShort(from)} — ${formatDateShort(to)}`
          : 'Seleccionar rango de fechas'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-800 p-5 shadow-2xl">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <button onClick={prevMonth} className="h-10 w-10 rounded-lg bg-gray-700 text-lg font-bold text-white active:bg-gray-600">
                ‹
              </button>
              <span className="font-bold text-white">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button onClick={nextMonth} className="h-10 w-10 rounded-lg bg-gray-700 text-lg font-bold text-white active:bg-gray-600">
                ›
              </button>
            </div>

            {/* Status */}
            <p className="mb-3 text-center text-sm text-gray-400">
              {pickStart ? 'Seleccioná la fecha inicial' : 'Seleccioná la fecha final'}
            </p>

            {/* Day names */}
            <div className="mb-1 grid grid-cols-7 gap-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className="py-1 text-center text-xs font-bold text-gray-500">
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
                        ? 'bg-blue-600 text-white'
                        : inRange
                          ? 'bg-blue-600/20 text-blue-300'
                          : today
                            ? 'bg-gray-700 text-white'
                            : 'text-gray-300 active:bg-gray-700'
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
                className="flex-1 rounded-lg bg-gray-700 py-2 text-xs font-bold text-gray-300 active:bg-gray-600"
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
                className="flex-1 rounded-lg bg-gray-700 py-2 text-xs font-bold text-gray-300 active:bg-gray-600"
              >
                Mes anterior
              </button>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleClear}
                className="h-12 flex-1 rounded-xl bg-gray-600 font-bold text-white active:bg-gray-500"
              >
                Limpiar
              </button>
              <button
                onClick={() => setOpen(false)}
                className="h-12 flex-1 rounded-xl bg-gray-600 font-bold text-white active:bg-gray-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="h-12 flex-1 rounded-xl bg-blue-600 font-bold text-white active:bg-blue-700"
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
