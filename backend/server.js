/**
 * Backend GestorCeduc - Servidor Express
 * Migrado a PostgreSQL Local
 */

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const sql = require('mssql')
const pool = require('./db/pool')
const multer = require('multer')
const driveService = require('./services/googleDriveService')

// Configuración de Multer para subida de archivos
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF'), false);
        }
    }
});

const app = express()
const PORT = process.env.PORT

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Configuración inicial
const port = process.env.PORT || 3001;
const dbConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.SQL_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
};

console.log('🔑 [Startup] ELASTIC_EMAIL_API_KEY:', process.env.ELASTIC_EMAIL_API_KEY ? 'Cargada correctamente (Termina en ' + process.env.ELASTIC_EMAIL_API_KEY.slice(-4) + ')' : '❌ NO ENCONTRADA');

// Configuración SQL Server (Legacy)
const sqlConfig = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    connectionTimeout: 30000,
    requestTimeout: 60000
}

// ============================================
// HELPERS DB
// ============================================

function buildUpsertQuery(table, columns, values, conflictTarget, updateColumns) {
    if (values.length === 0) return null;
    const rowPlaceholders = values.map((_, rowIndex) =>
        `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`
    ).join(', ');
    const flatValues = values.flat();
    let query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${rowPlaceholders}`;
    if (conflictTarget) {
        query += ` ON CONFLICT (${conflictTarget}) DO UPDATE SET `;
        query += updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ');
    }
    return { text: query, values: flatValues };
}

function limpiarRut(rut) {
    if (!rut) return ''
    let val = String(rut)
    if (val.includes('-')) val = val.split('-')[0]
    return val.replace(/[^0-9kK]/g, '')
}

// ============================================
// ENDPOINTS
// ============================================

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        db: 'postgresql',
        environment: process.env.NODE_ENV || 'development'
    })
})

// Sincronizar Instituto
app.get('/api/sync-instituto', async (req, res) => {
    let mssqlPool = null
    const client = await pool.connect();

    try {
        console.log('Conectando a SQL Server...')
        mssqlPool = await sql.connect(sqlConfig)
        const result = await mssqlPool.request().query('exec [ESTUDIANTES_MAT] 2026')
        const estudiantes = result.recordset

        console.log(`${estudiantes.length} estudiantes encontrados en SQL Server`)

        if (estudiantes.length === 0) {
            return res.json({ exitoso: true, total: 0, mensaje: 'No se encontraron estudiantes' })
        }

        const datosParaInsertar = estudiantes.map(est => {
            const nombreCompleto = [
                est.nombres_socionegocio,
                est.apaterno_socionegocio,
                est.amaterno_socionegocio
            ].filter(Boolean).join(' ').trim()

            return [
                limpiarRut(est.rut),
                nombreCompleto || null,
                est.Correo || null,
                est.nombre_carrera || null,
                est.CODSEDE || null,
                est.anio_ingreso || 2026,
                new Date()
            ]
        }).filter(row => row[0]);

        console.log('Guardando en PostgreSQL datos_instituto...')
        const BATCH_SIZE = 500
        let insertados = 0

        await client.query('BEGIN');

        for (let i = 0; i < datosParaInsertar.length; i += BATCH_SIZE) {
            const batch = datosParaInsertar.slice(i, i + BATCH_SIZE)
            const query = buildUpsertQuery(
                'datos_instituto',
                ['rut', 'nombre', 'correo', 'carrera', 'sede', 'anio_ingreso', 'fecha_carga'],
                batch,
                'rut',
                ['nombre', 'correo', 'carrera', 'sede', 'anio_ingreso', 'fecha_carga']
            )

            if (query) {
                await client.query(query.text, query.values)
                insertados += batch.length
            }
        }

        await client.query('COMMIT');

        res.json({
            exitoso: true,
            total: insertados,
            mensaje: `${insertados} estudiantes sincronizados correctamente`
        })

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error sincronización:', error)
        res.status(500).json({ exitoso: false, error: error.message })
    } finally {
        client.release();
        if (mssqlPool) await mssqlPool.close()
    }
})

// Cargar Datos Ministerio
app.post('/api/cargar-datos-ministerio', async (req, res) => {
    const client = await pool.connect();
    try {
        const { datos } = req.body
        if (!datos?.length) return res.status(400).json({ error: 'Datos requeridos' })

        const datosParaInsertar = datos.map(d => [
            limpiarRut(d.rut),
            d.nombre || null,
            d.tipo || null,
            d.beneficio || d.observacion || null,
            new Date(),
            d.cargado_por || null
        ]).filter(row => row[0]);

        console.log(`Cargando ${datosParaInsertar.length} registros ministerio...`)

        await client.query('BEGIN');

        const BATCH_SIZE = 1000
        for (let i = 0; i < datosParaInsertar.length; i += BATCH_SIZE) {
            const batch = datosParaInsertar.slice(i, i + BATCH_SIZE)
            const query = buildUpsertQuery(
                'datos_ministerio',
                ['rut', 'nombre', 'tipo', 'beneficio', 'fecha_carga', 'cargado_por'],
                batch,
                'rut',
                ['nombre', 'tipo', 'beneficio', 'fecha_carga', 'cargado_por']
            )
            if (query) await client.query(query.text, query.values)
        }

        await client.query('COMMIT');

        res.json({
            exitoso: true,
            totalGuardados: datosParaInsertar.length,
            mensaje: 'Carga completada exitosamente'
        })
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error carga ministerio:', error)
        res.status(500).json({ exitoso: false, error: error.message })
    } finally {
        client.release();
    }
})

// Cruzar Datos
app.post('/api/cruzar-datos', async (req, res) => {
    const client = await pool.connect();
    try {
        const { datos_ministerio } = req.body
        if (!datos_ministerio?.length) return res.status(400).json({ error: 'Datos requeridos' })

        console.log('Obteniendo datos instituto...')
        const { rows: estudiantesInst } = await client.query('SELECT * FROM datos_instituto');

        const mapaInstituto = new Map(estudiantesInst.map(e => [e.rut, e]));
        const estudiantesFUAS = [];

        datos_ministerio.forEach(dm => {
            const rut = limpiarRut(dm.rut);
            const inst = mapaInstituto.get(rut);
            if (inst) {
                estudiantesFUAS.push([
                    rut,
                    inst.nombre || '',
                    inst.correo || '',
                    inst.carrera,
                    inst.sede,
                    'acreditacion',
                    'debe_acreditar',
                    dm.tipo || dm.formulario || null,
                    false, // notificacion_enviada
                    new Date() // fecha_cruce
                ])
            }
        });

        console.log(`Guardando ${estudiantesFUAS.length} cruces en gestion_fuas...`)

        await client.query('BEGIN');

        const BATCH_SIZE = 500
        for (let i = 0; i < estudiantesFUAS.length; i += BATCH_SIZE) {
            const batch = estudiantesFUAS.slice(i, i + BATCH_SIZE)
            const query = buildUpsertQuery(
                'gestion_fuas',
                ['rut', 'nombre', 'correo', 'carrera', 'sede', 'origen', 'estado', 'tipo_beneficio', 'notificacion_enviada', 'fecha_cruce'],
                batch,
                'rut',
                ['nombre', 'correo', 'carrera', 'sede', 'origen', 'estado', 'tipo_beneficio', 'fecha_cruce']
            )
            if (query) await client.query(query.text, query.values)
        }

        await client.query('COMMIT');

        res.json({
            exitoso: true,
            coincidencias: estudiantesFUAS.length,
            estudiantes: estudiantesFUAS.map(row => ({
                rut: row[0],
                nombre: row[1],
                correo: row[2],
                carrera: row[3],
                sede: row[4],
                origen: row[5],
                estado: row[6],
                tipo_beneficio: row[7],
                notificacion_enviada: row[8]
            }))
        })

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error crossing data:', error)
        res.status(500).json({ exitoso: false, error: error.message })
    } finally {
        client.release();
    }
})

// Listar Pendientes
app.get('/api/estudiantes-pendientes', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM gestion_fuas 
            WHERE estado IN ('debe_acreditar', 'documento_pendiente', 'documento_rechazado')
            ORDER BY nombre ASC
        `);
        res.json({ exitoso: true, total: result.rows.length, estudiantes: result.rows })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Detectar No Postulantes
