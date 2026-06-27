import { useParams, useNavigate } from 'react-router-dom'

const PAGES = {
  terminos: {
    title: 'Terminos y Condiciones',
    updated: '27 de junio de 2026',
    sections: [
      { t: '1. Aceptacion de los Terminos', p: 'Al acceder y utilizar NEXUS IA ("el Servicio"), proporcionado por POS Tecnologi ("la Empresa"), usted acepta estos terminos y condiciones en su totalidad. Si no esta de acuerdo con alguno de estos terminos, no utilice el Servicio.' },
      { t: '2. Descripcion del Servicio', p: 'NEXUS IA es una plataforma de gestion empresarial (ERP) basada en la nube que incluye facturacion electronica, inventario, CRM, contabilidad, nomina y otros modulos. El Servicio se ofrece bajo un modelo de suscripcion mensual (SaaS).' },
      { t: '3. Registro y Cuenta', p: 'Para utilizar el Servicio, debe registrarse proporcionando informacion veraz y actualizada. Usted es responsable de mantener la confidencialidad de sus credenciales de acceso y de todas las actividades realizadas bajo su cuenta.' },
      { t: '4. Periodo de Prueba', p: 'POS Tecnologi puede ofrecer un periodo de prueba gratuito. Al finalizar dicho periodo, debera contratar un plan de suscripcion para continuar utilizando el Servicio. La Empresa se reserva el derecho de modificar o eliminar el periodo de prueba.' },
      { t: '5. Planes y Pagos', p: 'El Servicio se ofrece en diferentes planes con distintas funcionalidades y limites. Los precios pueden ser modificados con previo aviso de 30 dias. El pago se realiza de forma mensual y anticipada.' },
      { t: '6. Datos del Usuario', p: 'Los datos ingresados por el usuario son de su propiedad. POS Tecnologi actua como custodio de dichos datos y se compromete a no compartirlos con terceros sin autorizacion expresa, salvo requerimiento legal.' },
      { t: '7. Disponibilidad del Servicio', p: 'POS Tecnologi se esfuerza por mantener una disponibilidad del 99.9%. Sin embargo, pueden existir interrupciones por mantenimiento programado o causas de fuerza mayor. Se notificara con anticipacion cualquier mantenimiento planificado.' },
      { t: '8. Facturacion Electronica', p: 'El modulo de facturacion electronica cumple con las normativas del Servicio de Rentas Internas (SRI) de Ecuador. El usuario es responsable de la veracidad de la informacion tributaria ingresada en el sistema.' },
      { t: '9. Cancelacion', p: 'El usuario puede cancelar su suscripcion en cualquier momento. Al cancelar, tendra acceso al Servicio hasta el final del periodo pagado. Los datos se mantendran disponibles por 30 dias despues de la cancelacion.' },
      { t: '10. Limitacion de Responsabilidad', p: 'POS Tecnologi no sera responsable por danos indirectos, perdida de datos por causas ajenas al Servicio, ni por el uso inadecuado de la plataforma por parte del usuario.' },
      { t: '11. Modificaciones', p: 'POS Tecnologi se reserva el derecho de modificar estos terminos. Los cambios seran notificados por correo electronico y entraran en vigencia 15 dias despues de la notificacion.' },
      { t: '12. Legislacion Aplicable', p: 'Estos terminos se rigen por las leyes de la Republica del Ecuador. Cualquier controversia sera resuelta en los tribunales competentes de la ciudad de Quito.' },
    ],
  },
  privacidad: {
    title: 'Politica de Privacidad',
    updated: '27 de junio de 2026',
    sections: [
      { t: '1. Informacion que Recopilamos', p: 'Recopilamos informacion que usted nos proporciona directamente: nombre, email, telefono, RUC/cedula, datos de la empresa. Tambien recopilamos datos de uso del sistema para mejorar el Servicio.' },
      { t: '2. Uso de la Informacion', p: 'Utilizamos su informacion para: proporcionar y mantener el Servicio, procesar transacciones, enviar comunicaciones relacionadas con el Servicio, cumplir con obligaciones legales y mejorar la experiencia del usuario.' },
      { t: '3. Proteccion de Datos', p: 'Implementamos medidas de seguridad tecnicas y organizativas para proteger sus datos: encriptacion de contrasenas (bcrypt), conexiones HTTPS/SSL, bases de datos aisladas por empresa y backups periodicos.' },
      { t: '4. Aislamiento de Datos', p: 'Cada empresa cliente tiene su propia base de datos independiente. Los datos de una empresa no son accesibles por otra empresa. Este aislamiento garantiza la confidencialidad total de su informacion.' },
      { t: '5. Comparticion de Datos', p: 'No vendemos, alquilamos ni compartimos su informacion personal con terceros, excepto: cuando sea necesario para prestar el Servicio, cuando lo exija la ley o una orden judicial, o con su consentimiento expreso.' },
      { t: '6. Facturacion y Datos Tributarios', p: 'Los datos de facturacion electronica se transmiten al SRI segun las normativas vigentes. POS Tecnologi no almacena informacion de tarjetas de credito directamente.' },
      { t: '7. Retencion de Datos', p: 'Mantenemos sus datos mientras su cuenta este activa. Tras la cancelacion, los datos se conservan por 30 dias y luego se eliminan de forma segura. Los datos tributarios se conservan segun los plazos legales de Ecuador.' },
      { t: '8. Derechos del Usuario', p: 'Usted tiene derecho a: acceder a sus datos personales, solicitar su correccion, solicitar su eliminacion (sujeto a obligaciones legales), exportar sus datos en formatos estandar (PDF, Excel).' },
      { t: '9. Cookies', p: 'Utilizamos almacenamiento local del navegador (localStorage) para mantener su sesion activa. No utilizamos cookies de rastreo ni compartimos informacion con redes publicitarias.' },
      { t: '10. Cambios en esta Politica', p: 'Podemos actualizar esta politica periodicamente. Los cambios se publicaran en esta pagina con la fecha de actualizacion. Le notificaremos por email sobre cambios significativos.' },
      { t: '11. Contacto', p: 'Para consultas sobre privacidad, contactenos: postecnologi@gmail.com | +593 99 903 8296 | Quito, Ecuador.' },
    ],
  },
  soporte: {
    title: 'Soporte Tecnico',
    updated: '27 de junio de 2026',
    sections: [
      { t: 'Canales de Atencion', p: 'Estamos disponibles para ayudarte a traves de los siguientes canales:' },
      { t: 'WhatsApp', p: 'Escribenos al +593 99 903 8296. Tiempo de respuesta: menos de 2 horas en horario laboral (lunes a viernes, 8:00 - 18:00).' },
      { t: 'Correo Electronico', p: 'Envía tu consulta a postecnologi@gmail.com. Respondemos en un maximo de 24 horas.' },
      { t: 'Horario de Atencion', p: 'Lunes a Viernes: 8:00 AM - 6:00 PM (hora de Ecuador, GMT-5). Sabados: 9:00 AM - 1:00 PM. Domingos y feriados: solo emergencias criticas.' },
      { t: 'Tipos de Soporte', p: 'Plan Basico: soporte por email. Plan Profesional: soporte por email y WhatsApp con prioridad. Plan Empresarial: soporte 24/7, atencion personalizada y capacitacion incluida.' },
      { t: 'Capacitacion', p: 'Ofrecemos sesiones de capacitacion virtual para nuevos clientes. La primera sesion es gratuita. Sesiones adicionales disponibles bajo demanda.' },
      { t: 'Reportar un Problema', p: 'Al reportar un problema, incluya: descripcion del error, pasos para reproducirlo, capturas de pantalla si es posible, y el modulo donde ocurre. Esto nos ayuda a resolver su caso mas rapido.' },
    ],
  },
}

