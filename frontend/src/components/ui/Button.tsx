import type React from 'react'

interface PropiedadesBoton extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variante?: 'primary' | 'secondary' | 'danger' | 'ghost'
    tamano?: 'sm' | 'md' | 'lg'
    cargando?: boolean
    children: React.ReactNode
}

/**
 * Componente de botón reutilizable
 * Variantes: primary (azul), secondary (gris), danger (rojo), ghost (transparente)
 * Tamaños: sm (pequeño), md (mediano), lg (grande)
 */
export default function Button({
    variante = 'primary',
    tamano = 'md',
    cargando = false,
    disabled,
    children,
    className = '',
    // Alias para compatibilidad
    variant,
    size,
    loading,
    ...props
}: PropiedadesBoton & { variant?: PropiedadesBoton['variante']; size?: PropiedadesBoton['tamano']; loading?: boolean }) {
    // Usar alias si están definidos
    const varianteFinal = variant || variante
    const tamanoFinal = size || tamano
    const cargandoFinal = loading !== undefined ? loading : cargando

    const estilosBase = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

    const variantes = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:ring-blue-500',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400 focus:ring-gray-500',
        danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500',
        ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 focus:ring-gray-400'
    }

    const tamanos = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2.5 text-base',
        lg: 'px-6 py-3 text-lg'
    }

    return (
        <button
            className={`${estilosBase} ${variantes[varianteFinal]} ${tamanos[tamanoFinal]} ${className}`}
            disabled={disabled || cargandoFinal}
            {...props}
        >
            {cargandoFinal && (
                <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            )}
            {children}
        </button>
    )
}
