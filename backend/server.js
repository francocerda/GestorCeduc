/**
 * Backend GestorCeduc - Servidor Express
 * 
 * Endpoints:
 * - GET  /health                    → Health check
 * - GET  /api/sync-instituto        → Sincroniza estudiantes desde SQL Server a Supabase
 * - POST /api/cruzar-datos          → Cruza datos del Ministerio con datos del Instituto
 * - GET  /api/estudiantes-pendientes → Lista estudiantes que deben postular
 */

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const sql = require('mssql')
const { createClient } = require('@supabase/supabase-js')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Inicializar Supabase con Service Key 
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
)

// Configuración SQL Server
const sqlConfig = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE || 'master',
    options: {
        encrypt: false, // Deshabilitado para servidores SQL Server antiguos
        trustServerCertificate: true,
        enableArithAbort: true
    },
    connectionTimeout: 30000,
    requestTimeout: 60000
}

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    })
})

// ============================================
// SINCRONIZAR ESTUDIANTES DESDE SQL SERVER
// ============================================
app.get('/api/sync-instituto', async (req, res) => {
    let pool = null

    try {
        console.log('Conectando a SQL Server...')
        pool = await sql.connect(sqlConfig)

        console.log('Ejecutando consulta ESTUDIANTES_MAT 2026...')
        const result = await pool.request().query('exec [ESTUDIANTES_MAT] 2026')

        const estudiantes = result.recordset
        console.log(`${estudiantes.length} estudiantes encontrados en SQL Server`)

        // 🔍 DIAGNÓSTICO: Mostrar formato de RUT recibido de SQL Server
        console.log('=== MUESTRA DE RUTS DESDE SQL SERVER ===')
        estudiantes.slice(0, 5).forEach((est, i) => {
            console.log(`  [${i + 1}] RUT crudo: "${est.rut}" | Columnas disponibles: ${Object.keys(est).join(', ')}`)
        })
        console.log('=========================================')

        if (estudiantes.length === 0) {
            return res.json({
                exitoso: true,
                total: 0,
                mensaje: 'No se encontraron estudiantes matriculados para 2026'
            })
        }

        // Preparar datos para Supabase
        // Mapeo de columnas SQL Server → Supabase
        const datosParaSupabase = estudiantes.map(est => {
            // Construir nombre completo desde las partes
            const nombreCompleto = [
                est.nombres_socionegocio,
                est.apaterno_socionegocio,
                est.amaterno_socionegocio
            ].filter(Boolean).join(' ').trim()

            return {
                rut: limpiarRut(est.rut),
                nombre: nombreCompleto || null,
                correo: est.Correo || null,  // Nota: "Correo" con mayúscula
                carrera: est.nombre_carrera || null,
                sede: est.CODSEDE || null,
                anio_ingreso: est.anio_ingreso || 2026,
                fecha_carga: new Date().toISOString()
            }
        })

        console.log('Guardando en Supabase tabla datos_instituto...')

        // Upsert en lotes de 500
        const batchSize = 500
        let insertados = 0
        let erroresDb = []

        for (let i = 0; i < datosParaSupabase.length; i += batchSize) {
            const batch = datosParaSupabase.slice(i, i + batchSize)

            const { error } = await supabase
                .from('datos_instituto')
                .upsert(batch, { onConflict: 'rut' })

            if (error) {
                console.error(`Error en batch ${i / batchSize + 1}:`, error)
                erroresDb.push(error.message)
            } else {
                insertados += batch.length
            }
        }

        console.log(`Sincronización completada: ${insertados} registros`)

        res.json({
            exitoso: true,
            total: insertados,
            errores: erroresDb,
            mensaje: `${insertados} estudiantes sincronizados correctamente`
        })

    } catch (error) {
        console.error(' Error en sincronización:', error)
        res.status(500).json({
            exitoso: false,
            error: error.message,
            mensaje: 'Error al sincronizar con SQL Server'
        })
    } finally {
        if (pool) {
            await pool.close()
        }
    }
})

