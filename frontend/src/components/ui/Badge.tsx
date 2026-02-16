import type { EstadoCita } from '../../types/database'

interface PropiedadesEtiqueta {
    variante?: 'default' | 'success' | 'warning' | 'danger' | 'info'
    children: React.ReactNode
    className?: string
}

const estilosVariante = {
    default: 'bg-slate-100 text-slate-600 ring-slate-200',
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200',
    danger: 'bg-red-50 text-red-700 ring-red-200',
    info: 'bg-blue-50 text-blue-700 ring-blue-200'
}

const dotVariante = {
    default: 'bg-slate-400',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500'
}

export default function Badge({
    variante = 'default',
    children,
    className = '',
    variant
}: PropiedadesEtiqueta & { variant?: PropiedadesEtiqueta['variante'] }) {
    const varianteFinal = variant || variante

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 ring-inset ${estilosVariante[varianteFinal]} ${className}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotVariante[varianteFinal]}`} />
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
