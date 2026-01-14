import { useState, useCallback } from 'react'
import { api } from '../lib/api'
import type { Estudiante, AsistenteSocial } from '../types/database'

// Tipo auxiliar para actualizaciones
type EstudianteUpdate = Partial<Estudiante>

interface FiltrosEstudiantes {
    busqueda?: string
    debePostular?: boolean
    estadoFuas?: string
    limite?: number
    desplazamiento?: number
}

/**
 * Hook para manejar operaciones de estudiantes
 * Incluye búsqueda, filtros y actualización
 */
export function useStudents() {
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Obtener estudiantes con filtros opcionales
    const obtenerEstudiantes = useCallback(async (filtros: FiltrosEstudiantes = {}): Promise<Estudiante[]> => {
        setCargando(true)
        setError(null)

        try {
            const data = await api.getEstudiantes({
                busqueda: filtros.busqueda,
                debe_postular: filtros.debePostular,
                estado_fuas: filtros.estadoFuas,
                limite: filtros.limite,
                desplazamiento: filtros.desplazamiento
            })
            return data
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al cargar estudiantes'
            setError(mensaje)
            console.error('❌ Error al obtener estudiantes:', err)
            return []
        } finally {
            setCargando(false)
        }
    }, [])

    // Obtener un estudiante por RUT
    const obtenerEstudiantePorRut = useCallback(async (rut: string): Promise<Estudiante | null> => {
        setCargando(true)
        setError(null)

        try {
            const data = await api.getInfoEstudiante(rut)
            return data
        } catch (err) {
            console.error('❌ Error al obtener estudiante:', err)
            return null
        } finally {
            setCargando(false)
        }
    }, [])

    // Actualizar datos de un estudiante
    const actualizarEstudiante = useCallback(async (rut: string, cambios: EstudianteUpdate): Promise<boolean> => {
        setCargando(true)
        setError(null)

        try {
            const exito = await api.updateEstudiante(rut, cambios)
            if (!exito) throw new Error('Error al actualizar')
            console.log('✅ Estudiante actualizado:', rut)
            return true
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al actualizar estudiante'
            setError(mensaje)
            console.error('❌ Error al actualizar estudiante:', err)
            return false
        } finally {
            setCargando(false)
        }
    }, [])

    // Contar estudiantes que deben postular
    const contarEstudiantesPendientes = useCallback(async (): Promise<number> => {
        try {
            return await api.countEstudiantesPendientes()
        } catch (err) {
            console.error('❌ Error al contar estudiantes:', err)
            return 0
        }
    }, [])

    return {
        cargando,
        loading: cargando, // Alias para compatibilidad
        error,
        // Nombres en español
        obtenerEstudiantes,
        obtenerEstudiantePorRut,
        actualizarEstudiante,
        contarEstudiantesPendientes,
        // Alias en inglés para compatibilidad
        fetchEstudiantes: obtenerEstudiantes,
        fetchEstudianteByRut: obtenerEstudiantePorRut
    }
}

/**
 * Hook para obtener asistentes sociales activos
 */
export function useAsistentesSociales() {
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Obtener asistentes activos
    const obtenerAsistentes = useCallback(async (): Promise<AsistenteSocial[]> => {
        setCargando(true)
        setError(null)

        try {
            const data = await api.getAsistentesSociales()
            return data
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al cargar asistentes'
            setError(mensaje)
            console.error('❌ Error al obtener asistentes:', err)
            return []
        } finally {
            setCargando(false)
        }
    }, [])

    return {
        cargando,
        loading: cargando, // Alias para compatibilidad
        error,
        obtenerAsistentes,
        fetchAsistentes: obtenerAsistentes // Alias para compatibilidad
    }
}