// ============================================
// CARGAR DATOS DEL MINISTERIO (BULK INSERT)
// ============================================
app.post('/api/cargar-datos-ministerio', async (req, res) => {
    try {
        const { datos } = req.body

        if (!datos || !Array.isArray(datos)) {
            return res.status(400).json({
                exitoso: false,
                error: 'Se requiere un array de datos'
            })
        }

        console.log(`📊 Cargando ${datos.length} registros del Ministerio...`)

        // Preparar datos para insertar
        const datosParaInsertar = datos.map(d => ({
            rut: limpiarRut(d.rut),
            nombre: d.nombre || null,
            tipo: d.tipo || null,
            beneficio: d.beneficio || d.observacion || null,
            fecha_carga: new Date().toISOString(),
            cargado_por: d.cargado_por || null
        }))

        // Insertar en lotes de 1000 (más eficiente que frontend)
        const BATCH_SIZE = 1000
        let totalGuardados = 0
        let erroresGuardado = []

        for (let i = 0; i < datosParaInsertar.length; i += BATCH_SIZE) {
            const lote = datosParaInsertar.slice(i, i + BATCH_SIZE)
            const loteNum = Math.floor(i / BATCH_SIZE) + 1

            const { data, error } = await supabase
                .from('datos_ministerio')
                .upsert(lote, { onConflict: 'rut' })
                .select()

            if (error) {
                console.error(`❌ Error lote ${loteNum}:`, error.message)
                erroresGuardado.push({
                    lote: loteNum,
                    error: error.message
                })
            } else {
                totalGuardados += data?.length || lote.length
            }
        }

        console.log(`✓ Guardados: ${totalGuardados}/${datosParaInsertar.length}`)

        res.json({
            exitoso: erroresGuardado.length === 0,
            totalRecibidos: datos.length,
            totalGuardados,
            errores: erroresGuardado,
            mensaje: erroresGuardado.length === 0
                ? `${totalGuardados} registros cargados exitosamente`
                : `${totalGuardados} guardados, ${erroresGuardado.length} lote(s) con error`
        })

    } catch (error) {
        console.error('❌ Error cargando datos ministerio:', error)
        res.status(500).json({
            exitoso: false,
            error: error.message,
            mensaje: 'Error al cargar datos del ministerio'
        })
    }
})