export default function Legal() {
  const { page } = useParams()
  const nav = useNavigate()
  const data = PAGES[page]

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, color: '#0F172A' }}>Pagina no encontrada</h1>
          <button onClick={() => nav('/')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#7C3AED', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Volver al inicio</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0F172A,#1E1B4B)', padding: '40px 20px 48px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <button onClick={() => nav('/')} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 14, marginBottom: 16, padding: 0 }}>
            ← Volver al inicio
          </button>
          <h1 style={{ fontSize: 'clamp(24px,4vw,36px)', fontWeight: 800, color: 'white', marginBottom: 8 }}>{data.title}</h1>
          <p style={{ color: '#94A3B8', fontSize: 14 }}>Ultima actualizacion: {data.updated}</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px 80px' }}>
        {data.sections.map((s, i) => (
          <div key={i} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>{s.t}</h2>
            <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.8 }}>{s.p}</p>
          </div>
        ))}

        {page === 'soporte' && (
          <div style={{ marginTop: 40, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="https://wa.me/593999038296" target="_blank" rel="noopener"
              style={{ padding: '14px 28px', borderRadius: 10, background: '#25D366', color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>
              WhatsApp
            </a>
            <a href="mailto:postecnologi@gmail.com"
              style={{ padding: '14px 28px', borderRadius: 10, background: '#3B82F6', color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>
              Enviar email
            </a>
          </div>
        )}

        <div style={{ marginTop: 48, padding: 20, background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', textAlign: 'center' }}>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 12 }}>POS Tecnologi — NEXUS IA</p>
          <p style={{ color: '#94A3B8', fontSize: 13 }}>postecnologi@gmail.com | +593 99 903 8296 | Quito, Ecuador</p>
        </div>
      </div>
    </div>
  )
}
