import { useSelector, useDispatch } from 'react-redux';
import { useEffect, useRef, useState } from 'react';
import { Ticket, Frown, AlertCircle, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import TicketCounter from '../booking/TicketCounter';
import BookingForm from '../booking/BookingForm';
import AllergiesForm from '../booking/AllergiesForm';
import BookingSummary from '../booking/BookingSummary';
import { setStep, setEventDateId, setOpenDates } from '../../store/bookingSlice';
import { fetchSettings } from '../../store/settingsSlice';
import { fetchCapacity } from '../../store/capacitySlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Minimal inline month calendar. openDates = [{id, date, full}] keyed by YYYY-MM-DD. */
function MonthCalendar({ openDates, onSelect, selectedId }) {
  // date may be RFC3339 (…T00:00:00Z); key everything by YYYY-MM-DD.
  const dateMap = {};
  openDates.forEach((d) => { dateMap[d.date.slice(0, 10)] = d; });

  // Find the month to show: default to the first open date's month
  const firstDate = openDates.length > 0 ? new Date(openDates[0].date.slice(0, 10) + 'T00:00:00') : new Date();
  const [year, setYear] = useState(firstDate.getFullYear());
  const [month, setMonth] = useState(firstDate.getMonth()); // 0-indexed

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday=0 offset
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pad = (n) => String(n).padStart(2, '0');
  const monthStr = `${year}-${pad(month + 1)}`;
  const monthLabel = new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prev} className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-white font-semibold capitalize">{monthLabel}</span>
        <button onClick={next} className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-white/40 text-xs font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const key = `${monthStr}-${pad(day)}`;
          const info = dateMap[key];
          const isOpen = !!info && !info.full;
          const isFull = !!info && info.full;
          const isSelected = info && info.id === selectedId;

          let cls = 'w-full aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all ';
          if (isSelected) {
            cls += 'bg-princess-pink text-white ring-2 ring-princess-pink ring-offset-1 ring-offset-magic-dark';
          } else if (isFull) {
            cls += 'bg-red-500/20 text-red-400 cursor-not-allowed border border-red-500/30';
          } else if (isOpen) {
            cls += 'bg-princess-purple/30 text-white cursor-pointer hover:bg-princess-purple/50 border border-princess-purple/40';
          } else {
            cls += 'text-white/25 cursor-default';
          }

          return (
            <button
              key={key}
              disabled={!isOpen || isFull}
              onClick={() => isOpen && !isFull && onSelect(info)}
              className={cls}
              title={isFull ? 'Completo' : undefined}
            >
              {day}
              {isFull && <span className="sr-only"> (completo)</span>}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-white/50 justify-center">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-princess-purple/40 border border-princess-purple/40" />
          Disponible
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />
          Completo
        </span>
      </div>
    </div>
  );
}