// ============================================
// CRUZAR DATOS DEL MINISTERIO CON INSTITUTO
// ============================================
app.post('/api/cruzar-datos', async (req, res) => {
    try {
        const { datos_ministerio } = req.body

        if (!datos_ministerio || !Array.isArray(datos_ministerio)) {
            return res.status(400).json({
                exitoso: false,
                error: 'Se requiere un array de datos_ministerio'
            })
        }

        console.log(`Procesando ${datos_ministerio.length} registros del Ministerio...`)

        // ESTRATEGIA OPTIMIZADA:
        // En lugar de enviar 144k RUTs en un "IN (...) " que rompe la base de datos,
        // traemos todos los estudiantes del instituto a memoria y cruzamos aquí.

        console.log('Obteniendo datos del instituto para cruce en memoria...')

        // Obtener TODOS los estudiantes del instituto
        // Nota: Supabase devuelve max 1000 por defecto. Usamos limit alto o paginación si crece mucho.
        let todosEstudiantesInstituto = []
        let page = 0
        const pageSize = 1000
        let more = true

        while (more) {
            const { data, error } = await supabase
                .from('datos_instituto')
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1)

            if (error) throw new Error(`Error leyendo instituto: ${error.message}`)

            if (data.length > 0) {
                todosEstudiantesInstituto = todosEstudiantesInstituto.concat(data)
                page++
                // Si trajimos menos que el tamaño de página, se acabaron
                if (data.length < pageSize) more = false
            } else {
                more = false
            }
        }

        console.log(`Instituto cargado: ${todosEstudiantesInstituto.length} registros. Procesando CSV...`)

        // Crear mapa de datos del instituto por RUT para búsqueda O(1)
        const mapaInstituto = new Map()
        todosEstudiantesInstituto.forEach(est => {
            if (est.rut) mapaInstituto.set(est.rut, est)
        })

        // Preparar datos para estudiantes_fuas (solo los que coinciden)
        const estudiantesFUAS = []
        let coincidenciasCount = 0

        datos_ministerio.forEach((datoMinisterio, idx) => {
            try {
                if (!datoMinisterio.rut) return

                const rutLimpio = limpiarRut(datoMinisterio.rut)
                const datosInst = mapaInstituto.get(rutLimpio)

                if (datosInst) {
                    // Mapeo a tabla unificada gestion_fuas
                    estudiantesFUAS.push({
                        rut: rutLimpio,
                        nombre: datosInst.nombre || '',
                        correo: datosInst.correo || '',
                        carrera: datosInst.carrera || null,
                        sede: datosInst.sede || null,
                        origen: 'acreditacion',
                        estado: 'debe_acreditar',
                        tipo_beneficio: datoMinisterio.tipo || datoMinisterio.formulario || null,
                        notificacion_enviada: false,
                        fecha_cruce: new Date().toISOString()
                    })
                    coincidenciasCount++
                }
            } catch (errLoop) {
                console.warn(`Error procesando fila CSV ${idx}:`, errLoop)
            }
        })

        console.log(`Cruce terminado. Encontrados: ${estudiantesFUAS.length}. Guardando en Supabase...`)

        // Guardar en Supabase por lotes para evitar error 413/Timeout en BD
        const BATCH_SIZE_INSERT = 500
        let totalGuardados = 0
        let erroresGuardado = []

        for (let i = 0; i < estudiantesFUAS.length; i += BATCH_SIZE_INSERT) {
            const lote = estudiantesFUAS.slice(i, i + BATCH_SIZE_INSERT)
            console.log(`Intentando guardar lote ${Math.floor(i / BATCH_SIZE_INSERT) + 1} (${lote.length} registros)...`)

            const { data: dataInsert, error: errorInsert } = await supabase
                .from('gestion_fuas')
                .upsert(lote, { onConflict: 'rut' })
                .select()

            if (errorInsert) {
                console.error(`❌ Error guardando lote ${i}:`, errorInsert.message, errorInsert.details, errorInsert.hint)
                erroresGuardado.push({
                    lote: Math.floor(i / BATCH_SIZE_INSERT) + 1,
                    error: errorInsert.message,
                    details: errorInsert.details || null,
                    hint: errorInsert.hint || null
                })
            } else {
                const guardados = dataInsert?.length || lote.length
                totalGuardados += guardados
                console.log(`✓ Guardado lote ${i} - ${i + lote.length} (${guardados} registros)`)
            }
        }

        console.log(`Proceso finalizado. Guardados: ${totalGuardados}/${estudiantesFUAS.length}`)

        if (erroresGuardado.length > 0) {
            console.error('Errores detectados al guardar:', JSON.stringify(erroresGuardado, null, 2))
        }

        res.json({
            exitoso: erroresGuardado.length === 0,
            coincidencias: estudiantesFUAS.length,
            guardados: totalGuardados,
            erroresGuardado: erroresGuardado,
            noEncontrados: datos_ministerio.length - estudiantesFUAS.length,
            estudiantes: estudiantesFUAS,
            mensaje: erroresGuardado.length === 0
                ? `${estudiantesFUAS.length} estudiantes encontrados y guardados correctamente`
                : `${estudiantesFUAS.length} encontrados, ${totalGuardados} guardados. ${erroresGuardado.length} lote(s) con error.`
        })

    } catch (error) {
        console.error('Error en cruce de datos:', error)
        res.status(500).json({
            exitoso: false,
            error: error.message,
            mensaje: 'Error al cruzar datos'
        })
    }
})

// ============================================
// OBTENER ESTUDIANTES PENDIENTES
// ============================================
app.get('/api/estudiantes-pendientes', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('estudiantes_fuas')
            .select('*')
            .eq('debe_postular', true)
            .order('nombre', { ascending: true })

        if (error) {
            throw new Error(`Error consultando Supabase: ${error.message}`)
        }

        res.json({
            exitoso: true,
            total: data.length,
            estudiantes: data
        })

    } catch (error) {
        console.error('Error obteniendo estudiantes pendientes:', error)
        res.status(500).json({
            exitoso: false,
            error: error.message
        })
    }
})

