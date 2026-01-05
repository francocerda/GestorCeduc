export default  function LoginPage() {
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus_ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>
        </div>
    )
}