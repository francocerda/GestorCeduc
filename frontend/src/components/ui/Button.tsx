import type React from 'react'

interface PropiedadesBoton extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variante?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
    tamano?: 'sm' | 'md' | 'lg'
    cargando?: boolean
    children: React.ReactNode
}

export default function Button({
    variante = 'primary',
    tamano = 'md',
    cargando = false,
    disabled,
    children,
    className = '',
    variant,
    size,
    loading,
    ...props
}: PropiedadesBoton & { variant?: PropiedadesBoton['variante']; size?: PropiedadesBoton['tamano']; loading?: boolean }) {
    const varianteFinal = variant || variante
    const tamanoFinal = size || tamano
    const cargandoFinal = loading !== undefined ? loading : cargando

    const estilosBase = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none active:scale-[0.97]'

    const variantes = {
        primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 shadow-sm hover:shadow-md',
        secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 focus:ring-slate-400 shadow-sm',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm hover:shadow-md',
        ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800 focus:ring-slate-400',
        success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 shadow-sm hover:shadow-md'
    }

    const tamanos = {
        sm: 'px-3 py-1.5 text-xs gap-1.5',
        md: 'px-4 py-2.5 text-sm gap-2',
        lg: 'px-6 py-3 text-base gap-2'
    }

    return (
        <button
            className={`${estilosBase} ${variantes[varianteFinal]} ${tamanos[tamanoFinal]} ${className}`}
            disabled={disabled || cargandoFinal}
            {...props}
        >
            {cargandoFinal && (
                <svg
                    className="animate-spin -ml-0.5 h-4 w-4"
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
