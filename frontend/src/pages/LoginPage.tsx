import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { ceducApi } from "../lib/ceducApi"
import Modal from "../components/ui/Modal"
import Button from "../components/ui/Button"
import Input from "../components/ui/Input"

export default function LoginPage() {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    // Estado modal recuperación
    const [showRecoveryModal, setShowRecoveryModal] = useState(false)
    const [recoveryRut, setRecoveryRut] = useState("")
    const [recoveryLoading, setRecoveryLoading] = useState(false)
    const [recoveryMessage, setRecoveryMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const { signIn, user, isAsistenteSocial } = useAuth()
    const navigate = useNavigate()

    // Redirección por rol (en useEffect para evitar setState durante render)
    useEffect(() => {
        if (user) {
            const targetRoute = isAsistenteSocial ? '/asistente' : '/estudiante'
            navigate(targetRoute, { replace: true })
        }
    }, [user, isAsistenteSocial, navigate])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (!username || !password) {
            setError("Completa todos los campos")
            return
        }

        if (!/^\d+$/.test(username)) {
            setError("El RUT debe contener solo números")
            return
        }

        if (username.length < 7 || username.length > 9) {
            setError("El RUT debe tener entre 7 y 9 dígitos")
            return
        }

        setLoading(true)
        try {
            await signIn(username, password)
        } catch (err: any) {
            setError(err.message || "Error al iniciar sesión")
        } finally {
            setLoading(false)
        }
    }

    const handlePasswordRecovery = async () => {
        if (!recoveryRut || !/^\d{7,9}$/.test(recoveryRut)) {
            setRecoveryMessage({ type: 'error', text: 'Ingresa un RUT válido (7-9 dígitos)' })
            return
        }

        setRecoveryLoading(true)
        setRecoveryMessage(null)

        try {
            await ceducApi.recuperarContrasena(recoveryRut)
            setRecoveryMessage({ type: 'success', text: 'Instrucciones enviadas a tu correo' })
            setTimeout(() => {
                setShowRecoveryModal(false)
                setRecoveryMessage(null)
                setRecoveryRut("")
            }, 2500)
        } catch (err: any) {
            setRecoveryMessage({ type: 'error', text: err.message || 'Error al procesar' })
        } finally {
            setRecoveryLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-mesh flex">
            {/* Panel izquierdo - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 flex-col justify-between relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 -left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
                    <div className="absolute bottom-20 right-10 w-96 h-96 bg-violet-300 rounded-full blur-3xl" />
                    <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-indigo-300 rounded-full blur-3xl" />
                </div>
                
                <div className="relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-white text-xl font-bold">GestorBecas</h1>
                            <p className="text-indigo-200 text-xs font-medium tracking-wide">CEDUC UCN</p>
                        </div>
                    </div>
                </div>

                <div className="text-white relative">
                    <h2 className="text-4xl font-bold leading-tight mb-4 tracking-tight">
                        Sistema de Gestión<br />
                        <span className="text-indigo-200 font-light">de Becas y Beneficios</span>
                    </h2>
                    <p className="text-indigo-200/90 text-lg max-w-md leading-relaxed">
                        Plataforma centralizada para postulaciones FUAS, seguimiento de becas y agendamiento de citas.
                    </p>
                    
                    {/* Feature pills */}
                    <div className="flex flex-wrap gap-2 mt-8">
                        <span className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-medium text-indigo-100 border border-white/10">
                            📋 Postulación FUAS
                        </span>
                        <span className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-medium text-indigo-100 border border-white/10">
                            🎓 Becas y Gratuidad
                        </span>
                        <span className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-medium text-indigo-100 border border-white/10">
                            📅 Agendamiento de Citas
                        </span>
                    </div>
                </div>

                <div className="text-indigo-300/60 text-sm relative">
                    © 2026 CEDUC UCN — Todos los derechos reservados
                </div>
            </div>

            {/* Panel derecho - Formulario */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-sm animate-fade-in-up">
                    {/* Header móvil */}
                    <div className="lg:hidden mb-10 text-center">
                        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900">GestorBecas</h1>
                        <p className="text-slate-400 text-sm mt-0.5">CEDUC UCN</p>
                    </div>

                    {/* Título */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Iniciar Sesión</h2>
                        <p className="text-slate-400 mt-1.5 text-sm">Ingresa tus credenciales institucionales</p>
                    </div>

                    {/* Formulario */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Input
                            label="Username (RUT sin DV)"
                            type="text"
                            placeholder="12345678"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                        />

                        <Input
                            label="Contraseña"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                        />

                        {/* Error */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            loading={loading}
                            className="w-full"
                            size="lg"
                        >
                            Ingresar
                        </Button>
                    </form>

                    {/* Link recuperación */}
                    <div className="mt-6 text-center">
                        <button
                            type="button"
                            onClick={() => setShowRecoveryModal(true)}
                            className="text-sm text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                            ¿Olvidaste tu contraseña?
                        </button>
                    </div>

                    {/* Footer móvil */}
                    <div className="mt-16 lg:hidden text-center text-xs text-slate-300">
                        © 2026 CEDUC UCN
                    </div>
                </div>
            </div>

            {/* Modal Recuperación */}
            <Modal
                isOpen={showRecoveryModal}
                onClose={() => {
                    setShowRecoveryModal(false)
                    setRecoveryMessage(null)
                    setRecoveryRut("")
                }}
                title="Recuperar Contraseña"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 text-sm">
                        Ingresa tu RUT y te enviaremos las instrucciones por correo.
                    </p>

                    <Input
                        label="RUT (sin dígito verificador)"
                        type="text"
                        placeholder="12345678"
                        value={recoveryRut}
                        onChange={(e) => setRecoveryRut(e.target.value)}
                    />

                    {recoveryMessage && (
                        <div className={`p-3 rounded-lg text-sm ${recoveryMessage.type === 'success'
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                            {recoveryMessage.text}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="secondary"
                            onClick={() => setShowRecoveryModal(false)}
                            className="flex-1"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handlePasswordRecovery}
                            loading={recoveryLoading}
                            className="flex-1"
                        >
                            Enviar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}