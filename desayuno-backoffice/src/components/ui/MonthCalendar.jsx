/**
 * MonthCalendar — standalone month grid for event-date selection.
 * Extracted from DatePicker logic; colors days by status.
 *
 * Props:
 *   eventDates: array of { eventDate: "YYYY-MM-DD", isOpen, packs, maxCapacity, ... }
 *   selected: "YYYY-MM-DD" | null
 *   onSelect: (dateStr) => void
 */
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

function getFirstDayOfMonth(year, month) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function toYMD(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function MonthCalendar({ eventDates = [], selected, onSelect }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(() => {
    // Start view on the first open date if any, otherwise today.
    if (eventDates.length > 0) {
      const first = eventDates.find(d => d.isOpen) || eventDates[0];
      // ponytail: backend serializes the DATE as RFC3339 (…T00:00:00Z); take YYYY-MM-DD only.
      if (first) return new Date(first.eventDate.slice(0, 10) + 'T12:00:00');
    }
    return today;
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Build lookup: "YYYY-MM-DD" -> event date object
  const byDate = {};
  for (const ed of eventDates) {
    byDate[ed.eventDate.slice(0, 10)] = ed;
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 w-full max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <span className="font-semibold text-gray-900">
          {MONTHS[month]} {year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const ymd = toYMD(year, month, day);
          const ed = byDate[ymd];
          const isSelected = selected === ymd;

          let colorClass = 'text-gray-400 cursor-default';
          let title = '';

          if (ed) {
            if (ed.isOpen && ed.full) {
              colorClass = 'bg-red-100 text-red-800 hover:bg-red-200 cursor-pointer font-medium';
              title = 'Día completo';
            } else if (ed.isOpen) {
              colorClass = 'bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer font-medium';
              title = 'Día abierto';
            } else {
              colorClass = 'bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer';
              title = 'Día cerrado';
            }
          } else {
            colorClass = 'text-gray-400 hover:bg-gray-50 cursor-pointer';
            title = 'Día sin configurar — clic para abrir';
          }

          if (isSelected) {
            if (ed && ed.isOpen && ed.full) {
              colorClass = 'bg-red-600 text-white cursor-pointer font-bold ring-2 ring-red-400';
            } else if (ed && ed.isOpen) {
              colorClass = 'bg-green-600 text-white cursor-pointer font-bold ring-2 ring-green-400';
            } else if (ed && !ed.isOpen) {
              colorClass = 'bg-gray-500 text-white cursor-pointer font-bold ring-2 ring-gray-400';
            } else {
              colorClass = 'bg-primary-600 text-white cursor-pointer font-bold ring-2 ring-primary-400';
            }
          }

          return (
            <button
              key={idx}
              type="button"
              title={title}
              onClick={() => onSelect(ymd)}
              className={`p-2 text-sm rounded-lg transition-colors ${colorClass}`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-300 inline-block" />
          Abierto
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" />
          Cerrado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-300 inline-block" />
          Completo
        </span>
      </div>
    </div>
  );
}
