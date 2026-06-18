import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchKpis } from '../store/kpisSlice';
import { Ticket, DollarSign, CreditCard, Banknote, Users, Baby, CalendarCheck, Loader2 } from 'lucide-react';

const KPICard = ({ icon: Icon, label, value, color, format = 'number' }) => {
  const displayValue = format === 'currency' ? `${(value / 100).toFixed(2)}€` : value;
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

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <KPICard icon={Ticket} label="Entradas vendidas" value={kpis.totalTicketsSold} color="bg-blue-500" />
        <KPICard icon={DollarSign} label="Ingresos totales" value={kpis.totalAmountEarned} color="bg-green-500" format="currency" />
        <KPICard icon={CreditCard} label="Pagos online" value={kpis.amountPaidOnline} color="bg-purple-500" format="currency" />
        <KPICard icon={Banknote} label="Pagos efectivo" value={kpis.amountPaidCash} color="bg-yellow-500" format="currency" />
        <KPICard icon={Users} label="Adultos" value={kpis.totalAdultTickets} color="bg-indigo-500" />
        <KPICard icon={Baby} label="Niños" value={kpis.totalChildTickets} color="bg-pink-500" />
        <KPICard icon={Ticket} label="Capacidad disp." value={kpis.availableCapacity} color="bg-gray-500" />
        <KPICard icon={CalendarCheck} label="Asist. confirmada" value={kpis.confirmedAttendance} color="bg-teal-500" />
      </div>
    </div>
  );
}
