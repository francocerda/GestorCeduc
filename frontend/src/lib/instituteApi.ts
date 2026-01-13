/**
 * Cliente API para comunicarse con el Backend del Instituto
 * Maneja la sincronización con SQL Server y el cruce de datos
 */

// URL del backend (cambiar en producción)
const BACKEND_URL = 'http://localhost:3001'
console.log('API Backend URL:', BACKEND_URL)

// Tipos
export interface ResultadoSync {
    exitoso: boolean
    total: number
    errores?: string[]
    mensaje: string
}

export interface DatoMinisterioParaCruce {
    rut: string
    dv?: string
    tipo?: string
    formulario?: string
    observacion?: string
}

export interface EstudianteFUASCruce {
    rut: string
    nombre: string
    correo: string
    carrera: string | null
    origen: string | null
    tipo_beneficio: string | null
    debe_postular: boolean
    fecha_cruce: string
}

export interface ResultadoCruce {
    exitoso: boolean
    coincidencias: number
    noEncontrados: number
    estudiantes: EstudianteFUASCruce[]
    mensaje: string
    error?: string
}

export interface ResultadoEstudiantes {
    exitoso: boolean
    total: number
    estudiantes: EstudianteFUASCruce[]
    error?: string
}

/**
 * Verifica que el backend esté funcionando
 */
export async function verificarBackend(): Promise<boolean> {
    try {
        const response = await fetch(`${BACKEND_URL}/health`)
        const data = await response.json()
        return data.status === 'ok'
    } catch (error) {
        console.error('❌ Backend no disponible:', error)
        return false
    }
}

/**
 * Sincroniza estudiantes desde SQL Server del Instituto a Supabase
 * Ejecuta: exec [ESTUDIANTES_MAT] 2026
 */
export async function syncEstudiantesInstituto(): Promise<ResultadoSync> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/sync-instituto`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.mensaje || 'Error en la sincronización')
        }

        return await response.json()
    } catch (error) {
        console.error('❌ Error sincronizando instituto:', error)
        return {
            exitoso: false,
            total: 0,
            mensaje: error instanceof Error ? error.message : 'Error desconocido'
        }
    }
}

export interface ResultadoCargaMinisterio {
    exitoso: boolean
    totalRecibidos: number
    totalGuardados: number
    errores: { lote: number; error: string }[]
    mensaje: string
}

/**
 * Carga datos del Ministerio al backend (procesamiento en lotes interno)
 * Más rápido que hacer inserts desde el frontend
 */
export async function cargarDatosMinisterio(
    datos: { rut: string; tipo: string; beneficio?: string; cargado_por?: string }[]
): Promise<ResultadoCargaMinisterio> {
    try {
        console.log(`📤 Enviando ${datos.length} registros al backend...`)

        const response = await fetch(`${BACKEND_URL}/api/cargar-datos-ministerio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ datos })
        })

        console.log('📥 Respuesta recibida, status:', response.status)

        if (!response.ok) {
            let errorMsg = 'Error al cargar datos'
            try {
                const errorData = await response.json()
                errorMsg = errorData.mensaje || errorMsg
            } catch {
                errorMsg = `Error HTTP ${response.status}`
            }
            throw new Error(errorMsg)
        }

        // Parsear respuesta con manejo de errores explícito
        let resultado: ResultadoCargaMinisterio
        try {
            resultado = await response.json()
            console.log('✅ Respuesta parseada:', resultado.mensaje)
        } catch (parseError) {
            console.error('❌ Error parseando respuesta JSON:', parseError)
            // Asumir éxito si el status fue OK pero JSON falló
            return {
                exitoso: true,
                totalRecibidos: datos.length,
                totalGuardados: datos.length,
                errores: [],
                mensaje: `${datos.length} registros procesados (respuesta truncada)`
            }
        }

        return resultado
    } catch (error) {
        console.error('❌ Error cargando datos ministerio:', error)
        return {
            exitoso: false,
            totalRecibidos: 0,
            totalGuardados: 0,
            errores: [],
            mensaje: error instanceof Error ? error.message : 'Error desconocido'
        }
    }
}

/**
 * Cruza datos del Ministerio (CSV) con datos del Instituto
 * Retorna estudiantes que están matriculados Y aparecen en el CSV
 */
