/**
 * Hook de dominio para gestión de citas.
 *
 * Centraliza operaciones de lectura, creación y actualización de citas
 * junto con manejo de estado de carga y error.
 */
import { useState, useCallback } from 'react'
import { api } from '../lib/api'
import type { Cita, EstadoCita, AsistenteSocial } from '../types/database'

// Tipos parciales simulados ya que la DB no exporta Insert/Update directos a veces
type CitaInsert = Partial<Cita>
type CitaUpdate = Partial<Cita>

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
            const data = await api.getCitasEstudiante(rut)
            return data as CitaConAsistente[]
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al cargar citas'
            setError(mensaje)
            // console.error('[useCitas] Error al obtener citas:', err)
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
            const data = await api.getCitasAsistente(rut)
            return data as CitaConEstudiante[]
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al cargar citas'
            setError(mensaje)
            // console.error('[useCitas] Error al obtener citas:', err)
            return []
        } finally {
            setCargando(false)
        }
    }, [])

    // Obtener citas de hoy para un asistente
    const obtenerCitasHoy = useCallback(async (rutAsistente: string): Promise<CitaConEstudiante[]> => {
        setCargando(true)
        setError(null)

        try {
            const data = await api.getCitasHoyAsistente(rutAsistente)
            return data as CitaConEstudiante[]
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
            const data = await api.crearCita(datosCita)
            // console.log('[useCitas] Cita creada:', data)
            return data
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al crear cita'
            setError(mensaje)
            // console.error('[useCitas] Error al crear cita:', err)
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
            const exito = await api.updateCita(id, cambios)
            if (!exito) throw new Error('Error al actualizar')
            // console.log('[useCitas] Cita actualizada:', id)
            return true
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al actualizar cita'
            setError(mensaje)
            // console.error('[useCitas] Error al actualizar cita:', err)
            return false
        } finally {
            setCargando(false)
        }
    }, [])

    // Cancelar una cita (con notificación por email al estudiante)
    const cancelarCita = useCallback(async (id: string, motivo?: string): Promise<boolean> => {
        setCargando(true)
        try {
            const exito = await api.cancelarCita(id, motivo)
            if (!exito) throw new Error('Error al cancelar')
            return true
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al cancelar cita'
            setError(mensaje)
            return false
        } finally {
            setCargando(false)
        }
    }, [])

    // Cambiar estado de una cita
    // Si el estado es 'cancelada', usa el endpoint específico que envía email
    const cambiarEstadoCita = useCallback(async (id: string, nuevoEstado: EstadoCita, motivo?: string): Promise<boolean> => {
        if (nuevoEstado === 'cancelada') {
            return cancelarCita(id, motivo)
        }
        return actualizarCita(id, { estado: nuevoEstado })
    }, [actualizarCita, cancelarCita])

    // Completar cita con documento y descripción (Feature B)
    const completarCitaConDocumento = useCallback(async (
        id: string,
        descripcionSesion: string,
        documentoUrl: string
    ): Promise<boolean> => {
        setCargando(true)
        setError(null)

        try {
            const exito = await api.updateCita(id, {
                estado: 'completada' as EstadoCita,
                descripcion_sesion: descripcionSesion, // Validar que api.updateCita acepte esto, pero server.js es generico
                documento_url: documentoUrl,
                fecha_documento: new Date().toISOString()
            } as any) // Cast as any si la interfaz Cita no tiene estos campos opcionales aun

            if (!exito) throw new Error('Error al actualizar')
            // console.log('[useCitas] Cita completada con documento:', id)
            return true
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al completar cita'
            setError(mensaje)
            // console.error('[useCitas] Error al completar cita:', err)
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
            const data = await api.getCitasRango(rutAsistente, fechaInicio, fechaFin)
            return data
        } catch (err) {
            // console.error('[useCitas] Error al obtener citas en rango:', err)
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
