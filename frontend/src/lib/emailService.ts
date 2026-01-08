/**
 * Servicio para enviar correos usando Elastic Email API
 * Documentación: https://elasticemail.com/developers/api-documentation/rest-api
 */

// Configuración de Elastic Email
const API_KEY = import.meta.env.VITE_ELASTIC_EMAIL_API_KEY || '1A14C002E870A27A6E5D074E54DAC7CDF688EB6D3EE7B2EA301E7BD0B9413623255ED1B6281C3B831134657F2E62F8E4'
const URL_PLATAFORMA = import.meta.env.VITE_PLATFORM_URL || 'https://www.ceduc.cl/'
const EMAIL_REMITENTE = import.meta.env.VITE_SENDER_EMAIL || 'notificaciones@ceduc.cl'
const NOMBRE_REMITENTE = 'CEDUC - Asuntos Estudiantiles'

interface ResultadoEnvio {
    exito: boolean
    mensaje: string
    transactionId?: string
}

interface DatosEstudiante {
    rut: string
    nombre: string
    correo: string
}

/**
 * Genera el contenido HTML del email de notificación FUAS
 */
function generarContenidoEmail(nombreEstudiante: string): string {
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
  `
}

/**
 * Envía un correo de notificación FUAS a un estudiante
 */
export async function enviarNotificacionFUAS(estudiante: DatosEstudiante): Promise<ResultadoEnvio> {
    try {
        console.log(`📧 Enviando notificación a ${estudiante.correo}...`)

        const parametros = new URLSearchParams({
            apikey: API_KEY,
            from: EMAIL_REMITENTE,
            fromName: NOMBRE_REMITENTE,
            to: estudiante.correo,
            subject: 'CEDUC - Agenda tu cita para postulación FUAS',
            bodyHtml: generarContenidoEmail(estudiante.nombre),
            isTransactional: 'true'
        })

        const respuesta = await fetch('https://api.elasticemail.com/v2/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: parametros.toString()
        })

        const datos = await respuesta.json()

        if (datos.success) {
            console.log(`✅ Email enviado a ${estudiante.correo}:`, datos.data?.transactionid)
            return {
                exito: true,
                mensaje: 'Correo enviado exitosamente',
                transactionId: datos.data?.transactionid
            }
        } else {
            console.error(`❌ Error al enviar email:`, datos.error)
            return {
                exito: false,
                mensaje: datos.error || 'Error desconocido al enviar correo'
            }
        }
    } catch (error) {
        console.error('❌ Error en enviarNotificacionFUAS:', error)
        return {
            exito: false,
            mensaje: error instanceof Error ? error.message : 'Error de conexión'
        }
    }
}

/**
 * Envía notificaciones masivas a múltiples estudiantes
 * Retorna un resumen de los envíos
 */
export async function enviarNotificacionesMasivas(
    estudiantes: DatosEstudiante[]
): Promise<{ exitosos: number; fallidos: number; resultados: ResultadoEnvio[] }> {
    console.log(`📬 Iniciando envío masivo a ${estudiantes.length} estudiantes...`)

    const resultados: ResultadoEnvio[] = []
    let exitosos = 0
    let fallidos = 0

    // Enviar secuencialmente para evitar límites de rate
    for (const estudiante of estudiantes) {
        const resultado = await enviarNotificacionFUAS(estudiante)
        resultados.push(resultado)

        if (resultado.exito) {
            exitosos++
        } else {
            fallidos++
        }

        // Pequeña pausa entre envíos para respetar rate limits
        await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log(`📊 Envío masivo completado: ${exitosos} exitosos, ${fallidos} fallidos`)

    return { exitosos, fallidos, resultados }
}

/**
 * Verifica si la API de Elastic Email está funcionando
 */
export async function verificarConexionEmail(): Promise<boolean> {
    try {
        const respuesta = await fetch(`https://api.elasticemail.com/v2/account/load?apikey=${API_KEY}`)
        const datos = await respuesta.json()
        return datos.success === true
    } catch {
        return false
    }
}
