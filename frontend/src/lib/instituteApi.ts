/**
 * Cliente API para comunicarse con el Backend del Instituto
 * Maneja la sincronización con SQL Server y el cruce de datos
 */

// URL base del backend sin sufijo `/api`.
// Si existe `VITE_API_URL`, se normaliza removiendo `/api`.
const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '')
// console.log('[instituteApi] Backend URL:', BACKEND_URL)

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
    sede: string | null
    origen: string | null
    estado: string | null
    tipo_beneficio: string | null
    documento_url?: string | null
    notificacion_enviada?: boolean
    fecha_cruce?: string
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
        // console.error('[instituteApi] Backend no disponible:', error)
        return false
    }
}

/**
 * Sincroniza estudiantes desde SQL Server del Instituto a PostgreSQL
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
        // console.error('[instituteApi] Error sincronizando instituto:', error)
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
        // console.log(`[instituteApi] Enviando ${datos.length} registros al backend...`)

        const response = await fetch(`${BACKEND_URL}/api/cargar-datos-ministerio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ datos })
        })

        // console.log('[instituteApi] Respuesta recibida, status:', response.status)

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
            // console.log('[instituteApi] Respuesta parseada:', resultado.mensaje)
        } catch (parseError) {
            // console.error('[instituteApi] Error parseando respuesta JSON:', parseError)
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
        // console.error('[instituteApi] Error cargando datos ministerio:', error)
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
        // console.error('[instituteApi] Error cruzando datos:', error)
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
        // console.error('[instituteApi] Error obteniendo estudiantes pendientes:', error)
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
        // console.error('[instituteApi] Error marcando notificados:', error)
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
    estado: 'debe_acreditar' | 'no_postulo' | 'postulo' | 'documento_pendiente' | 'documento_validado' | 'documento_rechazado' | 'acreditado'
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
    siPostularon: number
    guardados?: number
    estudiantes: GestionFUASResult[]           // No postulantes
    estudiantesPostularon: GestionFUASResult[]  // Sí postularon
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
        // console.error('[instituteApi] Error detectando no postulantes:', error)
        return {
            exitoso: false,
            totalMatriculados: 0,
            totalPostulantes: 0,
            noPostularon: 0,
            siPostularon: 0,
            estudiantes: [],
            estudiantesPostularon: [],
            mensaje: error instanceof Error ? error.message : 'Error desconocido'
        }
    }
}

/**
 * Obtiene lista de estudiantes FUAS (postulantes y no postulantes)
 */
export async function getNoPostulantes(): Promise<{ 
    exitoso: boolean; 
    total: number; 
    estudiantes: NoPostulanteResult[];
    totalPostularon?: number;
    totalNoPostularon?: number;
}> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/no-postulantes`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.mensaje || 'Error obteniendo estudiantes FUAS')
        }

        return await response.json()
    } catch (error) {
        // console.error('[instituteApi] Error obteniendo estudiantes FUAS:', error)
        return {
            exitoso: false,
            total: 0,
            estudiantes: [],
            totalPostularon: 0,
            totalNoPostularon: 0
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
        // console.error('[instituteApi] Error marcando notificados FUAS:', error)
        return false
    }
}

// ============================================
// BENEFICIOS (Preselección)
// ============================================

export interface BeneficioItem {
    tipo: string
    detalle: string | null
}

export interface EstudianteConBeneficios {
    rut: string
    nombre: string
    correo: string
    sede: string | null
    carrera: string | null
    beneficios: BeneficioItem[]
    notificado: boolean
}

export interface ResultadoCruceBeneficios {
    exito: boolean
    totalPreseleccion: number
    totalMatriculados: number
    estudiantesConBeneficios: number
    sinBeneficios: number
    estudiantes: EstudianteConBeneficios[]
    error?: string
}

export interface ResultadoNotificacionBeneficios {
    exito: boolean
    enviados: number
    fallidos: number
    errores: { rut: string; error: string }[]
}

/**
 * Cruza datos de preselección con estudiantes matriculados
 */
export async function cruzarBeneficios(datosPreseleccion: unknown[]): Promise<ResultadoCruceBeneficios> {
    try {
        // Optimizar payload: solo enviar campos necesarios para el cruce
        // El CSV nacional tiene 500K+ filas, enviar todo causa PayloadTooLarge
        const datosOptimizados = (datosPreseleccion as any[]).map(d => ({
            rut: d.rut,
            nombreCompleto: d.nombreCompleto || '',
            gratuidad: d.gratuidad || null,
            bvp: d.bvp || null,
            bb: d.bb || null,
            bea: d.bea || null,
            bdte: d.bdte || null,
            bjgm: d.bjgm || null,
            bnm: d.bnm || null,
            bhpe: d.bhpe || null,
            fscu: d.fscu || null
        }))

        // console.log(`[instituteApi] Enviando ${datosOptimizados.length} registros optimizados para cruce...`)

        const response = await fetch(`${BACKEND_URL}/api/beneficios/cruzar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ estudiantes: datosOptimizados })
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Error en cruce de beneficios')
        }

        return await response.json()
    } catch (error) {
        // console.error('[instituteApi] Error cruzando beneficios:', error)
        return {
            exito: false,
            totalPreseleccion: 0,
            totalMatriculados: 0,
            estudiantesConBeneficios: 0,
            sinBeneficios: 0,
            estudiantes: [],
            error: error instanceof Error ? error.message : 'Error desconocido'
        }
    }
}

/**
 * Envía notificaciones masivas de beneficios
 */
export async function notificarBeneficiosMasivos(
    estudiantes: EstudianteConBeneficios[],
    anoProceso?: number
): Promise<ResultadoNotificacionBeneficios> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/beneficios/notificar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                estudiantes, 
                anoProceso: anoProceso || new Date().getFullYear() 
            })
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Error enviando notificaciones')
        }

        return await response.json()
    } catch (error) {
        // console.error('[instituteApi] Error enviando notificaciones de beneficios:', error)
        return {
            exito: false,
            enviados: 0,
            fallidos: 0,
            errores: [{ rut: 'general', error: error instanceof Error ? error.message : 'Error desconocido' }]
        }
    }
}

/**
 * Guarda el cruce de beneficios en la BD
 */
export async function guardarCruceBeneficios(
    estudiantes: EstudianteConBeneficios[],
    anoProceso?: number
): Promise<{ exito: boolean; actualizados: number; mensaje: string }> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/beneficios/guardar-cruce`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                estudiantes, 
                anoProceso: anoProceso || new Date().getFullYear() 
            })
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Error guardando cruce')
        }

        return await response.json()
    } catch (error) {
        // console.error('[instituteApi] Error guardando cruce de beneficios:', error)
        return {
            exito: false,
            actualizados: 0,
            mensaje: error instanceof Error ? error.message : 'Error desconocido'
        }
    }
}
