import type { Role } from './auth'

/**
 * Interfaz Estudiante - coincide con schema PostgreSQL tabla 'estudiantes'
 * Campos de gestión FUAS están en tabla 'gestion_fuas' (usar GestionFUAS)
 */
export interface Estudiante {
  rut: string
  correo: string | null
  nombre: string | null
  roles: Role[] | null
  carrera: string | null
  sede: string | null
  anio_ingreso: number | null
  creado_en?: string
  actualizado_en?: string
}

// Tipo para insertar estudiantes (sin campos auto-generados)
export type EstudianteInsert = Omit<Estudiante, 'creado_en' | 'actualizado_en'>

export interface AsistenteSocial {
  rut: string
  correo: string
  nombre: string
  roles: Role[] | null
  horario_atencion: HorarioAtencion | null
  sede: string | null
  activo: boolean
  creado_en: string
  actualizado_en: string
}

export interface HorarioAtencion {
  lunes?: BloqueHorario[]
  martes?: BloqueHorario[]
  miercoles?: BloqueHorario[]
  jueves?: BloqueHorario[]
  viernes?: BloqueHorario[]
}

export interface BloqueHorario {
  inicio: string
  fin: string
}

export interface Cita {
  id: string
  rut_estudiante: string
  rut_asistente: string
  inicio: string
  fin: string
  estado: EstadoCita
  motivo: string
  observaciones: string | null
  creado_en: string
  actualizado_en: string
}

export type EstadoCita = 'pendiente' | 'confirmada' | 'completada' | 'cancelada'

// Tipo para insertar citas (sin campos auto-generados)
export type CitaInsert = Omit<Cita, 'id' | 'creado_en' | 'actualizado_en'>

export interface DatosMinisterio {
  rut: string
  nombre: string | null
  tipo: string | null
  beneficio: string | null
  fecha_carga: string
  cargado_por: string | null
}

export interface DatosInstituto {
  rut: string
  nombre: string | null
  correo: string | null
  carrera: string | null
  sede: string | null
  anio_ingreso: number | null
  fecha_carga: string
  cargado_por: string | null
}

// Tabla unificada gestion_fuas
export type OrigenFUAS = 'acreditacion' | 'fuas_nacional'
export type EstadoGestionFUAS =
  | 'debe_acreditar'       // CSV Acreditación → necesita cita
  | 'no_postulo'           // CSV FUAS Nacional → debe subir doc
  | 'documento_pendiente'  // Subió doc, esperando validación
  | 'documento_validado'   // Doc aprobado
  | 'documento_rechazado'  // Doc rechazado, puede re-subir
  | 'acreditado'           // Ya acreditó con asistente

export interface GestionFUAS {
  rut: string
  nombre: string | null
  correo: string | null
  carrera: string | null
  sede: string | null
  origen: OrigenFUAS
  estado: EstadoGestionFUAS
  tipo_beneficio: string | null
  documento_url: string | null
  fecha_documento: string | null
  validado_por: string | null
  comentario_rechazo: string | null
  notificacion_enviada: boolean
  fecha_notificacion: string | null
  fecha_cruce: string
}

// Alias para compatibilidad temporal
export type EstudianteFUAS = GestionFUAS
export type NoPostuloFUAS = GestionFUAS