export default function TicketWizard() {
  const dispatch = useDispatch();
  const { step, eventDateId } = useSelector((state) => state.booking);
  const formRef = useRef(null);

  const [eventDates, setEventDates] = useState(null); // null = loading
  const [selectedDate, setSelectedDate] = useState(null); // {id, date, full}
  const activeStepRef = useRef(null);

  // Fetch open event dates on mount
  useEffect(() => {
    fetch(`${API_URL}/api/public/event-dates`)
      .then((r) => r.json())
      .then((dates) => {
        const list = dates || [];
        setEventDates(list);
        dispatch(setOpenDates(list));
        if (list.length <= 1) {
          // Auto-select the single date (or none); refetch settings/capacity for it
          const d = list[0] || null;
          setSelectedDate(d);
          if (d) {
            dispatch(setEventDateId(d.id));
            dispatch(fetchSettings(d.id));
            dispatch(fetchCapacity(d.id));
          }
        } else {
          // >1 date: date picker is the first step
          dispatch(setStep(0));
        }
      })
      .catch(() => {
        setEventDates([]); // fallback: no dates
      });
  }, [dispatch]);

  useEffect(() => {
    if (formRef.current) {
      const y = formRef.current.getBoundingClientRect().top + window.scrollY - 300;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, [step]);

  // Keep the active step centered in the (scrollable) stepper.
  useEffect(() => {
    activeStepRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [step]);

  const { availableTickets, loading } = useSelector((state) => state.capacity);

  // When >1 dates: step 0 = date picker, steps 1-4 = normal flow
  const hasMultipleDates = eventDates && eventDates.length > 1;
  // Display steps shown in the stepper
  const steps = hasMultipleDates
    ? [
        { num: 0, label: 'Fecha' },
        { num: 1, label: 'Entradas' },
        { num: 2, label: 'Datos' },
        { num: 3, label: 'Alergias' },
        { num: 4, label: 'Confirmar' },
      ]
    : [
        { num: 1, label: 'Entradas' },
        { num: 2, label: 'Datos' },
        { num: 3, label: 'Alergias' },
        { num: 4, label: 'Confirmar' },
      ];

  const handleSelectDate = (info) => {
    setSelectedDate(info);
    dispatch(setEventDateId(info.id));
    dispatch(fetchSettings(info.id));
    dispatch(fetchCapacity(info.id));
    dispatch(setStep(1));
  };

  // Still loading event dates
  if (eventDates === null || loading) {
    return (
      <section id="entradas" className="py-20 bg-gradient-to-b from-princess-purple/20 to-magic-dark">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="glass rounded-3xl p-12">
            <div className="animate-pulse flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-white/20 mb-4" />
              <div className="h-8 w-48 bg-white/20 rounded mb-4" />
              <div className="h-4 w-64 bg-white/10 rounded" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // No open dates at all, or single date that is full
  if (eventDates.length === 0 || (eventDates.length === 1 && eventDates[0].full)) {
    return (
      <section id="entradas" className="py-20 bg-gradient-to-b from-princess-purple/20 to-magic-dark">
        <div className="max-w-4xl mx-auto px-4">
          <div className="glass rounded-3xl p-12 text-center">
            <Frown className="w-20 h-20 text-princess-pink mx-auto mb-6" />
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
              ¡Entradas Agotadas!
            </h2>
            <p className="text-white/70 text-lg mb-6 max-w-md mx-auto">
              Lo sentimos, todas las entradas para este evento se han agotado.
              Síguenos en redes sociales para enterarte de futuras fechas.
            </p>
            <div className="flex justify-center gap-4">
              <a href="#" className="btn-secondary">Instagram</a>
              <a href="#" className="btn-secondary">Facebook</a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Single date: use original sold-out check from capacity slice
  if (!hasMultipleDates && availableTickets <= 0) {
    return (
      <section id="entradas" className="py-20 bg-gradient-to-b from-princess-purple/20 to-magic-dark">
        <div className="max-w-4xl mx-auto px-4">
          <div className="glass rounded-3xl p-12 text-center">
            <Frown className="w-20 h-20 text-princess-pink mx-auto mb-6" />
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
              ¡Entradas Agotadas!
            </h2>
            <p className="text-white/70 text-lg mb-6 max-w-md mx-auto">
              Lo sentimos, todas las entradas para este evento se han agotado.
              Síguenos en redes sociales para enterarte de futuras fechas.
            </p>
            <div className="flex justify-center gap-4">
              <a href="#" className="btn-secondary">Instagram</a>
              <a href="#" className="btn-secondary">Facebook</a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="entradas" className="py-20 bg-gradient-to-b from-princess-purple/20 to-magic-dark">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <Ticket className="w-6 h-6 text-princess-gold" />
            <span className="text-princess-gold font-medium">Reservas</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Compra tus <span className="text-gradient">Entradas</span>
          </h2>
        </div>

        {/* Age restriction notice */}
        <div className="mb-8 bg-gradient-to-r from-princess-pink/20 to-princess-purple/20 border-2 border-princess-pink rounded-2xl p-4 md:p-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-princess-pink flex-shrink-0" />
            <p className="text-white font-medium">
              <span className="text-princess-pink font-bold">Importante:</span> Evento exclusivo para niños a partir de 3 años
            </p>
          </div>
        </div>

        {/* Step indicator — scrolls horizontally without clipping the first step */}
        <div className="mb-10 overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex items-center w-max min-w-full justify-center mx-auto px-2">
          {steps.map((s, index) => (
            <div key={s.num} className="flex items-center">
              <button
                ref={s.num === step ? activeStepRef : null}
                onClick={() => s.num < step && dispatch(setStep(s.num))}
                disabled={s.num > step || (s.num === 0 && !hasMultipleDates)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full transition-all whitespace-nowrap ${
                  s.num === step
                    ? 'bg-princess-pink text-white'
                    : s.num < step
                    ? 'bg-white/20 text-white cursor-pointer hover:bg-white/30'
                    : 'bg-white/5 text-white/40 cursor-not-allowed'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                  {s.num === 0 ? <Calendar className="w-3 h-3" /> : s.num}
                </span>
                <span className="hidden sm:inline font-medium">{s.label}</span>
              </button>
              {index < steps.length - 1 && (
                <div className={`w-4 sm:w-8 lg:w-16 h-0.5 mx-1 sm:mx-2 ${s.num < step ? 'bg-princess-pink' : 'bg-white/20'}`} />
              )}
            </div>
          ))}
        </div>
        </div>

        {/* Step content */}
        <div ref={formRef} className="glass rounded-3xl p-6 md:p-10">
          {step === 0 && hasMultipleDates && (
            <div className="space-y-6">
              <h3 className="text-2xl font-display font-bold text-white text-center mb-2">
                Elige tu fecha
              </h3>
              <p className="text-white/60 text-center text-sm mb-6">
                Selecciona el día al que asistirás
              </p>
              <MonthCalendar
                openDates={eventDates}
                onSelect={handleSelectDate}
                selectedId={eventDateId}
              />
            </div>
          )}
          {step === 1 && <TicketCounter />}
          {step === 2 && <BookingForm />}
          {step === 3 && <AllergiesForm />}
          {step === 4 && <BookingSummary />}
        </div>
      </div>
    </section>
  );
}
