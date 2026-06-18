import { useSelector, useDispatch } from 'react-redux';
import { useEffect, useRef } from 'react';
import { Ticket, Frown, AlertCircle } from 'lucide-react';
import TicketCounter from '../booking/TicketCounter';
import BookingForm from '../booking/BookingForm';
import AllergiesForm from '../booking/AllergiesForm';
import BookingSummary from '../booking/BookingSummary';
import { setStep } from '../../store/bookingSlice';

export default function TicketWizard() {
  const dispatch = useDispatch();
  const { step } = useSelector((state) => state.booking);
  const formRef = useRef(null);

  useEffect(() => {
    if (formRef.current) {
      const y = formRef.current.getBoundingClientRect().top + window.scrollY - 300;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, [step]);
  const { availableTickets, loading } = useSelector((state) => state.capacity);

  const steps = [
    { num: 1, label: 'Entradas' },
    { num: 2, label: 'Datos' },
    { num: 3, label: 'Alergias' },
    { num: 4, label: 'Confirmar' },
  ];

  if (loading) {
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

  if (availableTickets <= 0) {
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

        {/* Step indicator */}
        <div className="flex items-center justify-center mb-10 overflow-x-auto pb-2">
          {steps.map((s, index) => (
            <div key={s.num} className="flex items-center">
              <button
                onClick={() => s.num < step && dispatch(setStep(s.num))}
                disabled={s.num > step}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full transition-all whitespace-nowrap ${
                  s.num === step
                    ? 'bg-princess-pink text-white'
                    : s.num < step
                    ? 'bg-white/20 text-white cursor-pointer hover:bg-white/30'
                    : 'bg-white/5 text-white/40 cursor-not-allowed'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                  {s.num}
                </span>
                <span className="hidden sm:inline font-medium">{s.label}</span>
              </button>
              {index < steps.length - 1 && (
                <div className={`w-4 sm:w-8 lg:w-16 h-0.5 mx-1 sm:mx-2 ${s.num < step ? 'bg-princess-pink' : 'bg-white/20'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div ref={formRef} className="glass rounded-3xl p-6 md:p-10">
          {step === 1 && <TicketCounter />}
          {step === 2 && <BookingForm />}
          {step === 3 && <AllergiesForm />}
          {step === 4 && <BookingSummary />}
        </div>
      </div>
    </section>
  );
}