app.post('/api/detectar-no-postulantes', async (req, res) => {
    const client = await pool.connect();
    try {
        const { ruts_postulantes } = req.body
        if (!ruts_postulantes?.length) return res.status(400).json({ error: 'RUTs requeridos' })

        const setPostulantes = new Set(ruts_postulantes.map(limpiarRut));
        const { rows: todos } = await client.query('SELECT * FROM datos_instituto');
        const noPostularon = todos
            .filter(e => !setPostulantes.has(e.rut))
            .map(e => [
                e.rut,
                e.nombre || '',
                e.correo || '',
                e.carrera,
                e.sede,
                'fuas_nacional',
                'no_postulo',
                false,
                new Date()
            ]);

        console.log(`Guardando ${noPostularon.length} no postulantes...`)

        await client.query('BEGIN');

        const BATCH_SIZE = 500
        for (let i = 0; i < noPostularon.length; i += BATCH_SIZE) {
            const batch = noPostularon.slice(i, i + BATCH_SIZE)
            const query = buildUpsertQuery(
                'gestion_fuas',
                ['rut', 'nombre', 'correo', 'carrera', 'sede', 'origen', 'estado', 'notificacion_enviada', 'fecha_cruce'],
                batch,
                'rut',
                ['nombre', 'correo', 'carrera', 'sede', 'origen', 'estado', 'notificacion_enviada', 'fecha_cruce']
            );
            if (query) await client.query(query.text, query.values)
        }

        await client.query('COMMIT');

        res.json({
            exitoso: true,
            totalMatriculados: todos.length,
            noPostularon: noPostularon.length,
            estudiantes: noPostularon.map(r => ({ rut: r[0], nombre: r[1] }))
        })

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error no postulantes:', error)
        res.status(500).json({ exitoso: false, error: error.message })
    } finally {
        client.release();
    }
})