// ============================================
// MARCAR NOTIFICACIÓN ENVIADA
// ============================================
app.post('/api/marcar-notificado', async (req, res) => {
    try {
        const { ruts } = req.body

        if (!ruts || !Array.isArray(ruts)) {
            return res.status(400).json({
                exitoso: false,
                error: 'Se requiere un array de ruts'
            })
        }

        const { error } = await supabase
            .from('estudiantes_fuas')
            .update({
                notificacion_enviada: true,
                fecha_notificacion: new Date().toISOString()
            })
            .in('rut', ruts)

        if (error) {
            throw new Error(`Error actualizando Supabase: ${error.message}`)
        }

        res.json({
            exitoso: true,
            mensaje: `${ruts.length} estudiantes marcados como notificados`
        })

    } catch (error) {
        console.error(' Error marcando notificados:', error)
        res.status(500).json({
            exitoso: false,
            error: error.message
        })
    }
})

// ============================================
// DETECTAR ESTUDIANTES QUE NO POSTULARON A FUAS
// ============================================
app.post('/api/detectar-no-postulantes', async (req, res) => {
    try {
        const { ruts_postulantes } = req.body

        if (!ruts_postulantes || !Array.isArray(ruts_postulantes)) {
            return res.status(400).json({
                exitoso: false,
                error: 'Se requiere un array de ruts_postulantes'
            })
        }

        console.log(`📊 Detectando no postulantes. Recibidos ${ruts_postulantes.length} RUTs de postulantes...`)

        // Crear Set de RUTs postulantes (limpios) para búsqueda O(1)
        const setPostulantes = new Set()
        ruts_postulantes.forEach(rut => {
            const rutLimpio = limpiarRut(rut)
            if (rutLimpio) setPostulantes.add(rutLimpio)
        })

        console.log(`✓ ${setPostulantes.size} RUTs únicos de postulantes procesados`)

        // Obtener TODOS los estudiantes del instituto (paginado)
        let todosEstudiantesInstituto = []
        let page = 0
        const pageSize = 1000
        let more = true

        while (more) {
            const { data, error } = await supabase
                .from('datos_instituto')
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1)

            if (error) throw new Error(`Error leyendo instituto: ${error.message}`)

            if (data.length > 0) {
                todosEstudiantesInstituto = todosEstudiantesInstituto.concat(data)
                page++
                if (data.length < pageSize) more = false
            } else {
                more = false
            }
        }

        console.log(`✓ Instituto cargado: ${todosEstudiantesInstituto.length} estudiantes matriculados`)

        // Encontrar estudiantes que NO postularon
        // Lógica: Matriculados - Postulantes = No Postularon
        const noPostularon = []

        todosEstudiantesInstituto.forEach(est => {
            const rutLimpio = limpiarRut(est.rut)
            if (rutLimpio && !setPostulantes.has(rutLimpio)) {
                noPostularon.push({
                    rut: rutLimpio,
                    nombre: est.nombre || null,
                    correo: est.correo || null,
                    carrera: est.carrera || null,
                    sede: est.sede || null,
                    origen: 'fuas_nacional',
                    estado: 'no_postulo',
                    notificacion_enviada: false,
                    fecha_notificacion: null,
                    fecha_cruce: new Date().toISOString()
                })
            }
        })

        console.log(`📋 Encontrados ${noPostularon.length} estudiantes que NO postularon`)

        // Guardar en Supabase tabla gestion_fuas
        const BATCH_SIZE = 500
        let totalGuardados = 0
        let erroresGuardado = []

        for (let i = 0; i < noPostularon.length; i += BATCH_SIZE) {
            const lote = noPostularon.slice(i, i + BATCH_SIZE)

            const { data: dataInsert, error: errorInsert } = await supabase
                .from('gestion_fuas')
                .upsert(lote, { onConflict: 'rut' })
                .select()

            if (errorInsert) {
                console.error(`❌ Error guardando lote:`, errorInsert.message)
                erroresGuardado.push({
                    lote: Math.floor(i / BATCH_SIZE) + 1,
                    error: errorInsert.message
                })
            } else {
                totalGuardados += dataInsert?.length || lote.length
            }
        }

        console.log(`✓ Guardados: ${totalGuardados}/${noPostularon.length}`)

        res.json({
            exitoso: erroresGuardado.length === 0,
            totalMatriculados: todosEstudiantesInstituto.length,
            totalPostulantes: setPostulantes.size,
            noPostularon: noPostularon.length,
            guardados: totalGuardados,
            estudiantes: noPostularon,
            mensaje: erroresGuardado.length === 0
                ? `${noPostularon.length} estudiantes detectados que no postularon a FUAS`
                : `${noPostularon.length} detectados, ${totalGuardados} guardados. Errores en algunos lotes.`
        })

    } catch (error) {
        console.error('❌ Error detectando no postulantes:', error)
        res.status(500).json({
            exitoso: false,
            error: error.message,
            mensaje: 'Error al detectar estudiantes que no postularon'
        })
    }
})

