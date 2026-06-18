import { FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-magic-dark py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>

        <div className="glass rounded-3xl p-8 md:p-12">
          <div className="flex items-center gap-3 mb-8">
            <FileText className="w-8 h-8 text-princess-pink" />
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white">
              Términos y Condiciones
            </h1>
          </div>

          <div className="prose prose-invert max-w-none space-y-6 text-white/80">
            <p className="text-white/60 text-sm">
              El Desayuno Real — Alquería Villa Carmen
            </p>

            <p className="text-white/90 leading-relaxed">
              Al adquirir su entrada para "El Desayuno Real", usted acepta cumplir con las siguientes condiciones 
              para garantizar el disfrute y la seguridad de todos los asistentes.
            </p>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">1. Edad Recomendada y Acompañamiento</h2>
              <div className="bg-princess-pink/20 border border-princess-pink/40 rounded-lg p-4 mb-4">
                <p className="text-white font-medium m-0">
                  ⚠️ <strong>Importante:</strong> El evento está diseñado exclusivamente para niños a partir de 3 años. 
                  Los menores de esta edad no podrán participar en las actividades ni acceder al evento.
                </p>
              </div>
              <ul className="list-disc pl-6 space-y-2">
                <li>Todos los menores de edad deben estar acompañados por, al menos, un adulto responsable durante toda la duración del evento.</li>
                <li>La organización no se hace responsable de la supervisión de menores sin acompañante.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">2. Acceso al Recinto</h2>
              <div className="bg-princess-pink/20 border border-princess-pink/40 rounded-lg p-4 mb-4">
                <p className="text-white font-medium m-0">
                  🎟️ <strong>Importante:</strong> Todos los asistentes al evento solo podrán acceder con entrada válida, 
                  independientemente de si son partícipes de la experiencia o no. No se permitirá el acceso a ninguna persona 
                  sin su correspondiente entrada.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">3. Restricción de Carritos de Bebé</h2>
              <div className="bg-amber-500/20 border border-amber-500/40 rounded-lg p-4 mb-4">
                <p className="text-white font-medium m-0">
                  🚫 Por motivos de aforo, seguridad y normativa de evacuación, y para asegurar que las princesas cuenten 
                  con el espacio necesario para realizar sus actuaciones y desplazarse entre los asistentes, 
                  <strong> está prohibido el acceso con carros de bebé (carritos) al interior del salón.</strong>
                </p>
              </div>
              <ul className="list-disc pl-6 space-y-2">
                <li>La organización habilitará un área de parking de carritos en el exterior del salón.</li>
                <li>No nos hacemos responsables de objetos personales dejados en los mismos.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">4. Control de Acceso: Entrada Digital (Código QR)</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Para acceder al evento, es <strong>imprescindible</strong> presentar el código QR de la entrada, ya sea impreso o en formato digital desde su dispositivo móvil.</li>
                <li>El código QR es personal e intransferible.</li>
                <li>El personal escaneará dicho código en la entrada. Aquellas personas (incluyendo acompañantes) que no presenten un código QR válido no podrán acceder al recinto bajo ninguna circunstancia.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">5. Normas de Convivencia y Seguridad</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Se ruega mantener un comportamiento respetuoso con las princesas, el resto de los asistentes y el personal del evento.</li>
                <li>El uso de las áreas designadas para la actuación es exclusivo para las princesas durante sus intervenciones.</li>
                <li>Se solicita a los padres que supervisen que los niños no obstaculicen el espacio de actuación para evitar accidentes.</li>
                <li>Los niños deberán tratar con respeto al resto de asistentes, personajes y material decorativo.</li>
                <li>La organización se reserva el derecho de admisión y la facultad de expulsar del recinto a cualquier persona que no siga las instrucciones del personal o que altere el buen desarrollo del evento, sin derecho a devolución.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">6. Política de Cancelación y Cambios</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>No se admitirán devoluciones</strong> de entradas una vez adquiridas, salvo cancelación total del evento por causas imputables a la organización.</li>
                <li>En caso de fuerza mayor (ajena a la voluntad de la organización), se comunicará cualquier cambio de fecha o horario a través de los medios de contacto proporcionados en la compra.</li>
                <li>En caso de no asistencia sin previo aviso, la reserva se considerará consumida.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">7. Alergias e Intolerancias Alimentarias</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>La organización <strong>no se hace responsable</strong> de las reacciones alérgicas a alimentos servidos durante el desayuno.</li>
                <li>Si su hijo/a tiene alguna alergia o intolerancia alimentaria, es responsabilidad del adulto informar durante el proceso de reserva o comunicarlo al personal antes del evento.</li>
                <li>Aunque se extremarán las medidas de seguridad, no puede garantizarse la ausencia total de trazas.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">8. Derechos de Imagen y Privacidad</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Al asistir al evento, usted autoriza a la organización a capturar fotografías y/o vídeos en los que pueda aparecer el asistente, con fines promocionales o de difusión del evento en redes sociales y medios propios.</li>
                <li>Si no desea aparecer en material promocional, deberá notificarlo por escrito a la entrada del evento.</li>
                <li>Sus datos personales facilitados en la compra serán tratados de acuerdo con la normativa vigente de protección de datos (RGPD).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">9. Objetos Personales</h2>
              <p>La organización no se hace responsable de la pérdida, robo o daño de objetos personales dentro del recinto, 
              incluyendo aquellos dejados en el área de parking de carritos.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">10. Puntualidad</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Se recomienda acudir con al menos 10-15 minutos de antelación para el proceso de registro y acceso.</li>
                <li>El evento comenzará a la hora prevista para respetar la experiencia de todos los asistentes.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">11. Modificaciones del Programa</h2>
              <p>El orden de las actividades y la participación de los personajes podrá sufrir pequeñas modificaciones 
              por motivos organizativos o de fuerza mayor, manteniéndose siempre la esencia y duración del evento.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">12. Personajes y Expectativas</h2>
              <p>Los personajes participantes son interpretaciones artísticas y no guardan relación con ninguna marca 
              o compañía de entretenimiento. La experiencia está diseñada con fines lúdicos y de fantasía.</p>
            </section>

            <div className="mt-10 pt-6 border-t border-white/10">
              <p className="text-white/60 text-sm italic">
                Al completar su reserva, usted confirma haber leído, entendido y aceptado estos términos y condiciones 
                en su totalidad. Una copia de estos términos será enviada junto con su confirmación de compra y código QR.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
