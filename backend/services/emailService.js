const fetch = require('node-fetch');

const API_KEY = process.env.ELASTIC_EMAIL_API_KEY;
const EMAIL_REMITENTE = process.env.EMAIL_REMITENTE || 'notificaciones@ceduc.cl';
const NOMBRE_REMITENTE = 'CEDUC - Asuntos Estudiantiles';
const URL_PLATAFORMA = process.env.FRONTEND_URL || 'http://localhost:5173';

// ============================================
// TEMPLATES HTML
// ============================================

/**
 * Genera el HTML para el correo de cancelación de cita
 */
function generarHtmlCancelacion(nombreEstudiante, fechaCita, motivo) {
  const fechaFormateada = new Date(fechaCita).toLocaleString('es-CL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ef4444, #b91c1c); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .btn { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        .alert { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; color: #991b1b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Cita Cancelada</h1>
          <p>Asuntos Estudiantiles CEDUC</p>
        </div>
        <div class="content">
          <h2>Hola ${nombreEstudiante},</h2>
          
          <p>Te informamos que tu cita programada ha sido <strong>cancelada</strong> por la Asistente Social.</p>
          
          <div class="alert">
            <p><strong>Fecha original:</strong> ${fechaFormateada}</p>
            ${motivo ? `<p><strong>Motivo/Observación:</strong> ${motivo}</p>` : ''}
          </div>
          
          <p>Entendemos que esto puede causar inconvenientes. Te invitamos a reagendar tu cita lo antes posible a través de la plataforma.</p>
          
          <p style="text-align: center;">
            <a href="${URL_PLATAFORMA}" class="btn">Reagendar Ahora</a>
          </p>
          
          <p>Saludos cordiales,<br>
          <strong>Equipo de Asuntos Estudiantiles</strong><br>
          CEDUC UCN</p>
        </div>
        <div class="footer">
          <p>Este es un correo automático, por favor no responder directamente.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Genera el HTML para notificación FUAS (debe agendar cita)
 */
function generarHtmlNotificacionFUAS(nombreEstudiante) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .btn { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .btn:hover { background: #2563eb; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>GestorBecas CEDUC</h1>
          <p>Sistema de Gestión de Becas y Beneficios</p>
        </div>
        <div class="content">
          <h2>Hola ${nombreEstudiante},</h2>
          
          <p>Te informamos que has sido identificado/a como estudiante que <strong>debe completar su postulación al FUAS</strong> (Formulario Único de Acreditación Socioeconómica) para acceder a beneficios estudiantiles.</p>
          
          <div class="alert">
            <strong>⚠️ Importante:</strong> Para completar tu postulación, debes agendar una cita con la Encargada de Asuntos Estudiantiles.
          </div>
          
          <p>Ingresa a la plataforma con tus credenciales institucionales:</p>
          
          <p style="text-align: center;">
            <a href="${URL_PLATAFORMA}" class="btn">Acceder a GestorBecas</a>
          </p>
          
          <p><strong>Pasos a seguir:</strong></p>
          <ol>
            <li>Ingresa con tu RUT (sin dígito verificador) y contraseña</li>
            <li>Haz clic en "Agendar Cita"</li>
            <li>Selecciona una fecha y hora disponible</li>
            <li>Asiste a tu cita con los documentos requeridos</li>
          </ol>
          
          <p>Si tienes dudas, comunícate con la oficina de Asuntos Estudiantiles.</p>
          
          <p>Saludos cordiales,<br>
          <strong>Equipo de Asuntos Estudiantiles</strong><br>
          CEDUC UCN</p>
        </div>
        <div class="footer">
          <p>Este es un correo automático, por favor no responder directamente.</p>
          <p>© ${new Date().getFullYear()} CEDUC UCN - Todos los derechos reservados</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Genera el HTML para recordatorio FUAS (no ha postulado)
 */
function generarHtmlRecordatorioFUAS(nombreEstudiante) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b, #ef4444); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .btn { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
        .btn:hover { background: #d97706; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        .urgent { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Recordatorio FUAS</h1>
          <p>No hemos detectado tu postulación</p>
        </div>
        <div class="content">
          <h2>Hola ${nombreEstudiante},</h2>
          
          <div class="urgent">
            <strong>🚨 Importante:</strong> Según nuestros registros, aún <strong>NO has postulado al FUAS</strong> (Formulario Único de Acreditación Socioeconómica).
          </div>
          
          <p>El FUAS es <strong>obligatorio</strong> para acceder a beneficios estudiantiles como:</p>
          <ul>
            <li>Gratuidad</li>
            <li>Becas de Arancel</li>
            <li>Crédito con Aval del Estado (CAE)</li>
            <li>Becas de Mantención</li>
          </ul>
          
          <div class="alert">
            <strong>📅 Fecha límite:</strong> No dejes pasar el plazo. Postula lo antes posible para no perder tus beneficios.
          </div>
          
          <p style="text-align: center;">
            <a href="https://fuas.cl" class="btn">Postular al FUAS Ahora →</a>
          </p>
          
          <p><strong>¿Necesitas ayuda?</strong> Agenda una cita con la Encargada de Asuntos Estudiantiles a través de nuestra plataforma:</p>
          
          <p style="text-align: center;">
            <a href="${URL_PLATAFORMA}" style="color: #3b82f6;">Acceder a GestorBecas</a>
          </p>
          
          <p>Saludos cordiales,<br>
          <strong>Equipo de Asuntos Estudiantiles</strong><br>
          CEDUC UCN</p>
        </div>
        <div class="footer">
          <p>Este es un correo automático, por favor no responder directamente.</p>
          <p>© ${new Date().getFullYear()} CEDUC UCN - Todos los derechos reservados</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ============================================
// FUNCIONES DE ENVÍO
// ============================================

/**
 * Envía un correo usando Elastic Email
 * @param {string} destinatario - Email del destinatario
 * @param {string} asunto - Asunto del correo
 * @param {string} htmlContent - Contenido HTML del correo
 * @returns {Promise<{exito: boolean, mensaje: string, transactionId?: string}>}
 */
async function enviarCorreo(destinatario, asunto, htmlContent) {
  console.log(`📧 Enviando correo a: ${destinatario}`);

  if (!API_KEY) {
    console.error('❌ ELASTIC_EMAIL_API_KEY no configurada');
    return { exito: false, mensaje: 'API Key no configurada' };
  }

  try {
    const params = new URLSearchParams();
    params.append('apikey', API_KEY);
    params.append('from', EMAIL_REMITENTE);
    params.append('fromName', NOMBRE_REMITENTE);
    params.append('to', destinatario);
    params.append('subject', asunto);
    params.append('bodyHtml', htmlContent);
    params.append('isTransactional', 'true');

    const response = await fetch('https://api.elasticemail.com/v2/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Correo enviado a ${destinatario}:`, data.data?.transactionid);
      return {
        exito: true,
        mensaje: 'Correo enviado exitosamente',
        transactionId: data.data?.transactionid
      };
    } else {
      console.error(`❌ Error API:`, data.error);
      return { exito: false, mensaje: data.error || 'Error desconocido' };
    }
  } catch (error) {
    console.error('❌ Error enviando correo:', error);
    return { exito: false, mensaje: error.message || 'Error de conexión' };
  }
}

/**
 * Envía correo de cancelación de cita
 */
async function sendCancellationEmail(destinatario, nombreEstudiante, fechaCita, motivo = '') {
  return enviarCorreo(
    destinatario,
    'Actualización de tu cita - CEDUC',
    generarHtmlCancelacion(nombreEstudiante, fechaCita, motivo)
  );
}

/**
 * Envía notificación FUAS a un estudiante (debe agendar cita)
 */
async function enviarNotificacionFUAS(estudiante) {
  const { correo, nombre } = estudiante;
  if (!correo) {
    return { exito: false, mensaje: 'Estudiante sin correo' };
  }
  return enviarCorreo(
    correo,
    'CEDUC - Agenda tu cita para postulación FUAS',
    generarHtmlNotificacionFUAS(nombre || 'Estudiante')
  );
}

/**
 * Envía recordatorio FUAS a un estudiante (no ha postulado)
 */
async function enviarRecordatorioFUAS(estudiante) {
  const { correo, nombre } = estudiante;
  if (!correo) {
    return { exito: false, mensaje: 'Estudiante sin correo' };
  }
  return enviarCorreo(
    correo,
    '⚠️ CEDUC - Recuerda postular al FUAS',
    generarHtmlRecordatorioFUAS(nombre || 'Estudiante')
  );
}

/**
 * Envía notificaciones masivas FUAS
 * @param {Array<{rut: string, nombre: string, correo: string}>} estudiantes
 * @returns {Promise<{exitosos: number, fallidos: number, resultados: Array}>}
 */
async function enviarNotificacionesMasivas(estudiantes) {
  console.log(`📬 Iniciando envío masivo a ${estudiantes.length} estudiantes...`);

  const resultados = [];
  let exitosos = 0;
  let fallidos = 0;

  for (const estudiante of estudiantes) {
    if (!estudiante.correo) {
      resultados.push({ rut: estudiante.rut, exito: false, mensaje: 'Sin correo' });
      fallidos++;
      continue;
    }

    const resultado = await enviarNotificacionFUAS(estudiante);
    resultados.push({ rut: estudiante.rut, ...resultado });

    if (resultado.exito) {
      exitosos++;
    } else {
      fallidos++;
    }

    // Pausa para rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`📊 Envío completado: ${exitosos} exitosos, ${fallidos} fallidos`);
  return { exitosos, fallidos, resultados };
}

/**
 * Envía recordatorios masivos FUAS
 * @param {Array<{rut: string, nombre: string, correo: string}>} estudiantes
 * @returns {Promise<{exitosos: number, fallidos: number, resultados: Array}>}
 */
async function enviarRecordatoriosMasivosFUAS(estudiantes) {
  console.log(`📬 Iniciando envío de recordatorios a ${estudiantes.length} estudiantes...`);

  const resultados = [];
  let exitosos = 0;
  let fallidos = 0;

  for (const estudiante of estudiantes) {
    if (!estudiante.correo) {
      resultados.push({ rut: estudiante.rut, exito: false, mensaje: 'Sin correo' });
      fallidos++;
      continue;
    }

    const resultado = await enviarRecordatorioFUAS(estudiante);
    resultados.push({ rut: estudiante.rut, ...resultado });

    if (resultado.exito) {
      exitosos++;
    } else {
      fallidos++;
    }

    // Pausa para rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`📊 Recordatorios completados: ${exitosos} exitosos, ${fallidos} fallidos`);
  return { exitosos, fallidos, resultados };
}

// ============================================
// SOLICITUD DE REUNIÓN
// ============================================

/**
 * Genera HTML para solicitud de reunión
 */
function generarHtmlSolicitudReunion(datos) {
  const { nombreEstudiante, nombreAsistente, sedeAsistente, motivo, mensaje } = datos;

  const motivosTexto = {
    'documentacion_fuas': 'Revisión de documentación FUAS',
    'actualizacion_antecedentes': 'Actualización de antecedentes socioeconómicos',
    'seguimiento_academico': 'Seguimiento de situación académica',
    'consulta_beneficios': 'Consulta sobre beneficios estudiantiles',
    'otro': 'Asunto general'
  };

  const motivoTexto = motivosTexto[motivo] || motivo;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0 0 5px 0; font-size: 24px; }
        .header p { margin: 0; opacity: 0.9; font-size: 14px; }
        .content { background: #ffffff; padding: 30px; }
        .greeting { font-size: 18px; color: #1f2937; margin-bottom: 20px; }
        .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .info-row { display: flex; margin-bottom: 12px; }
        .info-row:last-child { margin-bottom: 0; }
        .info-label { color: #059669; font-weight: bold; min-width: 120px; }
        .info-value { color: #1f2937; }
        .message-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 20px 0; }
        .message-box p { margin: 0; }
        .message-label { font-weight: bold; color: #92400e; margin-bottom: 8px; }
        .cta { text-align: center; margin: 30px 0; }
        .btn { display: inline-block; background: #059669; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
        .urgent { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center; }
        .urgent p { color: #991b1b; margin: 0; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 Solicitud de Reunión</h1>
          <p>Asuntos Estudiantiles CEDUC</p>
        </div>
        <div class="content">
          <p class="greeting">Hola <strong>${nombreEstudiante}</strong>,</p>
          
          <p>La Asistente Social de tu sede necesita reunirse contigo. Por favor, agenda una cita lo antes posible.</p>
          
          <div class="info-box">
            <div class="info-row">
              <span class="info-label">👤 Asistente:</span>
              <span class="info-value">${nombreAsistente}</span>
            </div>
            <div class="info-row">
              <span class="info-label">📍 Sede:</span>
              <span class="info-value">${sedeAsistente || 'CEDUC'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">📋 Motivo:</span>
              <span class="info-value">${motivoTexto}</span>
            </div>
          </div>
          
          ${mensaje ? `
          <div class="message-box">
            <p class="message-label">💬 Mensaje de la asistente:</p>
            <p>"${mensaje}"</p>
          </div>
          ` : ''}
          
          <div class="urgent">
            <p>⏰ Te recomendamos agendar tu cita dentro de los próximos <strong>5 días hábiles</strong>.</p>
          </div>
          
          <div class="cta">
            <a href="${URL_PLATAFORMA}" class="btn">📅 Agendar Cita Ahora</a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Si tienes alguna duda, puedes responder a este correo o comunicarte directamente con la oficina de Asuntos Estudiantiles de tu sede.
          </p>
        </div>
        <div class="footer">
          <p>Este correo fue enviado por el Sistema de Gestión de Becas CEDUC.</p>
          <p>© ${new Date().getFullYear()} CEDUC UCN - Todos los derechos reservados</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Envía solicitud de reunión a un estudiante
 */
async function enviarSolicitudReunion(datos) {
  const { estudiante, asistente, motivo, mensaje } = datos;

  if (!estudiante.correo) {
    return { exito: false, mensaje: 'Estudiante sin correo electrónico' };
  }

  try {
    const html = generarHtmlSolicitudReunion({
      nombreEstudiante: estudiante.nombre || 'Estudiante',
      nombreAsistente: asistente.nombre || 'Asistente Social',
      sedeAsistente: asistente.sede,
      motivo,
      mensaje
    });

    const formData = new URLSearchParams();
    formData.append('apikey', API_KEY);
    formData.append('from', EMAIL_REMITENTE);
    formData.append('fromName', NOMBRE_REMITENTE);
    formData.append('to', estudiante.correo);
    formData.append('subject', `📋 Solicitud de Reunión - ${asistente.nombre || 'Asuntos Estudiantiles'}`);
    formData.append('bodyHtml', html);
    formData.append('isTransactional', 'true');

    const response = await fetch('https://api.elasticemail.com/v2/email/send', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✅ Solicitud de reunión enviada a ${estudiante.correo}`);
      return { exito: true, mensaje: 'Correo enviado', transactionId: result.data?.transactionid };
    } else {
      console.error(`❌ Error enviando a ${estudiante.correo}:`, result.error);
      return { exito: false, mensaje: result.error || 'Error desconocido' };
    }
  } catch (error) {
    console.error('Error en enviarSolicitudReunion:', error);
    return { exito: false, mensaje: error.message };
  }
}

/**
 * Verifica conexión con Elastic Email
 */
async function verificarConexion() {
  try {
    const response = await fetch(`https://api.elasticemail.com/v2/account/load?apikey=${API_KEY}`);
    const data = await response.json();
    return data.success === true;
  } catch {
    return false;
  }
}

/**
 * Genera el HTML para notificación de beneficios obtenidos
 */
function generarHtmlNotificacionBeneficios({ nombreEstudiante, beneficios, anoProceso }) {
  // Mapeo de códigos a nombres legibles
  const nombresBeneficios = {
    gratuidad: { nombre: 'Gratuidad', emoji: '🎓', color: '#059669' },
    bvp: { nombre: 'Beca Vocación de Profesor', emoji: '👨‍🏫', color: '#7c3aed' },
    bb: { nombre: 'Beca Bicentenario', emoji: '🇨🇱', color: '#2563eb' },
    bea: { nombre: 'Beca de Excelencia Académica', emoji: '⭐', color: '#d97706' },
    bdte: { nombre: 'Beca Discapacidad Técnica', emoji: '♿', color: '#0d9488' },
    bjgm: { nombre: 'Beca Juan Gómez Millas', emoji: '📚', color: '#4f46e5' },
    bnm: { nombre: 'Beca Nuevo Milenio', emoji: '🌟', color: '#0891b2' },
    bhpe: { nombre: 'Beca Hijos Prof. de la Educación', emoji: '👨‍👩‍👧', color: '#db2777' },
    fscu: { nombre: 'Fondo Solidario de Crédito Universitario', emoji: '💰', color: '#ea580c' }
  };

  // Generar lista de beneficios
  const listaBeneficios = beneficios.map(b => {
    const info = nombresBeneficios[b.tipo] || { nombre: b.tipo, emoji: '✅', color: '#6b7280' };
    return `
      <div style="background: ${info.color}15; border-left: 4px solid ${info.color}; padding: 12px 15px; margin: 8px 0; border-radius: 0 8px 8px 0;">
        <span style="font-size: 18px;">${info.emoji}</span>
        <strong style="color: ${info.color}; margin-left: 8px;">${info.nombre}</strong>
        ${b.detalle ? `<p style="margin: 5px 0 0 30px; color: #4b5563; font-size: 13px;">${b.detalle}</p>` : ''}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 35px 30px; text-align: center; }
        .header h1 { margin: 0 0 10px 0; font-size: 28px; }
        .header p { margin: 0; opacity: 0.9; }
        .content { background: #ffffff; padding: 30px; }
        .success-box { background: #ecfdf5; border: 2px solid #059669; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 25px; }
        .success-box h2 { color: #059669; margin: 0 0 10px 0; font-size: 22px; }
        .beneficios-title { font-size: 16px; font-weight: bold; color: #374151; margin: 20px 0 15px 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
        .info-box { background: #f3f4f6; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .btn { display: inline-block; background: #059669; color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 15px 0; }
        .btn:hover { background: #047857; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
        .steps { background: #fffbeb; border-radius: 8px; padding: 15px 20px; margin: 20px 0; }
        .steps ol { margin: 10px 0; padding-left: 20px; }
        .steps li { margin: 8px 0; color: #92400e; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 ¡Felicitaciones!</h1>
          <p>Resultados de Preselección ${anoProceso || new Date().getFullYear()}</p>
        </div>
        <div class="content">
          <div class="success-box">
            <h2>¡Has obtenido beneficios estudiantiles!</h2>
            <p style="color: #065f46; margin: 0;">Estimado/a ${nombreEstudiante}</p>
          </div>
          
          <p>Nos complace informarte que según los resultados de la preselección del Ministerio de Educación, has sido beneficiado/a con los siguientes apoyos económicos:</p>
          
          <div class="beneficios-title">📋 Tus Beneficios Asignados:</div>
          ${listaBeneficios}
          
          <div class="steps">
            <strong>📌 Próximos pasos importantes:</strong>
            <ol>
              <li>Mantén tu matrícula vigente para no perder estos beneficios</li>
              <li>Revisa que tus datos estén actualizados en el sistema</li>
              <li>Si tienes dudas, agenda una cita con nuestra oficina</li>
            </ol>
          </div>
          
          <div class="info-box">
            <p style="margin: 0;"><strong>ℹ️ Importante:</strong> Estos beneficios están sujetos a la confirmación final del Ministerio de Educación y al cumplimiento de los requisitos de cada programa.</p>
          </div>
          
          <p style="text-align: center;">
            <a href="${URL_PLATAFORMA}" class="btn">Acceder a GestorBecas</a>
          </p>
          
          <p>Ante cualquier consulta, no dudes en contactarnos.</p>
          
          <p>Saludos cordiales,<br>
          <strong>Equipo de Asuntos Estudiantiles</strong><br>
          CEDUC UCN</p>
        </div>
        <div class="footer">
          <p>Este es un correo automático, por favor no responder directamente.</p>
          <p>© ${new Date().getFullYear()} CEDUC UCN - Todos los derechos reservados</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Envía notificación de beneficios a un estudiante
 */
async function enviarNotificacionBeneficios(datos) {
  const { estudiante, beneficios, anoProceso } = datos;

  if (!estudiante.correo) {
    return { exito: false, mensaje: 'Estudiante sin correo electrónico' };
  }

  try {
    const html = generarHtmlNotificacionBeneficios({
      nombreEstudiante: estudiante.nombre || 'Estudiante',
      beneficios,
      anoProceso
    });

    const formData = new URLSearchParams();
    formData.append('apikey', API_KEY);
    formData.append('from', EMAIL_REMITENTE);
    formData.append('fromName', NOMBRE_REMITENTE);
    formData.append('to', estudiante.correo);
    formData.append('subject', `🎓 ¡Felicitaciones! Has obtenido beneficios estudiantiles - CEDUC`);
    formData.append('bodyHtml', html);
    formData.append('isTransactional', 'true');

    const response = await fetch('https://api.elasticemail.com/v2/email/send', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✅ Notificación de beneficios enviada a ${estudiante.correo}`);
      return { exito: true, mensaje: 'Correo enviado', transactionId: result.data?.transactionid };
    } else {
      console.error(`❌ Error enviando a ${estudiante.correo}:`, result.error);
      return { exito: false, mensaje: result.error || 'Error desconocido' };
    }
  } catch (error) {
    console.error('Error en enviarNotificacionBeneficios:', error);
    return { exito: false, mensaje: error.message };
  }
}

/**
 * Envía notificaciones masivas de beneficios
 */
async function enviarNotificacionesBeneficiosMasivas(listaEstudiantes, anoProceso) {
  const resultados = {
    exitosos: 0,
    fallidos: 0,
    errores: []
  };

  for (const est of listaEstudiantes) {
    try {
      const resultado = await enviarNotificacionBeneficios({
        estudiante: {
          rut: est.rut,
          nombre: est.nombre,
          correo: est.correo
        },
        beneficios: est.beneficios,
        anoProceso
      });

      if (resultado.exito) {
        resultados.exitosos++;
      } else {
        resultados.fallidos++;
        resultados.errores.push({ rut: est.rut, error: resultado.mensaje });
      }

      // Delay para no saturar el servicio
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      resultados.fallidos++;
      resultados.errores.push({ rut: est.rut, error: error.message });
    }
  }

  console.log(`📧 Notificaciones de beneficios: ${resultados.exitosos} enviados, ${resultados.fallidos} fallidos`);
  return resultados;
}

module.exports = {
  sendCancellationEmail,
  enviarNotificacionFUAS,
  enviarRecordatorioFUAS,
  enviarNotificacionesMasivas,
  enviarRecordatoriosMasivosFUAS,
  enviarSolicitudReunion,
  enviarNotificacionBeneficios,
  enviarNotificacionesBeneficiosMasivas,
  verificarConexion
};
