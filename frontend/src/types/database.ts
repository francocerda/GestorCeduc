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

export interface EstudianteFUAS {
  rut: string
  correo: string
  nombre: string
  debe_postular: boolean
  tipo_beneficio: string | null
  carrera: string | null
  origen: string | null
  fecha_cruce: string
}

// Para INSERT: campos obligatorios + campos opcionales
export type EstudianteInsert = Omit<Estudiante, 'creado_en' | 'actualizado_en'> & {
  primer_ingreso?: string | null
  ultimo_ingreso?: string | null
  ha_agendado_cita?: boolean
  fecha_ultima_cita?: string | null
}

// Para UPDATE: todo opcional excepto rut y creado_en
export type EstudianteUpdate = Partial<Omit<Estudiante, 'rut' | 'creado_en'>>

// Similar para Citas
export type CitaInsert = Omit<Cita, 'id' | 'creado_en' | 'actualizado_en'>
export type CitaUpdate = Partial<Omit<Cita, 'id' | 'creado_en'>>