// ============================================
// OBTENER ESTUDIANTES QUE NO POSTULARON
// ============================================
app.get('/api/no-postulantes', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('gestion_fuas')
            .select('*')
            .eq('origen', 'fuas_nacional')
            .order('nombre', { ascending: true })

        if (error) {
            throw new Error(`Error consultando Supabase: ${error.message}`)
        }

        res.json({
            exitoso: true,
            total: data.length,
            estudiantes: data
        })

    } catch (error) {
        console.error('Error obteniendo no postulantes:', error)
        res.status(500).json({
            exitoso: false,
            error: error.message
        })
    }
})

// ============================================
// MARCAR NO POSTULANTES COMO NOTIFICADOS
// ============================================
app.post('/api/marcar-notificado-fuas', async (req, res) => {
    try {
        const { ruts } = req.body

        if (!ruts || !Array.isArray(ruts)) {
            return res.status(400).json({
                exitoso: false,
                error: 'Se requiere un array de ruts'
            })
        }

        const { error } = await supabase
            .from('gestion_fuas')
            .update({
                notificacion_enviada: true,
                fecha_notificacion: new Date().toISOString()
            })
            .in('rut', ruts)

        if (error) {
            throw new Error(`Error actualizando Supabase: ${error.message}`)
        }

        res.json({
            exitoso: true,
            mensaje: `${ruts.length} estudiantes marcados como notificados`
        })

    } catch (error) {
        console.error('Error marcando notificados FUAS:', error)
        res.status(500).json({
            exitoso: false,
            error: error.message
        })
    }
})

// ============================================
// UTILIDADES
// ============================================

/**
 * Limpia un RUT eliminando puntos, guiones y espacios
 * Retorna solo los dígitos (sin DV)
 */
function limpiarRut(rut) {
    if (!rut) return ''
    let val = String(rut)

    // Si tiene guión, tomar la parte izquierda
    if (val.includes('-')) {
        val = val.split('-')[0]
    }

    // Eliminar puntos y espacios, dejar solo números y K (aunque K no debería ir en el cuerpo)
    let rutLimpio = val.replace(/[^0-9kK]/g, '')

    // Si por alguna razón quedó un DV pegado al final (caso borde sin guion pero con DV) 
    // y el largo es > 8 (ej: 123456789), es arriesgado cortar ciegamente sin guion.
    // Asumiremos que la entrada "con guion" es la norma para datos completos, 
    // y si viene sin guion es solo el cuerpo.

    return rutLimpio
}

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
    console.log(`
 Backend GestorCeduc iniciado
 Puerto: ${PORT}
 URL: http://localhost:${PORT}
 Health: http://localhost:${PORT}/health

Endpoints disponibles:
  GET  /api/sync-instituto        - Sincronizar estudiantes desde SQL Server
  POST /api/cruzar-datos          - Cruzar datos Ministerio con Instituto
  GET  /api/estudiantes-pendientes - Listar estudiantes que deben postular
  POST /api/marcar-notificado     - Marcar estudiantes como notificados
    `)
})

module.exports = app
