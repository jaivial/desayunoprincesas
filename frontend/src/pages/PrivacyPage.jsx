import { Shield, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPage() {
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
            <Shield className="w-8 h-8 text-princess-pink" />
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white">
              Política de Privacidad
            </h1>
          </div>

          <div className="prose prose-invert max-w-none space-y-6 text-white/80">
            <p className="text-white/60 text-sm">
              El Desayuno Real — Alquería Villa Carmen
            </p>
            <p className="text-white/60 text-sm">
              Última actualización: Junio 2025
            </p>

            <p className="text-white/90 leading-relaxed">
              La presente Política de Privacidad tiene por objeto informarle sobre el tratamiento de sus datos personales 
              y los de los menores a su cargo, en cumplimiento del Reglamento General de Protección de Datos (RGPD) 
              y la Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).
            </p>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">1. Responsable del Tratamiento</h2>
              <ul className="list-none pl-0 space-y-2">
                <li><strong>Identidad:</strong> Alquería Villa Carmen</li>
                <li><strong>Domicilio:</strong> C/ Sequía de Rascanya, 2, 46470 Catarroja, Valencia, España</li>
                <li><strong>Teléfono:</strong> +34 638 857 294</li>
                <li><strong>Email:</strong> reservas@alqueriavillacarmen.com</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">2. Datos Personales que Recopilamos</h2>
              <p>Durante el proceso de reserva y participación en el evento "El Desayuno Real", recopilamos:</p>
              
              <h3 className="text-lg font-medium text-white mt-4 mb-2">Datos del titular de la reserva (adulto):</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Nombre y apellidos completos</li>
                <li>Documento de identidad (DNI/NIE/Pasaporte)</li>
                <li>Correo electrónico</li>
                <li>Número de teléfono</li>
                <li>Datos de facturación y pago</li>
              </ul>

              <h3 className="text-lg font-medium text-white mt-4 mb-2">Datos de los menores asistentes:</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Nombre y apellidos</li>
                <li>Edad</li>
                <li>Información sobre alergias e intolerancias alimentarias</li>
                <li>Imágenes y vídeos captados durante el evento</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">3. Finalidad del Tratamiento</h2>
              <p>Sus datos personales serán tratados con las siguientes finalidades:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Gestión de reservas:</strong> Procesar y confirmar su reserva, emisión de entradas y códigos QR de acceso.</li>
                <li><strong>Comunicaciones operativas:</strong> Envío de confirmaciones, recordatorios y cualquier información relevante sobre el evento.</li>
                <li><strong>Seguridad alimentaria:</strong> Gestión de alergias e intolerancias para adaptar los menús.</li>
                <li><strong>Control de acceso:</strong> Verificación de identidad y entradas en el evento.</li>
                <li><strong>Uso promocional de imágenes:</strong> Captación y difusión de fotografías y vídeos del evento.</li>
                <li><strong>Comunicaciones comerciales:</strong> Envío de información sobre futuros eventos (solo con consentimiento expreso).</li>
                <li><strong>Cumplimiento legal:</strong> Atender obligaciones legales, fiscales y contables.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">4. Cesión de Derechos de Imagen de Menores</h2>
              <div className="bg-princess-pink/20 border border-princess-pink/40 rounded-lg p-5 mb-4">
                <p className="text-white font-medium m-0 mb-3">
                  📸 <strong>IMPORTANTE - AUTORIZACIÓN DE IMAGEN DE MENORES:</strong>
                </p>
                <p className="text-white/90 m-0 leading-relaxed">
                  Al aceptar la presente Política de Privacidad y completar la reserva, el padre, madre o tutor legal 
                  de los menores de 18 años asistentes al evento <strong>AUTORIZA EXPRESAMENTE</strong> a Alquería Villa Carmen 
                  a captar, reproducir y difundir la imagen de dichos menores (fotografías y vídeos) con fines promocionales 
                  y de difusión del evento "El Desayuno Real".
                </p>
              </div>
              
              <p>Esta autorización incluye:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>La captación de imágenes (fotografías y vídeos) durante el desarrollo del evento.</li>
                <li>La reproducción y publicación de dichas imágenes en las redes sociales oficiales de Alquería Villa Carmen (Instagram, Facebook, TikTok, etc.).</li>
                <li>El uso de las imágenes en la página web oficial y materiales promocionales digitales.</li>
                <li>La difusión en medios de comunicación para promocionar futuros eventos.</li>
                <li>El almacenamiento de las imágenes por tiempo indefinido mientras no se revoque el consentimiento.</li>
              </ul>

              <div className="bg-amber-500/20 border border-amber-500/40 rounded-lg p-4 mt-4">
                <p className="text-white/90 m-0">
                  <strong>Garantías:</strong> Las imágenes serán utilizadas únicamente con fines promocionales legítimos, 
                  respetando la dignidad e integridad de los menores, y nunca serán cedidas a terceros con fines comerciales 
                  ajenos a la promoción de los eventos de Alquería Villa Carmen.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">5. Exclusión del Uso de Imagen</h2>
              <p>Si <strong>NO desea</strong> que su hijo/a o menor a su cargo aparezca en material promocional, deberá:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Comunicarlo <strong>expresamente por escrito</strong> antes del evento enviando un email a reservas@alqueriavillacarmen.com indicando los datos del menor.</li>
                <li>Notificarlo al personal de organización a la entrada del evento.</li>
              </ul>
              <p className="mt-4">
                En tal caso, se establecerá un sistema de identificación discreta para que el equipo de fotografía 
                y grabación respete esta preferencia durante todo el evento.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">6. Legitimación del Tratamiento</h2>
              <p>La base legal para el tratamiento de sus datos es:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Ejecución de contrato:</strong> El tratamiento es necesario para gestionar su reserva y participación en el evento (Art. 6.1.b RGPD).</li>
                <li><strong>Consentimiento:</strong> Para el uso de imágenes con fines promocionales y el envío de comunicaciones comerciales (Art. 6.1.a RGPD).</li>
                <li><strong>Interés legítimo:</strong> Para la seguridad del evento y prevención del fraude (Art. 6.1.f RGPD).</li>
                <li><strong>Obligación legal:</strong> Para el cumplimiento de obligaciones fiscales y legales (Art. 6.1.c RGPD).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">7. Conservación de los Datos</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Datos de reserva:</strong> Se conservarán durante el tiempo necesario para la gestión del evento y posteriormente durante los plazos legales establecidos (mínimo 5 años para obligaciones fiscales).</li>
                <li><strong>Datos de alergias:</strong> Se eliminarán una vez finalizado el evento, salvo que se requieran para futuras reservas.</li>
                <li><strong>Imágenes autorizadas:</strong> Podrán conservarse y utilizarse indefinidamente para fines promocionales, salvo revocación del consentimiento.</li>
                <li><strong>Comunicaciones comerciales:</strong> Hasta que se retire el consentimiento.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">8. Derechos del Interesado</h2>
              <p>Usted tiene derecho a:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Acceso:</strong> Conocer qué datos personales suyos y de los menores a su cargo están siendo tratados.</li>
                <li><strong>Rectificación:</strong> Solicitar la corrección de datos inexactos o incompletos.</li>
                <li><strong>Supresión ("derecho al olvido"):</strong> Solicitar la eliminación de sus datos cuando ya no sean necesarios.</li>
                <li><strong>Limitación:</strong> Solicitar la limitación del tratamiento en determinadas circunstancias.</li>
                <li><strong>Oposición:</strong> Oponerse al tratamiento de sus datos, especialmente para fines de marketing.</li>
                <li><strong>Portabilidad:</strong> Recibir sus datos en un formato estructurado y de uso común.</li>
                <li><strong>Revocación del consentimiento:</strong> Retirar el consentimiento otorgado en cualquier momento, sin que ello afecte a la licitud del tratamiento previo.</li>
              </ul>
              <p className="mt-4">
                Para ejercer estos derechos, puede contactar con nosotros enviando un email a reservas@alqueriavillacarmen.com 
                o mediante comunicación escrita a nuestra dirección postal, acompañando copia de su documento de identidad.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">9. Revocación de Autorización de Imagen</h2>
              <p>El padre, madre o tutor legal puede revocar el consentimiento de uso de imágenes de menores en cualquier momento mediante:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Comunicación escrita por email a reservas@alqueriavillacarmen.com</li>
                <li>Carta postal a nuestra dirección</li>
              </ul>
              <p className="mt-4">
                Alquería Villa Carmen procederá a la retirada de las imágenes identificables de sus redes sociales y 
                medios digitales en un plazo máximo de <strong>72 horas</strong> desde la recepción de la solicitud.
              </p>
              <p className="mt-2 text-white/60 text-sm">
                Nota: La revocación no afectará a la licitud del tratamiento basado en el consentimiento previo a su retirada, 
                ni será posible retirar imágenes que ya hayan sido compartidas por terceros.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">10. Medidas de Seguridad</h2>
              <p>
                Alquería Villa Carmen se compromete a adoptar las medidas técnicas y organizativas necesarias, 
                según el nivel de riesgo, para garantizar la seguridad de los datos personales y evitar su alteración, 
                pérdida, tratamiento o acceso no autorizado, de conformidad con el estado de la tecnología, 
                la naturaleza de los datos y los riesgos a los que están expuestos.
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Cifrado de datos en tránsito y en reposo</li>
                <li>Acceso restringido a personal autorizado</li>
                <li>Copias de seguridad periódicas</li>
                <li>Protocolos de seguridad en el procesamiento de pagos</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">11. Destinatarios de los Datos</h2>
              <p>Sus datos podrán ser comunicados a:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Proveedores de servicios:</strong> Plataformas de pago, servicios de email marketing (solo con su consentimiento).</li>
                <li><strong>Administraciones públicas:</strong> Cuando exista obligación legal.</li>
                <li><strong>Fuerzas y cuerpos de seguridad:</strong> En caso de requerimiento legal.</li>
              </ul>
              <p className="mt-4">
                No se realizarán transferencias internacionales de datos fuera del Espacio Económico Europeo 
                sin las garantías adecuadas.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">12. Reclamaciones</h2>
              <p>
                Si considera que el tratamiento de sus datos personales no se ajusta a la normativa vigente, 
                tiene derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD):
              </p>
              <ul className="list-none pl-0 space-y-2 mt-4">
                <li><strong>Web:</strong> www.aepd.es</li>
                <li><strong>Dirección:</strong> C/ Jorge Juan, 6, 28001 Madrid</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mt-8 mb-4">13. Contacto</h2>
              <p>Para cualquier consulta relacionada con la protección de datos o el ejercicio de sus derechos:</p>
              <ul className="list-none pl-0 space-y-2 mt-4">
                <li><strong>Email:</strong> reservas@alqueriavillacarmen.com</li>
                <li><strong>Teléfono:</strong> +34 638 857 294</li>
                <li><strong>Dirección:</strong> C/ Sequía de Rascanya, 2, 46470 Catarroja, Valencia</li>
              </ul>
            </section>

            <div className="mt-10 pt-6 border-t border-white/10">
              <div className="bg-princess-purple/20 border border-princess-purple/40 rounded-lg p-5">
                <p className="text-white font-medium m-0 mb-3">
                  ✅ <strong>ACEPTACIÓN:</strong>
                </p>
                <p className="text-white/90 m-0 leading-relaxed">
                  Al completar la reserva para "El Desayuno Real", usted declara haber leído y comprendido esta Política de Privacidad 
                  y, en calidad de padre, madre o tutor legal de los menores de 18 años incluidos en la reserva, 
                  <strong> OTORGA SU CONSENTIMIENTO EXPRESO </strong> para el tratamiento de los datos personales y la cesión 
                  de los derechos de imagen de dichos menores en los términos aquí descritos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
