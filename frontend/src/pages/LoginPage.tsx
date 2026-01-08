import { useState } from "react"
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

    // Redirección por rol
    if (user) {
        const targetRoute = isAsistenteSocial ? '/asistente' : '/estudiante'
        navigate(targetRoute, { replace: true })
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
        <div className="min-h-screen bg-gray-50 flex">
            {/* Panel izquierdo - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 p-12 flex-col justify-between">
                <div>
                    <h1 className="text-white text-2xl font-semibold">GestorBecas</h1>
                    <p className="text-blue-200 text-sm">CEDUC UCN</p>
                </div>

                <div className="text-white">
                    <h2 className="text-4xl font-light leading-tight mb-4">
                        Sistema de Gestión<br />de Becas y Beneficios
                    </h2>
                    <p className="text-blue-200 text-lg">
                        Plataforma para postulaciones FUAS y agendamiento de citas.
                    </p>
                </div>

                <div className="text-blue-300 text-sm">
                    © 2026 CEDUC UCN
                </div>
            </div>

            {/* Panel derecho - Formulario */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-sm">
                    {/* Header móvil */}
                    <div className="lg:hidden mb-8 text-center">
                        <h1 className="text-xl font-semibold text-gray-900">GestorBecas</h1>
                        <p className="text-gray-500 text-sm">CEDUC UCN</p>
                    </div>

                    {/* Título */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-900">Iniciar Sesión</h2>
                        <p className="text-gray-500 mt-1">Ingresa tus credenciales institucionales</p>
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
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
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
                            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            ¿Olvidaste tu contraseña?
                        </button>
                    </div>

                    {/* Footer móvil */}
                    <div className="mt-12 lg:hidden text-center text-xs text-gray-400">
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