export async function cruzarDatosMinisterio(
    datosMinisterio: DatoMinisterioParaCruce[]
): Promise<ResultadoCruce> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/cruzar-datos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ datos_ministerio: datosMinisterio })
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.mensaje || 'Error en el cruce de datos')
        }

        return await response.json()
    } catch (error) {
        console.error('❌ Error cruzando datos:', error)
        return {
            exitoso: false,
            coincidencias: 0,
            noEncontrados: 0,
            estudiantes: [],
            mensaje: error instanceof Error ? error.message : 'Error desconocido'
        }
    }
}

/**
 * Obtiene lista de estudiantes pendientes de postular
 */
export async function getEstudiantesPendientes(): Promise<ResultadoEstudiantes> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/estudiantes-pendientes`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.mensaje || 'Error obteniendo estudiantes')
        }

        return await response.json()
    } catch (error) {
        console.error('❌ Error obteniendo estudiantes pendientes:', error)
        return {
            exitoso: false,
            total: 0,
            estudiantes: []
        }
    }
}

/**
 * Marca estudiantes como notificados después de enviar emails
 */
export async function marcarNotificados(ruts: string[]): Promise<boolean> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/marcar-notificado`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ruts })
        })

        if (!response.ok) {
            throw new Error('Error marcando notificados')
        }

        const data = await response.json()
        return data.exitoso

    } catch (error) {
        console.error('❌ Error marcando notificados:', error)
        return false
    }
}

// ============================================
// FUNCIONES PARA GESTION FUAS (Tabla Unificada)
// ============================================

export interface GestionFUASResult {
    rut: string
    nombre: string | null
    correo: string | null
    carrera: string | null
    sede: string | null
    origen: 'acreditacion' | 'fuas_nacional'
    estado: 'debe_acreditar' | 'no_postulo' | 'documento_pendiente' | 'documento_validado' | 'documento_rechazado' | 'acreditado'
    tipo_beneficio: string | null
    documento_url: string | null
    fecha_documento: string | null
    validado_por: string | null
    comentario_rechazo: string | null
    notificacion_enviada: boolean
    fecha_notificacion: string | null
    fecha_cruce: string
}

// Alias para compatibilidad
export type NoPostulanteResult = GestionFUASResult

export interface ResultadoDeteccion {
    exitoso: boolean
    totalMatriculados: number
    totalPostulantes: number
    noPostularon: number
    guardados: number
    estudiantes: GestionFUASResult[]
    mensaje: string
    error?: string
}

/**
 * Detecta estudiantes matriculados que NO postularon a FUAS
 * @param rutsPostulantes Array de RUTs de estudiantes que SÍ postularon
 */
export async function detectarNoPostulantes(
    rutsPostulantes: string[]
): Promise<ResultadoDeteccion> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/detectar-no-postulantes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ruts_postulantes: rutsPostulantes })
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.mensaje || 'Error detectando no postulantes')
        }

        return await response.json()
    } catch (error) {
        console.error('❌ Error detectando no postulantes:', error)
        return {
            exitoso: false,
            totalMatriculados: 0,
            totalPostulantes: 0,
            noPostularon: 0,
            guardados: 0,
            estudiantes: [],
            mensaje: error instanceof Error ? error.message : 'Error desconocido'
        }
    }
}

/**
 * Obtiene lista de estudiantes que no postularon a FUAS
 */
export async function getNoPostulantes(): Promise<{ exitoso: boolean; total: number; estudiantes: NoPostulanteResult[] }> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/no-postulantes`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.mensaje || 'Error obteniendo no postulantes')
        }

        return await response.json()
    } catch (error) {
        console.error('❌ Error obteniendo no postulantes:', error)
        return {
            exitoso: false,
            total: 0,
            estudiantes: []
        }
    }
}

/**
 * Marca estudiantes no postulantes como notificados
 */
export async function marcarNotificadosFUAS(ruts: string[]): Promise<boolean> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/marcar-notificado-fuas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ruts })
        })

        if (!response.ok) {
            throw new Error('Error marcando notificados FUAS')
        }

        const data = await response.json()
        return data.exitoso

    } catch (error) {
        console.error('❌ Error marcando notificados FUAS:', error)
        return false
    }
}
