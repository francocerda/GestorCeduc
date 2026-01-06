import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import StudentPortal from './pages/StudentPortal'
import SocialWorkerPortal from './pages/SocialWorkerPortal'
import ProtectedRoute from './components/ui/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

function AppRoutes() {
  const { loading } = useAuth()  
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-xl font-semibold">Cargando...</p>
        </div>
      </div>
    )
  }
  
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace/>} />
        <Route path="/login" element={<LoginPage/>} />
        <Route 
          path="/estudiante" 
          element={
            <ProtectedRoute>
              <StudentPortal/>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/asistente" 
          element={
            <ProtectedRoute>
              <SocialWorkerPortal/>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="*" 
          element={
            <div className="min-h-screen flex items-center justify-center bg-red-50">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-red-600 mb-4">404</h1>
                <p className="text-gray-700">Página no encontrada</p>
              </div>
            </div>
          } 
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App