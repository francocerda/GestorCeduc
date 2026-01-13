import type { Role } from './auth'

export interface Estudiante {
  rut: string
  correo: string
  nombre: string
  roles: Role[] | null
  carrera: string | null
  sede: string | null
  anio_ingreso: number | null
  debe_postular: boolean
  es_postulante: boolean
  es_renovante: boolean
  tipo_beneficio: string | null
  estado_fuas: string | null
  primer_ingreso: string | null
  ultimo_ingreso: string | null
  ha_agendado_cita: boolean
  fecha_ultima_cita: string | null
  // Campos para rastreo de notificaciones
  notificacion_enviada: boolean
  fecha_notificacion: string | null
  creado_en: string
  actualizado_en: string
}

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