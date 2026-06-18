import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { updateCapacity } from '../store/capacitySlice';
import Navbar from '../components/layout/Navbar';
import Hero from '../components/sections/Hero';
import Gallery from '../components/sections/Gallery';
import Schedule from '../components/sections/Schedule';
import Includes from '../components/sections/Includes';
import PacksInfo from '../components/sections/PacksInfo';
import TicketWizard from '../components/sections/TicketWizard';
import Location from '../components/sections/Location';
import FAQ from '../components/sections/FAQ';
import Footer from '../components/layout/Footer';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws/capacity';

export default function LandingPage() {
  const dispatch = useDispatch();

  useEffect(() => {
    let ws;
    let reconnectTimeout;

    const connect = () => {
      ws = new WebSocket(WS_URL);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'capacity.updated') {
            dispatch(updateCapacity({
              maxCapacity: data.maxCapacity,
              soldTickets: data.soldTickets,
              availableTickets: data.availableTickets,
            }));
          }
        } catch (err) {
          console.error('WebSocket message error:', err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-magic-dark">
      <Navbar />
      <Hero />
      <Gallery />
      <Schedule />
      <Includes />
      <PacksInfo />
      <TicketWizard />
      <Location />
      <FAQ />
      <Footer />
    </div>
  );
}
