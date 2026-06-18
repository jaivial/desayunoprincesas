import { useState } from 'react';
import { useSelector } from 'react-redux';
import { HelpCircle, ChevronDown } from 'lucide-react';

const getFaqs = (childPrice, adultPrice, eventDate) => [
  {
    question: '¿A partir de qué edad pueden asistir los niños?',
    answer: 'El evento está diseñado exclusivamente para niños a partir de 3 años. Los menores de esta edad no podrán participar en las actividades ni acceder al evento. Todos los menores deben estar acompañados por al menos un adulto responsable durante toda la duración del evento.'
  },
  {
    question: '¿Necesitan entrada todas las personas que accedan al recinto?',
    answer: 'Sí, todos los asistentes al evento solo podrán acceder con entrada válida, independientemente de si son partícipes de la experiencia o no. No se permitirá el acceso a ninguna persona sin su correspondiente entrada bajo ninguna circunstancia.'
  },
  {
    question: '¿Puedo acceder con carrito de bebé?',
    answer: 'No, por motivos de aforo, seguridad y normativa de evacuación, y para asegurar que las princesas cuenten con el espacio necesario para sus actuaciones, está prohibido el acceso con carros de bebé al interior del salón. La organización habilitará un área de parking de carritos en el exterior.'
  },
  {
    question: '¿Cómo funciona el acceso con código QR?',
    answer: 'Para acceder al evento es imprescindible presentar el código QR de la entrada, ya sea impreso o en formato digital desde su móvil. El código QR es personal e intransferible y será escaneado por el personal en la entrada. Sin código QR válido no se podrá acceder al recinto.'
  },
  {
    question: '¿Qué incluye la entrada infantil?',
    answer: `La entrada infantil (${childPrice}€) incluye el desayuno temático completo ("Cofre del Tesoro"), la corona o diadema de regalo, el Pasaporte Real, acceso a todos los talleres creativos con las princesas, y el Certificado de Nobleza al finalizar.`
  },
  {
    question: '¿Qué incluye la entrada de adulto?',
    answer: `La entrada de adulto (${adultPrice}€) incluye un Brunch Real gourmet con bollería artesana, productos de alta calidad, zumos naturales y café de especialidad, además de acceso completo al evento y la posibilidad de acompañar a los pequeños en todas las actividades.`
  },
  {
    question: '¿Qué incluye el menú infantil?',
    answer: '¡Un festín digno de la Realeza! 👑🍓 Hemos diseñado un menú mágico donde el sabor y la fantasía se unen: 🥪 Minisandwiches Reales (de pavo y queso, y de Nutella), 🍞 Cesta de panes variados con confituras, AOVE y mantequilla, 🥐 Croissants de la Corte (de mantequilla y chocolate), 🍢 Brochetas Mágicas de frutas frescas, 🥞 Torres de Castillo (tortitas con sirope), 🍪 Galletas y bizcochos caseros de Hada. ✨ Bebidas de Fantasía: nuestra "Poción Real" (zumo favorito) y leche con chocolate. Para los papis, su café favorito. 💖 Todo elaborado con mimo para que cada bocado cuente una historia.'
  },
  {
    question: '¿Hay opciones para alergias alimentarias?',
    answer: 'Sí, adaptamos los menús a cualquier alergia o intolerancia alimentaria. Por favor, indíquelo en el momento de la reserva para que nuestro equipo de cocina prepare un menú especial. Tenga en cuenta que, aunque se extreman las medidas de seguridad, no puede garantizarse la ausencia total de trazas.'
  },
  {
    question: '¿Qué princesas estarán en el evento?',
    answer: 'Contaremos con la presencia de Blancanieves, Jazmín, Bella y Ariel. Las cuatro princesas acompañarán a las pequeñas durante toda la jornada, visitando las mesas durante el desayuno y guiando los talleres temáticos.'
  },
  {
    question: '¿Habrá fotógrafo profesional?',
    answer: 'Sí, contaremos con un fotógrafo profesional que capturará los mejores momentos. Al finalizar el evento, las familias recibirán instrucciones para acceder a una galería digital privada donde podrán adquirir sus recuerdos en alta resolución.'
  },
  {
    question: '¿Se tomarán fotos y vídeos durante el evento?',
    answer: 'Sí, durante el evento habrá un fotógrafo profesional. Al adquirir las entradas, los padres, madres o tutores legales aceptan y autorizan expresamente la cesión de los derechos de imagen de los menores a su cargo para fines de marketing y publicidad de Alquería Villa Carmen (redes sociales, web, materiales promocionales).'
  },
  {
    question: '¿Cuál es la política de cancelación?',
    answer: 'No se admitirán devoluciones de entradas una vez adquiridas, salvo cancelación total del evento por causas imputables a la organización. En caso de fuerza mayor, se comunicará cualquier cambio de fecha u horario a través de los medios de contacto proporcionados en la compra.'
  },
  {
    question: '¿Qué pasa si llueve?',
    answer: 'La recepción y entrega de coronas se realiza en el exterior, pero el resto del evento (desayuno, talleres y espectáculo) se celebra en el interior climatizado de Alquería Villa Carmen, por lo que la lluvia no afectará a la experiencia.'
  },
  {
    question: '¿Cuándo es el evento y a qué hora debo llegar?',
    answer: `El próximo evento será el ${eventDate}. Recomendamos llegar con 10-15 minutos de antelación para el proceso de registro y acceso. El evento comenzará puntualmente para respetar la experiencia de todos los asistentes.`
  },
  {
    question: '¿Las plazas son limitadas?',
    answer: 'Sí, el aforo es estrictamente limitado para garantizar la exclusividad y la mejor interacción posible con las princesas. Recomendamos reservar con antelación.'
  }
];

function AccordionItem({ question, answer, isOpen, onClick }) {
  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        type="button"
        onClick={onClick}
        className="w-full py-5 flex items-center justify-between text-left hover:text-princess-pink transition-colors"
        aria-expanded={isOpen}
      >
        <span className="text-white font-medium pr-4">{question}</span>
        <ChevronDown 
          className={`w-5 h-5 text-princess-pink flex-shrink-0 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-96 pb-5' : 'max-h-0'
        }`}
      >
        <p className="text-white/70 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);
  const settings = useSelector((state) => state.settings.data);

  const adultPrice = settings?.adultPriceCents ? (settings.adultPriceCents / 100).toFixed(0) : '35';
  const childPrice = settings?.childPriceCents ? (settings.childPriceCents / 100).toFixed(0) : '49';
  
  const formatDate = (dateString) => {
    if (!dateString) return 'fecha por confirmar';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const eventDate = formatDate(settings?.eventDate);
  const faqs = getFaqs(childPrice, adultPrice, eventDate);

  const toggleItem = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      id="faq"
      className="py-20 bg-magic-dark"
      aria-labelledby="faq-heading"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <HelpCircle className="w-6 h-6 text-princess-pink" aria-hidden="true" />
            <span className="text-princess-pink font-medium">FAQ</span>
          </div>
          <h2
            id="faq-heading"
            className="font-display text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Preguntas <span className="text-gradient">Frecuentes</span>
          </h2>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Todo lo que necesitas saber sobre el Desayuno Real
          </p>
        </div>

        <div className="glass rounded-3xl p-6 md:p-8">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onClick={() => toggleItem(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
