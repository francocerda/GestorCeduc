import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { createPortal } from 'react-dom'

// Tipos
type TipoToast = 'success' | 'error' | 'warning' | 'info'

interface Toast {
    id: string
    mensaje: string
    tipo: TipoToast
    duracion?: number
}

interface ToastContextType {
    mostrar: (mensaje: string, tipo?: TipoToast, duracion?: number) => void
    exito: (mensaje: string) => void
    error: (mensaje: string) => void
    advertencia: (mensaje: string) => void
    info: (mensaje: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

// Estilos por tipo
const estilosPorTipo: Record<TipoToast, { bg: string; icon: string; border: string }> = {
    success: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: '✓'
    },
    error: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: '✕'
    },
    warning: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: '⚠'
    },
    info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        icon: 'ℹ'
    }
}

const iconosPorTipo: Record<TipoToast, string> = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-amber-600',
    info: 'text-blue-600'
}

// Componente Toast individual
function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const [saliendo, setSaliendo] = useState(false)
    const estilos = estilosPorTipo[toast.tipo]

    useEffect(() => {
        const timer = setTimeout(() => {
            setSaliendo(true)
            setTimeout(onClose, 300)
        }, toast.duracion || 4000)

        return () => clearTimeout(timer)
    }, [toast.duracion, onClose])

    return (
        <div
            role="alert"
            aria-live="polite"
            className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg
        ${estilos.bg} ${estilos.border}
        ${saliendo ? 'animate-slide-out' : 'animate-slide-in'}
      `}
        >
            <span className={`text-lg ${iconosPorTipo[toast.tipo]}`}>
                {estilos.icon}
            </span>
            <p className="text-gray-800 text-sm font-medium flex-1">
                {toast.mensaje}
            </p>
            <button
                onClick={() => {
                    setSaliendo(true)
                    setTimeout(onClose, 300)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Cerrar notificación"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    )
}

// Contenedor de Toasts
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
    if (toasts.length === 0) return null

    return createPortal(
        <div
            className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full"
            aria-label="Notificaciones"
        >
            {toasts.map(toast => (
                <ToastItem
                    key={toast.id}
                    toast={toast}
                    onClose={() => removeToast(toast.id)}
                />
            ))}
        </div>,
        document.body
    )
}

// Provider
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const mostrar = useCallback((mensaje: string, tipo: TipoToast = 'info', duracion = 4000) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        setToasts(prev => [...prev, { id, mensaje, tipo, duracion }])
    }, [])

    const exito = useCallback((mensaje: string) => mostrar(mensaje, 'success'), [mostrar])
    const error = useCallback((mensaje: string) => mostrar(mensaje, 'error'), [mostrar])
    const advertencia = useCallback((mensaje: string) => mostrar(mensaje, 'warning'), [mostrar])
    const info = useCallback((mensaje: string) => mostrar(mensaje, 'info'), [mostrar])

    return (
        <ToastContext.Provider value={{ mostrar, exito, error, advertencia, info }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    )
}

// Hook para usar toasts
export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast debe usarse dentro de un ToastProvider')
    }
    return context
}

// Alias en inglés para compatibilidad (usar useToast() en su lugar)
export const toast = {
    success: (_msg: string) => console.warn('Usa useToast() hook en su lugar'),
    error: (_msg: string) => console.warn('Usa useToast() hook en su lugar'),
    warning: (_msg: string) => console.warn('Usa useToast() hook en su lugar'),
    info: (_msg: string) => console.warn('Usa useToast() hook en su lugar')
}