// Listar No Postulantes
app.get('/api/no-postulantes', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM gestion_fuas 
            WHERE origen = 'fuas_nacional' 
            ORDER BY nombre ASC
        `);
        res.json({ exitoso: true, total: result.rows.length, estudiantes: result.rows })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Marcar Notificado
app.post('/api/marcar-notificado', async (req, res) => {
    try {
        const { ruts } = req.body
        if (!ruts?.length) return res.status(400).json({ error: 'RUTs requeridos' })
        await pool.query(
            `UPDATE gestion_fuas SET notificacion_enviada = true, fecha_notificacion = NOW() WHERE rut = ANY($1)`,
            [ruts]
        );
        res.json({ exitoso: true, mensaje: 'Estudiantes marcados como notificados' })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

app.post('/api/marcar-notificado-fuas', async (req, res) => {
    try {
        const { ruts } = req.body
        if (!ruts?.length) return res.status(400).json({ error: 'RUTs requeridos' })
        await pool.query(
            `UPDATE gestion_fuas SET notificacion_enviada = true, fecha_notificacion = NOW() WHERE rut = ANY($1)`,
            [ruts]
        );
        res.json({ exitoso: true, mensaje: 'Estudiantes marcados como notificados' })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// ============================================
// ENDPOINTS PORTAL ESTUDIANTE
// ============================================

// IMPORTANTE: Los endpoints con path específico deben ir ANTES del endpoint con :rut
// para evitar que :rut capture "directorio" o "perfil" como un RUT

// Obtener directorio completo de estudiantes con filtros
app.get('/api/estudiantes/directorio', async (req, res) => {
    try {
        const { busqueda, sede, estado, limite = 50, offset = 0 } = req.query
        
        let whereConditions = []
        let params = []
        let paramIndex = 1

        // Filtro de búsqueda
        if (busqueda && busqueda.trim()) {
            whereConditions.push(`(
                g.rut ILIKE $${paramIndex} OR 
                g.nombre ILIKE $${paramIndex} OR 
                g.correo ILIKE $${paramIndex}
            )`)
            params.push(`%${busqueda.trim()}%`)
            paramIndex++
        }

        // Filtro de sede
        if (sede && sede !== 'todas') {
            whereConditions.push(`g.sede = $${paramIndex}`)
            params.push(sede)
            paramIndex++
        }

        // Filtro de estado
        if (estado && estado !== 'todos') {
            if (estado === 'con_pendientes') {
                whereConditions.push(`g.estado IN ('debe_acreditar', 'no_postulo', 'documento_pendiente', 'documento_rechazado')`)
            } else if (estado === 'sin_pendientes') {
                whereConditions.push(`g.estado IN ('sin_pendientes', 'documento_validado', 'acreditado')`)
            } else {
                // Filtro exacto por estado
                whereConditions.push(`g.estado = $${paramIndex}`)
                params.push(estado)
                paramIndex++
            }
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

        // Query principal
        const query = `
            SELECT 
                g.rut,
                g.nombre,
                g.correo,
                g.carrera,
                g.sede,
                g.anio_ingreso,
                g.estado as estado_fuas,
                g.origen,
                g.tipo_beneficio,
                (SELECT COUNT(*) FROM citas c WHERE c.rut_estudiante = g.rut) as total_citas,
                (SELECT MAX(c2.inicio) FROM citas c2 WHERE c2.rut_estudiante = g.rut) as ultima_cita
            FROM gestion_fuas g
            ${whereClause}
            ORDER BY g.nombre ASC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `
        params.push(parseInt(limite), parseInt(offset))

        // Query de conteo
        const countQuery = `SELECT COUNT(*) FROM gestion_fuas g ${whereClause}`
        const countParams = params.slice(0, -2) // Sin limit y offset

        const [dataResult, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ])

        res.json({
            estudiantes: dataResult.rows,
            total: parseInt(countResult.rows[0].count),
            limite: parseInt(limite),
            offset: parseInt(offset)
        })
    } catch (err) {
        console.error('Error en directorio:', err)
        res.status(500).json({ error: err.message })
    }
})

// Obtener perfil completo de un estudiante (antes del :rut genérico)
app.get('/api/estudiantes/:rut/perfil', async (req, res) => {
    try {
        const { rut } = req.params

        // Datos del estudiante
        const estudianteQuery = await pool.query(`
            SELECT 
                g.*,
                di.carrera as carrera_instituto,
                di.sede as sede_instituto,
                di.anio_ingreso as anio_ingreso_instituto
            FROM gestion_fuas g
            LEFT JOIN datos_instituto di ON g.rut = di.rut
            WHERE g.rut = $1
        `, [rut])

        if (estudianteQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado' })
        }

        // Historial de citas
        const citasQuery = await pool.query(`
            SELECT 
                c.id,
                c.inicio,
                c.fin,
                c.estado,
                c.motivo,
                c.observaciones,
                c.descripcion_sesion,
                c.documento_url,
                a.nombre as nombre_asistente
            FROM citas c
            LEFT JOIN asistentes_sociales a ON c.rut_asistente = a.rut
            WHERE c.rut_estudiante = $1
            ORDER BY c.inicio DESC
            LIMIT 10
        `, [rut])

        res.json({
            estudiante: estudianteQuery.rows[0],
            historial_citas: citasQuery.rows
        })
    } catch (err) {
        console.error('Error obteniendo perfil:', err)
        res.status(500).json({ error: err.message })
    }
})

// Obtener estudiante por RUT (genérico - debe ir DESPUÉS de los endpoints específicos)
app.get('/api/estudiantes/:rut', async (req, res) => {
    try {
        const { rut } = req.params;
        // Buscar primero en gestion_fuas (tabla unificada)
        const { rows } = await pool.query('SELECT * FROM gestion_fuas WHERE rut = $1', [rut]);
        if (rows.length === 0) {
            // Si no está, buscar en datos_instituto como fallback
            const { rows: inst } = await pool.query('SELECT * FROM datos_instituto WHERE rut = $1', [rut]);
            if (inst.length > 0) return res.json(inst[0]);
            return res.status(404).json({ error: 'Estudiante no encontrado' });
        }
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }) }
});

app.get('/api/gestion-fuas/:rut', async (req, res) => {
    try {
        const { rut } = req.params;
        const { rows } = await pool.query('SELECT rut, estado, documento_url, comentario_rechazo FROM gestion_fuas WHERE rut = $1', [rut]);
        res.json(rows.length > 0 ? rows[0] : null);
    } catch (err) { res.status(500).json({ error: err.message }) }
});

app.post('/api/gestion-fuas/:rut/documento', async (req, res) => {
    try {
        const { rut } = req.params;
        const { documento_url } = req.body;

        await pool.query(
            `UPDATE gestion_fuas 
             SET documento_url = $1, 
                 estado = 'documento_pendiente', 
                 fecha_documento = NOW(), 
                 comentario_rechazo = NULL 
             WHERE rut = $2`,
            [documento_url, rut]
        );

        res.json({ exitoso: true });
    } catch (err) { res.status(500).json({ error: err.message }) }
});

// ========== ENDPOINT DE SUBIDA A GOOGLE DRIVE ==========

// Subir documento de estudiante FUAS (PDF)
app.post('/api/documentos/estudiante/:rut', upload.single('archivo'), async (req, res) => {
    try {
        const { rut } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió archivo' });
        }

        console.log(`📤 Subiendo documento para estudiante ${rut}...`);

        // Subir a Google Drive
        // Obtener nombre del estudiante de la DB
        const { rows: estudianteRows } = await pool.query(
            'SELECT nombre FROM gestion_fuas WHERE rut = $1',
            [rut]
        );
        const nombreEstudiante = estudianteRows.length > 0 ? estudianteRows[0].nombre : null;

        // Subir a Google Drive con nombre del estudiante
        const resultado = await driveService.subirDocumentoEstudiante(req.file.buffer, rut, nombreEstudiante);

        // Actualizar base de datos
        await pool.query(
            `UPDATE gestion_fuas 
             SET documento_url = $1, 
                 estado = 'documento_pendiente', 
                 fecha_documento = NOW(), 
                 comentario_rechazo = NULL 
             WHERE rut = $2`,
            [resultado.url, rut]
        );

        console.log(`✅ Documento subido para ${nombreEstudiante || rut}: ${resultado.url}`);

        res.json({
            exitoso: true,
            url: resultado.url,
            urlVer: resultado.urlVer,
            id: resultado.id
        });
    } catch (err) {
        console.error('❌ Error subiendo documento:', err);
        res.status(500).json({ error: err.message });
    }
});

// Subir documento de cita (asistente social)
app.post('/api/citas/:id/documento', upload.single('archivo'), async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió archivo' });
        }

        // Obtener datos de la cita con nombres
        const { rows } = await pool.query(`
            SELECT 
                c.rut_estudiante,
                c.rut_asistente,
                e.nombre as nombre_estudiante,
                a.nombre as nombre_asistente
            FROM citas c
            LEFT JOIN gestion_fuas e ON c.rut_estudiante = e.rut
            LEFT JOIN asistentes_sociales a ON c.rut_asistente = a.rut
            WHERE c.id = $1
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Cita no encontrada' });
        }

        const { nombre_estudiante, nombre_asistente } = rows[0];

        console.log(`📤 Subiendo documento para cita ${id}...`);
        console.log(`   Asistente: ${nombre_asistente}, Estudiante: ${nombre_estudiante}`);

        // Subir a Google Drive (crea estructura carpetas: Asistente/Estudiante/archivo.pdf)
        const resultado = await driveService.subirDocumentoCita(
            req.file.buffer,
            id,
            nombre_asistente,
            nombre_estudiante
        );

        // Actualizar cita con URL del documento
        await pool.query(
            'UPDATE citas SET documento_url = $1, actualizado_en = NOW() WHERE id = $2',
            [resultado.url, id]
        );

        console.log(`✅ Documento de cita subido: ${resultado.url}`);

        res.json({
            exitoso: true,
            url: resultado.url,
            urlVer: resultado.urlVer,
            id: resultado.id
        });
    } catch (err) {
        console.error('❌ Error subiendo documento cita:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/citas/estudiante/:rut', async (req, res) => {
    try {
        const { rut } = req.params;
        const query = `
            SELECT c.*, 
            json_build_object('nombre', a.nombre, 'correo', a.correo) as asistentes_sociales
            FROM citas c
            LEFT JOIN asistentes_sociales a ON c.rut_asistente = a.rut
            WHERE c.rut_estudiante = $1
            ORDER BY c.inicio DESC
        `;
        const { rows } = await pool.query(query, [rut]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }) }
});

