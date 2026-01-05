import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import StudentPortal from './pages/StudentPortal'
import SocialWorkerPortal from './pages/SocialWorkerPortal'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace/>} />
        <Route path="/login" element={<LoginPage/>} />
        <Route path="/estudiante" element={<StudentPortal/>} />
        <Route path="/asistente" element={<SocialWorkerPortal/>} />
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

