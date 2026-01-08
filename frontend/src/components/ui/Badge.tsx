import type { EstadoCita } from '../../types/database'

interface PropiedadesEtiqueta {
    variante?: 'default' | 'success' | 'warning' | 'danger' | 'info'
    children: React.ReactNode
    className?: string
}

// Estilos para cada variante
const estilosVariante = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800'
}

/**
 * Componente de etiqueta/badge para mostrar estados
 * Variantes de color: default (gris), success (verde), warning (amarillo), danger (rojo), info (azul)
 */
export default function Badge({
    variante = 'default',
    children,
    className = '',
    // Alias para compatibilidad
    variant
}: PropiedadesEtiqueta & { variant?: PropiedadesEtiqueta['variante'] }) {
    const varianteFinal = variant || variante

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estilosVariante[varianteFinal]} ${className}`}>
            {children}
        </span>
    )
}

/**
 * Obtiene la variante de badge según el estado de la cita
 */
export function obtenerVarianteEstadoCita(estado: EstadoCita): PropiedadesEtiqueta['variante'] {
    const mapaEstados: Record<EstadoCita, PropiedadesEtiqueta['variante']> = {
        pendiente: 'warning',
        confirmada: 'info',
        completada: 'success',
        cancelada: 'danger'
    }
    return mapaEstados[estado]
}

/**
 * Obtiene la etiqueta en español para el estado de la cita
 */
export function obtenerEtiquetaEstadoCita(estado: EstadoCita): string {
    const mapaEtiquetas: Record<EstadoCita, string> = {
        pendiente: 'Pendiente',
        confirmada: 'Confirmada',
        completada: 'Completada',
        cancelada: 'Cancelada'
    }
    return mapaEtiquetas[estado]
}

// Alias para compatibilidad con código existente
export const getCitaStatusVariant = obtenerVarianteEstadoCita
export const getCitaStatusLabel = obtenerEtiquetaEstadoCita