app.put('/api/citas/:id/cancelar', async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body; // Motivo opcional

        // 1. Obtener datos de la cita y del estudiante ANTES de cancelar
        const queryInfo = `
            SELECT 
                c.inicio,
                e.nombre,
                e.correo
            FROM citas c
            LEFT JOIN gestion_fuas e ON c.rut_estudiante = e.rut
            WHERE c.id = $1
        `;
        const { rows: info } = await pool.query(queryInfo, [id]);

        console.log('🔍 [Debug] Datos recuperados para cancelación:', info.length > 0 ? info[0] : 'Ninguno');

        if (info.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });

        const cita = info[0];

        // 2. Cancelar la cita
        const { rows } = await pool.query(
            "UPDATE citas SET estado = 'cancelada', motivo = COALESCE($2, motivo), actualizado_en = NOW() WHERE id = $1 RETURNING *",
            [id, motivo]
        );

        // 3. Enviar correo de notificación
        if (cita.correo) {
            console.log(`📧 [Debug] Iniciando envío de correo a ${cita.correo}`);
            const emailService = require('./services/emailService');
            emailService.sendCancellationEmail(
                cita.correo,
                cita.nombre || 'Estudiante',
                cita.inicio,
                motivo
            ).catch(err => console.error('Error enviando correo:', err));
        } else {
            console.warn('⚠️ [Debug] No se puede enviar correo: Estudiante sin email o no encontrado');
        }

        res.json(true);
    } catch (err) { res.status(500).json({ error: err.message }) }
});

// Verificar si estudiante tiene cita activa esta semana
app.get('/api/citas/verificar-semana/:rut', async (req, res) => {
    try {
        const { rut } = req.params;
        const { fecha } = req.query; // fecha en formato YYYY-MM-DD

        // Calcular inicio y fin de la semana
        const dateObj = fecha ? new Date(fecha) : new Date();
        const dayOfWeek = dateObj.getDay();
        const diff = dateObj.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Lunes

        const startOfWeek = new Date(dateObj.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const { rows } = await pool.query(
            `SELECT id FROM citas 
             WHERE rut_estudiante = $1 
             AND estado != 'cancelada'
             AND inicio >= $2 AND inicio <= $3`,
            [rut, startOfWeek.toISOString(), endOfWeek.toISOString()]
        );

        res.json({ tieneCita: rows.length > 0, cantidad: rows.length });
    } catch (err) { res.status(500).json({ error: err.message }) }
});

// Validar o rechazar documento de estudiante
app.put('/api/gestion-fuas/:rut/validar', async (req, res) => {
    try {
        const { rut } = req.params;
        const { validado, comentario, validado_por } = req.body;

        const nuevoEstado = validado ? 'documento_validado' : 'documento_rechazado';

        await pool.query(
            `UPDATE gestion_fuas 
             SET estado = $1, 
                 validado_por = $2, 
                 comentario_rechazo = $3
             WHERE rut = $4`,
            [nuevoEstado, validado_por || null, validado ? null : comentario, rut]
        );

        res.json({ exitoso: true, estado: nuevoEstado });
    } catch (err) { res.status(500).json({ error: err.message }) }
});

// ============================================
// ENDPOINTS AUTENTICACIÓN (sync login)
// ============================================

// Sincronizar Asistente Social durante login
app.post('/api/auth/sync-asistente', async (req, res) => {
    try {
        const { rut, correo, nombre, roles } = req.body;
        if (!rut) return res.status(400).json({ error: 'RUT requerido' });

        // Verificar si existe
        const { rows } = await pool.query('SELECT rut FROM asistentes_sociales WHERE rut = $1', [rut]);

        if (rows.length > 0) {
            // Actualizar existente
            await pool.query(
                `UPDATE asistentes_sociales 
                 SET correo = $2, nombre = $3, roles = $4, actualizado_en = NOW()
                 WHERE rut = $1`,
                [rut, correo, nombre, JSON.stringify(roles)]
            );
            console.log(`✅ Asistente Social actualizado: ${rut}`);
        } else {
            // Crear nuevo con horario por defecto
            const horarioDefecto = {
                lunes: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
                martes: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
                miercoles: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
                jueves: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
                viernes: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '17:00' }]
            };

            await pool.query(
                `INSERT INTO asistentes_sociales (rut, correo, nombre, roles, horario_atencion, activo)
                 VALUES ($1, $2, $3, $4, $5, true)`,
                [rut, correo, nombre, JSON.stringify(roles), JSON.stringify(horarioDefecto)]
            );
            console.log(`✅ Asistente Social creado: ${rut}`);
        }

        res.json({ exitoso: true });
    } catch (err) {
        console.error('Error sync asistente:', err);
        res.status(500).json({ error: err.message });
    }
});

