-- =====================================================
-- SCHEMA: GestorCeduc - Base de Datos Unificada
-- Actualizado: Febrero 2026
-- =====================================================

-- Tabla: datos_instituto (sync desde SQL Server)
CREATE TABLE IF NOT EXISTS datos_instituto (
    rut TEXT PRIMARY KEY,
    nombre TEXT,
    correo TEXT,
    carrera TEXT,
    cod_carrera TEXT,
    sede TEXT,
    jornada TEXT,
    anio_ingreso INTEGER DEFAULT 2026,
    nivel INTEGER,
    estado_academico TEXT,
    fecha_carga TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: datos_ministerio (CSVs cargados)
CREATE TABLE IF NOT EXISTS datos_ministerio (
    rut TEXT PRIMARY KEY,
    nombre TEXT,
    tipo TEXT,
    beneficio TEXT,
    fecha_carga TIMESTAMPTZ DEFAULT NOW(),
    cargado_por TEXT
);

-- Tabla: gestion_fuas (TABLA UNIFICADA - antes estudiantes + gestion_fuas)
-- Contiene todos los estudiantes, con o sin pendientes FUAS
CREATE TABLE IF NOT EXISTS gestion_fuas (
    rut TEXT PRIMARY KEY,
    nombre TEXT,
    correo TEXT,
    carrera TEXT,
    cod_carrera TEXT,
    sede TEXT,
    jornada TEXT,
    roles JSONB,
    anio_ingreso INTEGER,
    nivel INTEGER,
    estado_academico TEXT,
    origen TEXT CHECK (origen IN ('acreditacion', 'fuas_nacional')),
    estado TEXT CHECK (estado IN (
        'sin_pendientes',       -- Estudiante normal, sin alertas FUAS
        'debe_acreditar',       -- CSV Acreditación → necesita cita
        'no_postulo',           -- CSV FUAS Nacional → NO postuló, debe subir doc
        'postulo',              -- CSV FUAS Nacional → SÍ postuló correctamente
        'documento_pendiente',  -- Subió doc, esperando validación
        'documento_validado',   -- Doc aprobado
        'documento_rechazado',  -- Doc rechazado, puede re-subir
        'acreditado'            -- Ya acreditó con asistente
    )),
    tipo_beneficio TEXT,
    documento_url TEXT,
    fecha_documento TIMESTAMPTZ,
    validado_por TEXT,
    comentario_rechazo TEXT,
    notificacion_enviada BOOLEAN DEFAULT FALSE,
    fecha_notificacion TIMESTAMPTZ,
    fecha_cruce TIMESTAMPTZ,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: asistentes_sociales
CREATE TABLE IF NOT EXISTS asistentes_sociales (
    rut TEXT PRIMARY KEY,
    correo TEXT,
    nombre TEXT,
    roles JSONB,
    horario_atencion JSONB,
    sede TEXT,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: citas
CREATE TABLE IF NOT EXISTS citas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rut_estudiante TEXT REFERENCES gestion_fuas(rut),
    rut_asistente TEXT REFERENCES asistentes_sociales(rut),
    inicio TIMESTAMPTZ NOT NULL,
    fin TIMESTAMPTZ NOT NULL,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada')),
    motivo TEXT,
    observaciones TEXT,
    descripcion_sesion TEXT,
    documento_url TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_gestion_fuas_estado ON gestion_fuas(estado);
CREATE INDEX IF NOT EXISTS idx_gestion_fuas_origen ON gestion_fuas(origen);
CREATE INDEX IF NOT EXISTS idx_citas_estudiante ON citas(rut_estudiante);
CREATE INDEX IF NOT EXISTS idx_citas_asistente ON citas(rut_asistente);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON citas(estado);
