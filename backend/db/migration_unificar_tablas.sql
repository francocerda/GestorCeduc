-- =====================================================
-- MIGRACIÓN: Unificar tablas estudiantes + gestion_fuas
-- Ejecutar con: psql -U gestor_user -d gestor_ceduc -f migration_unificar_tablas.sql
-- =====================================================

BEGIN;

-- =====================================================
-- PASO 1: Agregar campos faltantes a gestion_fuas
-- =====================================================
ALTER TABLE gestion_fuas 
ADD COLUMN IF NOT EXISTS roles JSONB,
ADD COLUMN IF NOT EXISTS anio_ingreso INTEGER,
ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ DEFAULT NOW();

-- =====================================================
-- PASO 2: Modificar constraint de estado
-- =====================================================
-- Eliminar constraint actual
ALTER TABLE gestion_fuas DROP CONSTRAINT IF EXISTS gestion_fuas_estado_check;

-- Permitir NULL temporalmente
ALTER TABLE gestion_fuas ALTER COLUMN estado DROP NOT NULL;

-- Agregar nuevo constraint con 'sin_pendientes'
ALTER TABLE gestion_fuas 
ADD CONSTRAINT gestion_fuas_estado_check CHECK (estado IN (
    'sin_pendientes',
    'debe_acreditar',
    'no_postulo',
    'documento_pendiente',
    'documento_validado',
    'documento_rechazado',
    'acreditado'
));

-- =====================================================
-- PASO 3: Migrar datos de estudiantes a gestion_fuas
-- =====================================================
-- Insertar estudiantes que no existen en gestion_fuas
INSERT INTO gestion_fuas (rut, nombre, correo, carrera, sede, roles, anio_ingreso, estado, creado_en, actualizado_en)
SELECT 
    e.rut,
    e.nombre,
    e.correo,
    e.carrera,
    e.sede,
    e.roles,
    e.anio_ingreso,
    'sin_pendientes',
    COALESCE(e.creado_en, NOW()),
    NOW()
FROM estudiantes e
WHERE NOT EXISTS (SELECT 1 FROM gestion_fuas g WHERE g.rut = e.rut)
ON CONFLICT (rut) DO NOTHING;

-- Actualizar roles/anio_ingreso en registros existentes que no los tienen
UPDATE gestion_fuas g
SET 
    roles = COALESCE(g.roles, e.roles),
    anio_ingreso = COALESCE(g.anio_ingreso, e.anio_ingreso),
    actualizado_en = NOW()
FROM estudiantes e
WHERE g.rut = e.rut;

-- =====================================================
-- PASO 4: Migrar Foreign Key de citas
-- =====================================================
-- Eliminar FK actual (si existe)
ALTER TABLE citas DROP CONSTRAINT IF EXISTS citas_rut_estudiante_fkey;

-- Crear nueva FK apuntando a gestion_fuas
ALTER TABLE citas 
ADD CONSTRAINT citas_rut_estudiante_fkey 
FOREIGN KEY (rut_estudiante) REFERENCES gestion_fuas(rut);

-- =====================================================
-- PASO 5: Verificación
-- =====================================================
-- Mostrar conteo por estado
DO $$
DECLARE
    total_migrados INTEGER;
    total_sin_pendientes INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_migrados FROM gestion_fuas;
    SELECT COUNT(*) INTO total_sin_pendientes FROM gestion_fuas WHERE estado = 'sin_pendientes';
    
    RAISE NOTICE '   - Total registros en gestion_fuas: %', total_migrados;
    RAISE NOTICE '   - Estudiantes sin pendientes: %', total_sin_pendientes;
END $$;

COMMIT;

