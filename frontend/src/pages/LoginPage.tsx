import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { validateRut, cleanRut } from "../lib/rutValidador"
import { useAuth } from "../contexts/AuthContext"


export default  function LoginPage() {
    const [rut, setRut] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const { signIn } = useAuth()
    const navigate = useNavigate()

    const RutLimpio = cleanRut(rut)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        
        if(!RutLimpio || !password) {
            setError("Por favor completa todos los campos")
            return
        }

        if (!validateRut(RutLimpio)) {
            setError("RUT inválido. Verifica el dígito verificador")
            return
        }

        if (password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres")
            return
        }

        setLoading(true)
        try {

            const email = `${RutLimpio}@ceduc.cl`
            
            await signIn(email, password)
            navigate('/estudiante')
            
        } catch (err: any) {
            setError(err.message || "Error al iniciar sesión")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
                <h1 className="text-3xl font-bold text-gray-800 text-center mb-6">
                    Iniciar Sesión
                </h1>

                <div className="mb-4">
                    <label className="block  text-gray-700 font-semibold mb-2">
                        RUT
                    </label>
                    <input 
                        type="text"
                        placeholder="12.345.678-9"
                        value={rut}
                        onChange={(e) => setRut(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus_ring-blue-500 focus:border-transparent"
                    />
                </div>
                <div className="mb-6">
                    <label className="block  text-gray-700 font-semibold mb-2">
                        Contraseña
                    </label>
                    <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus_ring-blue-500 focus:border-transparent"
                    />
                </div>
                <button 
                    onClick={handleSubmit}
                    disabled={loading}                    
                    className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                    {loading ? "Cargando...": "Iniciar Sesión" } 
                </button>
                {error && (
                    <div className="mt-4 bg-red-100 border border-red 400 text-red-700 rounded-lg text-sm">
                        ⚠️ {error}
                    </div>
                )}
                <div className="mt-4 text-center">
                    <a href="#" className="text-sm hover:text-blue-900 hover:underline">
                        ¿Olvidaste tu contraseña?
                    </a>
                </div>
            </div>
        </div>
    )
}