import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Estudiante, EstudianteUpdate, AsistenteSocial } from '../types/database'

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
            let consulta = supabase
                .from('estudiantes')
                .select('*')

            // Filtrar por término de búsqueda (RUT o nombre)
            if (filtros.busqueda) {
                consulta = consulta.or(`rut.ilike.%${filtros.busqueda}%,nombre.ilike.%${filtros.busqueda}%`)
            }

            // Filtrar por debe_postular
            if (filtros.debePostular !== undefined) {
                consulta = consulta.eq('debe_postular', filtros.debePostular)
            }

            // Filtrar por estado FUAS
            if (filtros.estadoFuas) {
                consulta = consulta.eq('estado_fuas', filtros.estadoFuas)
            }

            // Paginación
            if (filtros.limite) {
                consulta = consulta.limit(filtros.limite)
            }
            if (filtros.desplazamiento) {
                consulta = consulta.range(filtros.desplazamiento, filtros.desplazamiento + (filtros.limite || 10) - 1)
            }

            // Ordenar por nombre
            consulta = consulta.order('nombre', { ascending: true })

            const { data, error: errorConsulta } = await consulta

            if (errorConsulta) throw errorConsulta
            return data || []
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
            const { data, error: errorConsulta } = await supabase
                .from('estudiantes')
                .select('*')
                .eq('rut', rut)
                .single()

            if (errorConsulta && errorConsulta.code !== 'PGRST116') throw errorConsulta
            return data
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : 'Error al cargar estudiante'
            setError(mensaje)
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
            const { error: errorActualizar } = await supabase
                .from('estudiantes')
                .update(cambios)
                .eq('rut', rut)

            if (errorActualizar) throw errorActualizar
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
            const { count, error: errorConteo } = await supabase
                .from('estudiantes')
                .select('*', { count: 'exact', head: true })
                .eq('debe_postular', true)

            if (errorConteo) throw errorConteo
            return count || 0
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
            const { data, error: errorConsulta } = await supabase
                .from('asistentes_sociales')
                .select('*')
                .eq('activo', true)
                .order('nombre', { ascending: true })

            if (errorConsulta) throw errorConsulta
            return data || []
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
