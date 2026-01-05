export type EstadoFUAS  = 'PENDIENTE' | 'POSTULADO' | 'ADJUDICADO'
export type EstadoCita = 'AGENDADA' | 'REALIZADA' | 'CANCELADA' | 'NO_SHOW'

export interface Estudiante {
    id: string
    rut: string
    nombre_completo: string
    email_institucional: string | null
    estado_fuas: EstadoFUAS
    created_at: string
}

export interface Asistente_Social {
    id: string
    nombre_visible: string
    email: string 
    created_at: string
}

export interface Agendamiento {
    id: string
    id_estudiante: string
    id_asistente_social: string | null
    inicio: string
    fin: string
    estado: EstadoCita
    created_at: string
}

//Crear cita sin nada. Supabase maneja datos
export type InsertAgendamiento = Omit<Agendamiento, 'id' | 'created_at'>
//Actualizar cita de Agendamiento
export type UpdateAgendamiento = Partial<Agendamiento>