/**
 * Guardia de ruta para validar sesión y rol.
 *
 * Redirige automáticamente al portal correspondiente según tipo de usuario.
 */
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import type React from "react"

interface ProtectedRouteProps {
    children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user, loading, isAsistenteSocial } = useAuth()
    const location = useLocation()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600">
                </div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    // Redirigir al portal correcto según el rol
    const isAsistenteRoute = location.pathname.startsWith('/asistente')
    const isEstudianteRoute = location.pathname.startsWith('/estudiante') || location.pathname.startsWith('/agendar')

    // Si es asistente pero está en ruta de estudiante, redirigir a /asistente
    if (isAsistenteSocial && isEstudianteRoute) {
        return <Navigate to="/asistente" replace />
    }

    // Si es estudiante pero está en ruta de asistente, redirigir a /estudiante
    if (!isAsistenteSocial && isAsistenteRoute) {
        return <Navigate to="/estudiante" replace />
    }

    return <>{children}</>
}