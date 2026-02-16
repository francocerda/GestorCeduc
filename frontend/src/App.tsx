import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import LoginPage from './pages/LoginPage'
import StudentPortal from './pages/StudentPortal'
import SocialWorkerPortal from './pages/SocialWorkerPortal'
import BookAppointmentPage from './pages/BookAppointmentPage'
import ProtectedRoute from './components/ui/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  )
}

function AppRoutes() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-mesh"
        role="status"
        aria-label="Cargando aplicación"
      >
        <div className="text-center animate-fade-in-up">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-200">
            <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-slate-600 text-base font-semibold">Cargando...</p>
          <p className="text-slate-400 text-sm mt-1">GestorBecas CEDUC UCN</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/estudiante"
          element={
            <ProtectedRoute>
              <StudentPortal />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agendar"
          element={
            <ProtectedRoute>
              <BookAppointmentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/asistente"
          element={
            <ProtectedRoute>
              <SocialWorkerPortal />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <main id="main-content" className="min-h-screen flex items-center justify-center bg-mesh">
              <div className="text-center animate-fade-in-up">
                <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <span className="text-3xl font-bold text-red-500">404</span>
                </div>
                <h1 className="text-xl font-bold text-slate-800 mb-2">Página no encontrada</h1>
                <p className="text-slate-400 mb-6">La página que buscas no existe</p>
                <a
                  href="/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Volver al inicio
                </a>
              </div>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App