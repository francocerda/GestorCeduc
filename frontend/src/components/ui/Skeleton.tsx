/**
 * Componente Skeleton para estados de carga
 * Muestra un placeholder animado mientras se cargan datos
 */

interface SkeletonProps {
    className?: string
    variante?: 'text' | 'circular' | 'rectangular'
    ancho?: string
    alto?: string
}

export default function Skeleton({
    className = '',
    variante = 'text',
    ancho,
    alto
}: SkeletonProps) {
    const estilosBase = 'animate-pulse bg-gray-200'

    const estilosPorVariante = {
        text: 'rounded h-4',
        circular: 'rounded-full',
        rectangular: 'rounded-lg'
    }

    const estilosDimension = {
        width: ancho || (variante === 'circular' ? '40px' : '100%'),
        height: alto || (variante === 'circular' ? '40px' : variante === 'text' ? '16px' : '100px')
    }

    return (
        <div
            className={`${estilosBase} ${estilosPorVariante[variante]} ${className}`}
            style={estilosDimension}
            aria-hidden="true"
        />
    )
}

// Predefinidos útiles

export function SkeletonTexto({ lineas = 3 }: { lineas?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: lineas }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={i === lineas - 1 ? 'w-3/4' : 'w-full'}
                />
            ))}
        </div>
    )
}

export function SkeletonCard() {
    return (
        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
            <div className="flex items-center gap-4">
                <Skeleton variante="circular" ancho="48px" alto="48px" />
                <div className="flex-1 space-y-2">
                    <Skeleton ancho="60%" />
                    <Skeleton ancho="40%" />
                </div>
            </div>
            <SkeletonTexto lineas={2} />
        </div>
    )
}

export function SkeletonTabla({ filas = 5, columnas = 4 }: { filas?: number; columnas?: number }) {
    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex gap-4 pb-3 border-b border-gray-100">
                {Array.from({ length: columnas }).map((_, i) => (
                    <Skeleton key={i} ancho={`${100 / columnas}%`} alto="12px" />
                ))}
            </div>
            {/* Filas */}
            {Array.from({ length: filas }).map((_, fila) => (
                <div key={fila} className="flex gap-4 py-3 border-b border-gray-50">
                    {Array.from({ length: columnas }).map((_, col) => (
                        <Skeleton key={col} ancho={`${100 / columnas}%`} alto="16px" />
                    ))}
                </div>
            ))}
        </div>
    )
}
