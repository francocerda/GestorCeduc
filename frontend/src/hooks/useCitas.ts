import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Cita, CitaInsert, CitaUpdate, EstadoCita, AsistenteSocial } from '../types/database'

interface CitaConAsistente extends Cita {
    asistentes_sociales: Pick<AsistenteSocial, 'nombre' | 'correo'> | null
}

interface CitaConEstudiante extends Cita {
    estudiantes: { nombre: string; correo: string; rut: string } | null
}

/**
 * Hook para manejar operaciones CRUD de citas
 * Incluye funciones para crear, leer, actualizar y cancelar citas
 */
export function useCitas() {
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Obtener citas de un estudiante
    const obtenerCitasPorEstudiante = useCallback(async (rut: string): Promise<CitaConAsistente[]> => {
        setCargando(true)
        setError(null)

        try {
            const { data, error: errorConsulta } = await supabase
                .from('citas')
                .select(`
          *,
          asistentes_sociales (nombre, correo)
        `)
                .eq('rut_estudiante', rut)
                .order('inicio', { ascending: true })

            if (errorConsulta) throw errorConsulta
            return data || []
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al cargar citas'
            setError(mensaje)
            console.error('❌ Error al obtener citas:', err)
            return []
        } finally {
            setCargando(false)
        }
    }, [])

    // Obtener citas de un asistente
    const obtenerCitasPorAsistente = useCallback(async (rut: string): Promise<CitaConEstudiante[]> => {
        setCargando(true)
        setError(null)

        try {
            const { data, error: errorConsulta } = await supabase
                .from('citas')
                .select(`
          *,
          estudiantes (nombre, correo, rut)
        `)
                .eq('rut_asistente', rut)
                .order('inicio', { ascending: true })

            if (errorConsulta) throw errorConsulta
            return data || []
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al cargar citas'
            setError(mensaje)
            console.error('❌ Error al obtener citas:', err)
            return []
        } finally {
            setCargando(false)
        }
    }, [])

    // Obtener citas de hoy para un asistente
    const obtenerCitasHoy = useCallback(async (rutAsistente: string): Promise<CitaConEstudiante[]> => {
        setCargando(true)
        setError(null)

        const hoy = new Date()
        const inicioDia = new Date(hoy.setHours(0, 0, 0, 0)).toISOString()
        const finDia = new Date(hoy.setHours(23, 59, 59, 999)).toISOString()

        try {
            const { data, error: errorConsulta } = await supabase
                .from('citas')
                .select(`
          *,
          estudiantes (nombre, correo, rut)
        `)
                .eq('rut_asistente', rutAsistente)
                .gte('inicio', inicioDia)
                .lte('inicio', finDia)
                .order('inicio', { ascending: true })

            if (errorConsulta) throw errorConsulta
            return data || []
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al cargar citas de hoy'
            setError(mensaje)
            return []
        } finally {
            setCargando(false)
        }
    }, [])

    // Crear una nueva cita
    const crearCita = useCallback(async (datosCita: CitaInsert): Promise<Cita | null> => {
        setCargando(true)
        setError(null)

        try {
            const { data, error: errorInsertar } = await supabase
                .from('citas')
                .insert(datosCita)
                .select()
                .single()

            if (errorInsertar) throw errorInsertar
            console.log('✅ Cita creada:', data)
            return data
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al crear cita'
            setError(mensaje)
            console.error('❌ Error al crear cita:', err)
            return null
        } finally {
            setCargando(false)
        }
    }, [])

    // Actualizar una cita
    const actualizarCita = useCallback(async (id: string, cambios: CitaUpdate): Promise<boolean> => {
        setCargando(true)
        setError(null)

        try {
            const { error: errorActualizar } = await supabase
                .from('citas')
                .update(cambios)
                .eq('id', id)

            if (errorActualizar) throw errorActualizar
            console.log('✅ Cita actualizada:', id)
            return true
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al actualizar cita'
            setError(mensaje)
            console.error('❌ Error al actualizar cita:', err)
            return false
        } finally {
            setCargando(false)
        }
    }, [])

    // Cancelar una cita
    const cancelarCita = useCallback(async (id: string): Promise<boolean> => {
        return actualizarCita(id, { estado: 'cancelada' as EstadoCita })
    }, [actualizarCita])

    // Cambiar estado de una cita
    const cambiarEstadoCita = useCallback(async (id: string, nuevoEstado: EstadoCita): Promise<boolean> => {
        return actualizarCita(id, { estado: nuevoEstado })
    }, [actualizarCita])

    // Completar cita con documento y descripción (Feature B)
    const completarCitaConDocumento = useCallback(async (
        id: string,
        descripcionSesion: string,
        documentoUrl: string
    ): Promise<boolean> => {
        setCargando(true)
        setError(null)

        try {
            const { error: errorActualizar } = await supabase
                .from('citas')
                .update({
                    estado: 'completada' as EstadoCita,
                    descripcion_sesion: descripcionSesion,
                    documento_url: documentoUrl,
                    fecha_documento: new Date().toISOString()
                })
                .eq('id', id)

            if (errorActualizar) throw errorActualizar
            console.log('✅ Cita completada con documento:', id)
            return true
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al completar cita'
            setError(mensaje)
            console.error('❌ Error al completar cita:', err)
            return false
        } finally {
            setCargando(false)
        }
    }, [])

    // Obtener citas en un rango de fechas (para verificar disponibilidad)
    const obtenerCitasEnRango = useCallback(async (
        rutAsistente: string,
        fechaInicio: string,
        fechaFin: string
    ): Promise<Cita[]> => {
        try {
            const { data, error: errorConsulta } = await supabase
                .from('citas')
                .select('*')
                .eq('rut_asistente', rutAsistente)
                .neq('estado', 'cancelada')
                .gte('inicio', fechaInicio)
                .lte('inicio', fechaFin)

            if (errorConsulta) throw errorConsulta
            return data || []
        } catch (err) {
            console.error('❌ Error al obtener citas en rango:', err)
            return []
        }
    }, [])

    return {
        cargando,
        loading: cargando, // Alias para compatibilidad
        error,
        // Nombres en español
        obtenerCitasPorEstudiante,
        obtenerCitasPorAsistente,
        obtenerCitasHoy,
        crearCita,
        actualizarCita,
        cancelarCita,
        cambiarEstadoCita,
        completarCitaConDocumento,
        obtenerCitasEnRango,
        // Alias en inglés para compatibilidad
        fetchCitasByEstudiante: obtenerCitasPorEstudiante,
        fetchCitasByAsistente: obtenerCitasPorAsistente,
        fetchCitasHoy: obtenerCitasHoy,
        fetchCitasEnRango: obtenerCitasEnRango
    }
}
