/**
 * Campo de entrada reutilizable con soporte de label, icono y error.
 */
import type React from 'react'

/**
 * Input reutilizable con label, icono y manejo de error.
 *
 * Diseñado para formularios consistentes con el sistema visual del proyecto.
 */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    icon?: React.ReactNode
}

export default function Input({
    label,
    error,
    icon,
    className = '',
    id,
    ...props
}: InputProps) {
    // Si no se entrega `id`, lo genera desde el label para asociar accesibilidad.
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
        <div className="w-full">
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                    {label}
                </label>
            )}
            <div className="relative">
                {icon && (
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        {icon}
                    </div>
                )}
                <input
                    id={inputId}
                    className={`
            w-full px-4 py-3 border rounded-xl bg-white
            transition-all duration-200 text-slate-900 placeholder:text-slate-400
            focus:outline-none focus:ring-2 focus:ring-offset-0
            ${icon ? 'pl-10' : ''}
            ${error
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'
                        }
            ${className}
          `}
                    {...props}
                />
            </div>
            {error && (
                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                </p>
            )}
        </div>
    )
}
