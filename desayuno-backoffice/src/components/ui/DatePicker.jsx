/**
 * Custom DatePicker component
 */
import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

export default function DatePicker({ 
  value, 
  onChange, 
  placeholder = 'Seleccionar fecha...', 
  showTime = true,
  disabled = false,
  className = '' 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value);
    return new Date();
  });
  const [hours, setHours] = useState(() => {
    if (value) return new Date(value).getHours().toString().padStart(2, '0');
    return '10';
  });
  const [minutes, setMinutes] = useState(() => {
    if (value) return new Date(value).getMinutes().toString().padStart(2, '0');
    return '00';
  });
  
  const containerRef = useRef(null);

  // Parse current value
  const selectedDate = value ? new Date(value) : null;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get days in month
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Get first day of month (0 = Sunday, 1 = Monday, etc.)
  const getFirstDayOfMonth = (year, month) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Convert to Monday-first
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    
    // Empty cells for days before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const handleDayClick = (day) => {
    if (!day) return;
    
    const newDate = new Date(
      viewDate.getFullYear(),
      viewDate.getMonth(),
      day,
      parseInt(hours),
      parseInt(minutes)
    );
    
    onChange(newDate.toISOString().slice(0, 16));
    if (!showTime) setIsOpen(false);
  };

  const handleTimeChange = () => {
    if (!selectedDate) return;
    
    const newDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      parseInt(hours),
      parseInt(minutes)
    );
    
    onChange(newDate.toISOString().slice(0, 16));
  };

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const formatDisplayDate = () => {
    if (!selectedDate) return '';
    const day = selectedDate.getDate();
    const month = MONTHS[selectedDate.getMonth()];
    const year = selectedDate.getFullYear();
    const time = showTime ? ` ${selectedDate.getHours().toString().padStart(2, '0')}:${selectedDate.getMinutes().toString().padStart(2, '0')}` : '';
    return `${day} ${month} ${year}${time}`;
  };

  const isSelectedDay = (day) => {
    if (!day || !selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === viewDate.getMonth() &&
      selectedDate.getFullYear() === viewDate.getFullYear()
    );
  };

  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === viewDate.getMonth() &&
      today.getFullYear() === viewDate.getFullYear()
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-lg flex items-center justify-between gap-2 transition-colors
          ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'}
          ${isOpen ? 'ring-2 ring-primary-500 border-transparent' : ''}`}
      >
        <span className={selectedDate ? 'text-gray-900' : 'text-gray-500'}>
          {formatDisplayDate() || placeholder}
        </span>
        <Calendar className="w-4 h-4 text-gray-400" />
      </button>

      {/* Calendar dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-72">
          {/* Month/Year header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <span className="font-semibold text-gray-900">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Days header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {generateCalendarDays().map((day, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleDayClick(day)}
                disabled={!day}
                className={`p-2 text-sm rounded-lg transition-colors
                  ${!day ? 'invisible' : ''}
                  ${isSelectedDay(day) ? 'bg-primary-600 text-white' : ''}
                  ${isToday(day) && !isSelectedDay(day) ? 'bg-primary-100 text-primary-700' : ''}
                  ${day && !isSelectedDay(day) && !isToday(day) ? 'hover:bg-gray-100 text-gray-700' : ''}`}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Time picker */}
          {showTime && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Hora:</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={hours}
                  onChange={(e) => setHours(e.target.value.padStart(2, '0'))}
                  onBlur={handleTimeChange}
                  className="w-14 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                />
                <span>:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value.padStart(2, '0'))}
                  onBlur={handleTimeChange}
                  className="w-14 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                />
              </div>
            </div>
          )}

          {/* Confirm button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full mt-4 btn btn-primary text-sm"
          >
            Confirmar
          </button>
        </div>
      )}
    </div>
  );
}
