import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchKpis } from '../store/kpisSlice';
import { Ticket, DollarSign, CreditCard, Banknote, Users, Baby, CalendarCheck, CalendarDays, Loader2 } from 'lucide-react';

const formatCurrency = (cents) => `${(cents / 100).toFixed(2)}€`;

const formatEventDay = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return new Date(`${y}-${m}-${d}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
};

const KPICard = ({ icon: Icon, label, value, color, format = 'number' }) => {
  const displayValue = format === 'currency' ? formatCurrency(value) : value;
  return (
    <div className="card flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm text-gray-500 truncate">{label}</p>
        <p className="text-xl sm:text-2xl font-bold truncate">{displayValue}</p>
      </div>
    </div>
  );
};

const Stat = ({ label, value, valueClass = '' }) => (
  <div className="min-w-0">
    <p className="text-[11px] sm:text-xs text-gray-500 truncate">{label}</p>
    <p className={`text-base sm:text-lg font-semibold truncate ${valueClass}`}>{value}</p>
  </div>
);

const DateKPICard = ({ date }) => {
  const isFull = date.availableCapacity <= 0;
  return (
    <div className="card p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${date.isOpen ? 'bg-primary-600' : 'bg-gray-400'}`}>
          <CalendarDays className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold capitalize truncate">{formatEventDay(date.eventDate)}</p>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${date.isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {date.isOpen ? 'Abierto' : 'Cerrado'}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <Stat label="Entradas vendidas" value={date.ticketsSold} />
        <Stat
          label="Entradas libres"
          value={date.availableCapacity}
          valueClass={isFull ? 'text-red-600' : 'text-green-600'}
        />
        <Stat label="Aforo máximo" value={date.maxCapacity} />
        <Stat label="Adultos" value={date.adultTickets} />
        <Stat label="Niños" value={date.childTickets} />
        <Stat label="Asist. confirmada" value={date.confirmedAttendance} />
        <Stat label="Ingresos" value={formatCurrency(date.amountEarned)} />
        <Stat label="Online" value={formatCurrency(date.paidOnline)} />
        <Stat label="Efectivo" value={formatCurrency(date.paidCash)} />
      </div>
    </div>
  );
};

export default function HomePage() {
  const dispatch = useDispatch();
  const { data: kpis, loading } = useSelector((state) => state.kpis);

  useEffect(() => {
    dispatch(fetchKpis());
  }, [dispatch]);

  if (loading || !kpis) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const dates = kpis.dates || [];

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Dashboard</h1>

      <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-3">Balance global</h2>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
        <KPICard icon={Ticket} label="Entradas vendidas" value={kpis.totalTicketsSold} color="bg-blue-500" />
        <KPICard icon={DollarSign} label="Ingresos totales" value={kpis.totalAmountEarned} color="bg-green-500" format="currency" />
        <KPICard icon={CreditCard} label="Pagos online" value={kpis.amountPaidOnline} color="bg-purple-500" format="currency" />
        <KPICard icon={Banknote} label="Pagos efectivo" value={kpis.amountPaidCash} color="bg-yellow-500" format="currency" />
        <KPICard icon={Users} label="Adultos" value={kpis.totalAdultTickets} color="bg-indigo-500" />
        <KPICard icon={Baby} label="Niños" value={kpis.totalChildTickets} color="bg-pink-500" />
        <KPICard icon={CalendarCheck} label="Asist. confirmada" value={kpis.confirmedAttendance} color="bg-teal-500" />
      </div>

      <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-3">Detalle por fecha</h2>
      {dates.length === 0 ? (
        <div className="card p-6 text-center text-gray-500">No hay fechas de evento configuradas.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
          {dates.map((d) => (
            <DateKPICard key={d.eventDateId} date={d} />
          ))}
        </div>
      )}
    </div>
  );
}