// Sincronizar Estudiante durante login
app.post('/api/auth/sync-estudiante', async (req, res) => {
    try {
        const { rut, correo, nombre, roles } = req.body;
        if (!rut) return res.status(400).json({ error: 'RUT requerido' });

        // Verificar si existe en gestion_fuas
        const { rows } = await pool.query('SELECT rut, estado FROM gestion_fuas WHERE rut = $1', [rut]);

        if (rows.length > 0) {
            // Actualizar existente
            await pool.query(
                `UPDATE gestion_fuas 
                 SET correo = $2, nombre = $3, roles = $4, actualizado_en = NOW()
                 WHERE rut = $1`,
                [rut, correo, nombre, JSON.stringify(roles)]
            );
            console.log(`✅ Estudiante actualizado: ${rut}`);
        } else {
            // Crear nuevo con estado 'sin_pendientes'
            await pool.query(
                `INSERT INTO gestion_fuas (rut, correo, nombre, roles, estado, creado_en, actualizado_en)
                 VALUES ($1, $2, $3, $4, 'sin_pendientes', NOW(), NOW())`,
                [rut, correo, nombre, JSON.stringify(roles)]
            );
            console.log(`✅ Estudiante creado: ${rut}`);
        }

        // Obtener estado FUAS completo
        const { rows: fuasRows } = await pool.query(
            'SELECT estado, tipo_beneficio, carrera, sede, documento_url FROM gestion_fuas WHERE rut = $1',
            [rut]
        );

        const estadoFuas = fuasRows.length > 0 ? fuasRows[0] : null;

        res.json({
            exitoso: true,
            estadoFuas
        });
    } catch (err) {
        console.error('Error sync estudiante:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// ENDPOINTS EMAIL (Elastic Email)
// ============================================

const emailService = require('./services/emailService');

// Enviar notificación FUAS a un estudiante
app.post('/api/email/notificacion-fuas', async (req, res) => {
    try {
        const { estudiante } = req.body;
        if (!estudiante || !estudiante.correo) {
            return res.status(400).json({ exito: false, mensaje: 'Datos de estudiante requeridos' });
        }
        const resultado = await emailService.enviarNotificacionFUAS(estudiante);
        res.json(resultado);
    } catch (err) {
        console.error('Error enviando notificación FUAS:', err);
        res.status(500).json({ exito: false, mensaje: err.message });
    }
});

// Enviar notificaciones FUAS masivas
app.post('/api/email/notificaciones-masivas', async (req, res) => {
    try {
        const { estudiantes } = req.body;
        if (!estudiantes || !Array.isArray(estudiantes) || estudiantes.length === 0) {
            return res.status(400).json({ exitosos: 0, fallidos: 0, mensaje: 'Lista de estudiantes requerida' });
        }
        console.log(`📬 Recibida solicitud para enviar ${estudiantes.length} notificaciones...`);
        const resultado = await emailService.enviarNotificacionesMasivas(estudiantes);
        res.json(resultado);
    } catch (err) {
        console.error('Error enviando notificaciones masivas:', err);
        res.status(500).json({ exitosos: 0, fallidos: 0, mensaje: err.message });
    }
});

// Enviar recordatorio FUAS a un estudiante
app.post('/api/email/recordatorio-fuas', async (req, res) => {
    try {
        const { estudiante } = req.body;
        if (!estudiante || !estudiante.correo) {
            return res.status(400).json({ exito: false, mensaje: 'Datos de estudiante requeridos' });
        }
        const resultado = await emailService.enviarRecordatorioFUAS(estudiante);
        res.json(resultado);
    } catch (err) {
        console.error('Error enviando recordatorio FUAS:', err);
        res.status(500).json({ exito: false, mensaje: err.message });
    }
});

// Enviar recordatorios FUAS masivos
app.post('/api/email/recordatorios-masivos', async (req, res) => {
    try {
        const { estudiantes } = req.body;
        if (!estudiantes || !Array.isArray(estudiantes) || estudiantes.length === 0) {
            return res.status(400).json({ exitosos: 0, fallidos: 0, mensaje: 'Lista de estudiantes requerida' });
        }
        console.log(`📬 Recibida solicitud para enviar ${estudiantes.length} recordatorios...`);
        const resultado = await emailService.enviarRecordatoriosMasivosFUAS(estudiantes);
        res.json(resultado);
    } catch (err) {
        console.error('Error enviando recordatorios masivos:', err);
        res.status(500).json({ exitosos: 0, fallidos: 0, mensaje: err.message });
    }
});

// Verificar conexión con servicio de email
app.get('/api/email/verificar', async (req, res) => {
    try {
        const conectado = await emailService.verificarConexion();
        res.json({ conectado });
    } catch (err) {
        res.json({ conectado: false });
    }
});

// Enviar solicitud de reunión a estudiante
app.post('/api/email/solicitar-reunion', async (req, res) => {
    try {
        const { estudiante, asistente, motivo, mensaje } = req.body;

        if (!estudiante || !asistente || !motivo) {
            return res.status(400).json({ 
                exito: false, 
                mensaje: 'Faltan datos requeridos (estudiante, asistente, motivo)' 
            });
        }

        if (!estudiante.correo) {
            return res.status(400).json({ 
                exito: false, 
                mensaje: 'El estudiante no tiene correo electrónico registrado' 
            });
        }

        const resultado = await emailService.enviarSolicitudReunion({
            estudiante,
            asistente,
            motivo,
            mensaje: mensaje || ''
        });

        if (resultado.exito) {
            // Registrar en log (opcional)
            console.log(`📧 Solicitud de reunión enviada: ${asistente.nombre} -> ${estudiante.correo} (${motivo})`);
        }

        res.json(resultado);
    } catch (err) {
        console.error('Error enviando solicitud de reunión:', err);
        res.status(500).json({ exito: false, mensaje: err.message });
    }
});

// ============================================
// ENDPOINTS BENEFICIOS (Preselección)
// ============================================

/**
 * POST /api/beneficios/cruzar
 * Cruza datos de preselección nacional con estudiantes matriculados
 */
app.post('/api/beneficios/cruzar', async (req, res) => {
    try {
        const { estudiantes: datosPreseleccion } = req.body;

        if (!datosPreseleccion || !Array.isArray(datosPreseleccion)) {
            return res.status(400).json({ error: 'Se requiere array de estudiantes' });
        }

        console.log(`🔄 Cruzando ${datosPreseleccion.length} registros de preselección con estudiantes matriculados...`);

        // Obtener todos los estudiantes matriculados de la institución
        const { rows: matriculados } = await pool.query(`
            SELECT rut, nombre, correo, sede, carrera, estado_matricula
            FROM gestion_fuas
            WHERE correo IS NOT NULL AND correo != ''
        `);

        console.log(`📊 Estudiantes matriculados con correo: ${matriculados.length}`);

        // Crear mapa de RUTs matriculados para búsqueda rápida
        const matriculadosMap = new Map();
        for (const est of matriculados) {
            const rutLimpio = limpiarRut(est.rut);
            matriculadosMap.set(rutLimpio, est);
        }

        // Cruzar datos
        const estudiantesCruzados = [];
        let sinBeneficios = 0;

        for (const presel of datosPreseleccion) {
            const rutLimpio = limpiarRut(presel.rut);
            const matriculado = matriculadosMap.get(rutLimpio);

            if (matriculado) {
                // Construir lista de beneficios
                const beneficios = [];
                if (presel.gratuidad) beneficios.push({ tipo: 'gratuidad', detalle: presel.gratuidad });
                if (presel.bvp) beneficios.push({ tipo: 'bvp', detalle: presel.bvp });
                if (presel.bb) beneficios.push({ tipo: 'bb', detalle: presel.bb });
                if (presel.bea) beneficios.push({ tipo: 'bea', detalle: presel.bea });
                if (presel.bdte) beneficios.push({ tipo: 'bdte', detalle: presel.bdte });
                if (presel.bjgm) beneficios.push({ tipo: 'bjgm', detalle: presel.bjgm });
                if (presel.bnm) beneficios.push({ tipo: 'bnm', detalle: presel.bnm });
                if (presel.bhpe) beneficios.push({ tipo: 'bhpe', detalle: presel.bhpe });
                if (presel.fscu) beneficios.push({ tipo: 'fscu', detalle: presel.fscu });

                if (beneficios.length > 0) {
                    estudiantesCruzados.push({
                        rut: matriculado.rut,
                        nombre: matriculado.nombre || presel.nombreCompleto,
                        correo: matriculado.correo,
                        sede: matriculado.sede,
                        carrera: matriculado.carrera,
                        beneficios,
                        notificado: false
                    });
                } else {
                    sinBeneficios++;
                }
            }
        }

        console.log(`✅ Cruce completado: ${estudiantesCruzados.length} estudiantes con beneficios encontrados`);

        res.json({
            exito: true,
            totalPreseleccion: datosPreseleccion.length,
            totalMatriculados: matriculados.length,
            estudiantesConBeneficios: estudiantesCruzados.length,
            sinBeneficios,
            estudiantes: estudiantesCruzados
        });
    } catch (err) {
        console.error('Error en cruce de beneficios:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/beneficios/notificar
 * Envía notificaciones masivas de beneficios a estudiantes
 */
app.post('/api/beneficios/notificar', async (req, res) => {
    try {
        const { estudiantes, anoProceso } = req.body;

        if (!estudiantes || !Array.isArray(estudiantes) || estudiantes.length === 0) {
            return res.status(400).json({ error: 'Se requiere array de estudiantes con beneficios' });
        }

        console.log(`📧 Enviando notificaciones de beneficios a ${estudiantes.length} estudiantes...`);

        const emailService = require('./services/emailService');
        const resultado = await emailService.enviarNotificacionesBeneficiosMasivas(estudiantes, anoProceso);

        console.log(`✅ Notificaciones enviadas: ${resultado.exitosos} exitosos, ${resultado.fallidos} fallidos`);

        res.json({
            exito: true,
            enviados: resultado.exitosos,
            fallidos: resultado.fallidos,
            errores: resultado.errores
        });
    } catch (err) {
        console.error('Error enviando notificaciones de beneficios:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/beneficios/guardar-cruce
 * Guarda el resultado del cruce en la BD para registro histórico
 */
app.post('/api/beneficios/guardar-cruce', async (req, res) => {
    try {
        const { estudiantes, anoProceso } = req.body;

        if (!estudiantes || !Array.isArray(estudiantes)) {
            return res.status(400).json({ error: 'Se requiere array de estudiantes' });
        }

        // Actualizar el campo tipo_beneficio en gestion_fuas para cada estudiante
        let actualizados = 0;
        for (const est of estudiantes) {
            const beneficiosStr = est.beneficios.map(b => b.tipo).join(', ');
            const { rowCount } = await pool.query(`
                UPDATE gestion_fuas 
                SET tipo_beneficio = $1, actualizado_en = NOW()
                WHERE rut = $2
            `, [beneficiosStr, est.rut]);
            
            if (rowCount > 0) actualizados++;
        }

        console.log(`💾 Cruce guardado: ${actualizados} estudiantes actualizados`);

        res.json({
            exito: true,
            actualizados,
            mensaje: `Se actualizaron ${actualizados} registros con información de beneficios`
        });
    } catch (err) {
        console.error('Error guardando cruce de beneficios:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`
 Backend GestorCeduc migrado a PostgreSQL
 Puerto: ${PORT}
 URL: http://localhost:${PORT}
 DB: ${process.env.PG_DATABASE}@${process.env.PG_HOST}
    `)
})

module.exports = app

// ============================================
// ENDPOINTS GESTION ESTUDIANTES (useStudents)
// ============================================

// Listar estudiantes con filtros
// Si se filtra por debe_postular o estado_fuas, consulta gestion_fuas
app.get('/api/estudiantes', async (req, res) => {
    try {
        const { busqueda, debe_postular, estado_fuas, limit, offset } = req.query

        // Si piden estudiantes que deben postular, usamos gestion_fuas
        if (debe_postular === 'true' || estado_fuas) {
            let query = 'SELECT * FROM gestion_fuas WHERE 1=1'
            const values = []
            let paramIndex = 1

            if (busqueda) {
                query += ` AND (rut ILIKE $${paramIndex} OR nombre ILIKE $${paramIndex})`
                values.push(`%${busqueda}%`)
                paramIndex++
            }

            if (estado_fuas) {
                query += ` AND estado = $${paramIndex}`
                values.push(estado_fuas)
                paramIndex++
            } else if (debe_postular === 'true') {
                // Estudiantes que requieren acción
                query += ` AND estado IN ('debe_acreditar', 'documento_pendiente', 'documento_rechazado', 'no_postulo')`
            }

            query += ' ORDER BY nombre ASC'

            if (limit) {
                query += ` LIMIT $${paramIndex}`
                values.push(parseInt(limit))
                paramIndex++
            }

            if (offset) {
                query += ` OFFSET $${paramIndex}`
                values.push(parseInt(offset))
                paramIndex++
            }

            const { rows } = await pool.query(query, values)
            res.json(rows)
        } else {
            // Consulta normal a tabla estudiantes
            let query = 'SELECT * FROM estudiantes WHERE 1=1'
            const values = []
            let paramIndex = 1

            if (busqueda) {
                query += ` AND (rut ILIKE $${paramIndex} OR nombre ILIKE $${paramIndex})`
                values.push(`%${busqueda}%`)
                paramIndex++
            }

            query += ' ORDER BY nombre ASC'

            if (limit) {
                query += ` LIMIT $${paramIndex}`
                values.push(parseInt(limit))
                paramIndex++
            }

            if (offset) {
                query += ` OFFSET $${paramIndex}`
                values.push(parseInt(offset))
                paramIndex++
            }

            const { rows } = await pool.query(query, values)
            res.json(rows)
        }
    } catch (err) { res.status(500).json({ error: err.message }) }
})

// Contar estudiantes pendientes (usa gestion_fuas)
app.get('/api/estudiantes/count/pendientes', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT COUNT(*) FROM gestion_fuas 
            WHERE estado IN ('debe_acreditar', 'documento_pendiente', 'documento_rechazado', 'no_postulo')
        `)
        res.json({ count: parseInt(rows[0].count) })
    } catch (err) { res.status(500).json({ error: err.message }) }
})

// Actualizar estudiante
app.put('/api/estudiantes/:rut', async (req, res) => {
    try {
        const { rut } = req.params
        const updates = req.body

        // Construir query dinámica
        const keys = Object.keys(updates)
        if (keys.length === 0) return res.status(400).json({ error: 'No updates provided' })

        const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ')
        const values = [rut, ...Object.values(updates)]

        const { rowCount } = await pool.query(
            `UPDATE estudiantes SET ${setClause} WHERE rut = $1`,
            values
        )

        if (rowCount === 0) return res.status(404).json({ error: 'Estudiante no encontrado' })
        res.json({ success: true })
    } catch (err) { res.status(500).json({ error: err.message }) }
})

// Marcar notificados masivo (tabla gestion_fuas - los campos de notificación están ahí)
app.post('/api/estudiantes/notificar', async (req, res) => {
    try {
        const { ruts } = req.body
        if (!ruts?.length) return res.status(400).json({ error: 'RUTs requeridos' })

        // Usar gestion_fuas que tiene los campos de notificación
        await pool.query(
            "UPDATE gestion_fuas SET notificacion_enviada = true, fecha_notificacion = NOW() WHERE rut = ANY($1)",
            [ruts]
        )
        res.json({ success: true, message: 'Estudiantes marcados como notificados' })
    } catch (err) { res.status(500).json({ error: err.message }) }
})

// ============================================
// ENDPOINTS ASISTENTES (useAsistentesSociales)
// ============================================

app.get('/api/asistentes-sociales', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM asistentes_sociales WHERE activo = true ORDER BY nombre ASC')
        res.json(rows)
    } catch (err) { res.status(500).json({ error: err.message }) }
})

// Obtener asistente por RUT
app.get('/api/asistentes/:rut', async (req, res) => {
    try {
        const { rut } = req.params
        const { rows } = await pool.query('SELECT * FROM asistentes_sociales WHERE rut = $1', [rut])
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Asistente no encontrado' })
        }
        res.json(rows[0])
    } catch (err) { res.status(500).json({ error: err.message }) }
})

// Obtener horario de un asistente
app.get('/api/asistentes/:rut/horario', async (req, res) => {
    try {
        const { rut } = req.params
        const { rows } = await pool.query('SELECT horario_atencion, sede FROM asistentes_sociales WHERE rut = $1', [rut])
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Asistente no encontrado' })
        }
        res.json({ 
            horario_atencion: rows[0].horario_atencion,
            sede: rows[0].sede 
        })
    } catch (err) { res.status(500).json({ error: err.message }) }
})

// Actualizar horario de un asistente
app.put('/api/asistentes/:rut/horario', async (req, res) => {
    try {
        const { rut } = req.params
        const { horario_atencion } = req.body

        if (!horario_atencion) {
            return res.status(400).json({ error: 'Horario requerido' })
        }

        // Validar estructura del horario
        const diasValidos = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
        for (const dia of diasValidos) {
            if (horario_atencion[dia] && !Array.isArray(horario_atencion[dia])) {
                return res.status(400).json({ error: `Formato inválido para ${dia}` })
            }
            if (horario_atencion[dia]) {
                for (const bloque of horario_atencion[dia]) {
                    if (!bloque.inicio || !bloque.fin) {
                        return res.status(400).json({ error: `Bloque inválido en ${dia}` })
                    }
                }
            }
        }

        const { rows } = await pool.query(
            `UPDATE asistentes_sociales 
             SET horario_atencion = $2, actualizado_en = NOW()
             WHERE rut = $1
             RETURNING horario_atencion`,
            [rut, JSON.stringify(horario_atencion)]
        )

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Asistente no encontrado' })
        }

        console.log(`✅ Horario actualizado para asistente: ${rut}`)
        res.json({ exitoso: true, horario_atencion: rows[0].horario_atencion })
    } catch (err) {
        console.error('Error actualizando horario:', err)
        res.status(500).json({ error: err.message })
    }
})

// Actualizar sede de un asistente
app.put('/api/asistentes/:rut/sede', async (req, res) => {
    try {
        const { rut } = req.params
        const { sede } = req.body

        const { rows } = await pool.query(
            `UPDATE asistentes_sociales 
             SET sede = $2, actualizado_en = NOW()
             WHERE rut = $1
             RETURNING sede`,
            [rut, sede]
        )

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Asistente no encontrado' })
        }

        console.log(`✅ Sede actualizada para asistente: ${rut} -> ${sede}`)
        res.json({ exitoso: true, sede: rows[0].sede })
    } catch (err) {
        console.error('Error actualizando sede:', err)
        res.status(500).json({ error: err.message })
    }
})

// Obtener sedes únicas para filtros
app.get('/api/sedes', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT DISTINCT sede FROM gestion_fuas WHERE sede IS NOT NULL AND sede != ''
            UNION
            SELECT DISTINCT sede FROM asistentes_sociales WHERE sede IS NOT NULL AND sede != ''
            ORDER BY sede ASC
        `)
        res.json(rows.map(r => r.sede))
    } catch (err) { res.status(500).json({ error: err.message }) }
})

// ============================================
// ENDPOINTS GESTION CITAS (useCitas)
// ============================================

// Crear cita
app.post('/api/citas', async (req, res) => {
    try {
        const { rut_estudiante, rut_asistente, inicio, fin, estado, motivo } = req.body
        const { rows } = await pool.query(
            `INSERT INTO citas (rut_estudiante, rut_asistente, inicio, fin, estado, motivo) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [rut_estudiante, rut_asistente, inicio, fin, estado, motivo]
        )
        res.json(rows[0])
    } catch (err) { res.status(500).json({ error: err.message }) }
})

// Obtener citas por asistente
app.get('/api/citas/asistente/:rut', async (req, res) => {
    try {
        const { rut } = req.params
        const query = `
            SELECT c.*, 
            json_build_object('nombre', e.nombre, 'correo', e.correo, 'rut', e.rut) as estudiantes
            FROM citas c
            LEFT JOIN gestion_fuas e ON c.rut_estudiante = e.rut
            WHERE c.rut_asistente = $1
            ORDER BY c.inicio ASC
        `
        const { rows } = await pool.query(query, [rut])
        res.json(rows)
    } catch (err) { res.status(500).json({ error: err.message }) }
})

// Obtener citas hoy asistente
app.get('/api/citas/hoy/:rut', async (req, res) => {
    try {
        const { rut } = req.params
        const query = `
            SELECT c.*, 
            json_build_object('nombre', e.nombre, 'correo', e.correo, 'rut', e.rut) as estudiantes
            FROM citas c
            LEFT JOIN gestion_fuas e ON c.rut_estudiante = e.rut
            WHERE c.rut_asistente = $1
            AND c.inicio::date = CURRENT_DATE
            ORDER BY c.inicio ASC
        `
        const { rows } = await pool.query(query, [rut])
        res.json(rows)
    } catch (err) { res.status(500).json({ error: err.message }) }
})

// Actualizar cita (estado, completada, etc)
app.put('/api/citas/:id', async (req, res) => {
    try {
        const { id } = req.params
        const updates = req.body

        const keys = Object.keys(updates)
        if (keys.length === 0) return res.status(400).json({ error: 'No updates provided' })

        // Construir query dinámicamente
        const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ')
        const values = [id, ...keys.map(k => updates[k])]

        // Agregar actualizado_en al final
        const setClauseFinal = setClause + `, actualizado_en = NOW()`

        const { rowCount } = await pool.query(
            `UPDATE citas SET ${setClauseFinal} WHERE id = $1`,
            values
        )

        if (rowCount === 0) return res.status(404).json({ error: 'Cita no encontrada' })
        res.json({ success: true })
    } catch (err) {
        console.error('Error actualizando cita:', err)
        res.status(500).json({ error: err.message })
    }
})

// Citas en Rango
app.get('/api/citas/rango', async (req, res) => {
    try {
        const { rut_asistente, inicio, fin } = req.query
        const { rows } = await pool.query(
            `SELECT * FROM citas 
             WHERE rut_asistente = $1 
             AND estado != 'cancelada'
             AND inicio >= $2 AND inicio <= $3`,
            [rut_asistente, inicio, fin]
        )
        res.json(rows)
    } catch (err) { res.status(500).json({ error: err.message }) }
})

// Datos Ministerio (Fallback)
app.get('/api/datos-ministerio', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT rut, tipo, beneficio FROM datos_ministerio')
        res.json(rows)
    } catch (err) { res.status(500).json({ error: err.message }) }
})

// Datos Instituto (Fallback)
app.get('/api/datos-instituto', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT rut, nombre, correo, carrera, sede FROM datos_instituto')
        res.json(rows)
    } catch (err) { res.status(500).json({ error: err.message }) }
})
