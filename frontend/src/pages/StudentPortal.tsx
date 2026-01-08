import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCitas } from '../hooks/useCitas'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'
import { formatDateTime, formatDateShort } from '../lib/dateUtils'
import type { Estudiante, EstadoCita, AsistenteSocial } from '../types/database'
import Card from '../components/ui/Card'
import Badge, { getCitaStatusVariant, getCitaStatusLabel } from '../components/ui/Badge'
import Button from '../components/ui/Button'

// Interfaz para citas con datos del asistente
interface CitaConAsistente {
  id: string
  inicio: string
  fin: string
  estado: EstadoCita
  motivo: string
  observaciones: string | null
  asistentes_sociales: Pick<AsistenteSocial, 'nombre' | 'correo'> | null
}

export default function StudentPortal() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { fetchCitasByEstudiante, cancelarCita } = useCitas()

  const [estudianteData, setEstudianteData] = useState<Estudiante | null>(null)
  const [citas, setCitas] = useState<CitaConAsistente[]>([])
  const [cargando, setCargando] = useState(true)
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)

  // Cargar datos del estudiante y citas
  useEffect(() => {
    const cargarDatos = async () => {
      if (!user) return

      try {
        // Obtener datos del estudiante
        const { data: estudiante } = await supabase
          .from('estudiantes')
          .select('*')
          .eq('rut', user.rut)
          .single()

        if (estudiante) setEstudianteData(estudiante)

        // Obtener citas
        const citasData = await fetchCitasByEstudiante(user.rut)
        setCitas(citasData as CitaConAsistente[])
      } catch (error) {
        console.error('Error al cargar datos:', error)
      } finally {
        setCargando(false)
      }
    }

    cargarDatos()
  }, [user, fetchCitasByEstudiante])

  // Cancelar cita
  const handleCancelarCita = async (citaId: string) => {
    if (!confirm('¿Estás seguro de que deseas cancelar esta cita?')) return

    setCancelandoId(citaId)
    try {
      const exito = await cancelarCita(citaId)
      if (exito && user) {
        toast.exito('Cita cancelada exitosamente')
        const citasData = await fetchCitasByEstudiante(user.rut)
        setCitas(citasData as CitaConAsistente[])
      } else {
        toast.error('Error al cancelar la cita')
      }
    } catch (error) {
      console.error('Error al cancelar cita:', error)
      toast.error('Error al cancelar la cita')
    } finally {
      setCancelandoId(null)
    }
  }

  // Cerrar sesión
  const handleLogout = () => {
    signOut()
    navigate('/login')
  }

  // Filtrar citas
  const citasPendientes = citas.filter(c => c.estado === 'pendiente' || c.estado === 'confirmada')
  const citasHistorial = citas.filter(c => c.estado === 'completada' || c.estado === 'cancelada')

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header minimalista */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">GestorBecas</h1>
              <p className="text-sm text-gray-500">Portal Estudiante</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user?.nombre}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-5xl mx-auto px-4 py-8">
        {/* Alerta FUAS */}
        {estudianteData?.debe_postular && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-amber-600 text-lg">!</span>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-amber-900">Acción requerida</h3>
                <p className="text-sm text-amber-800 mt-1">
                  Debes agendar una cita para completar tu postulación FUAS ({estudianteData.tipo_beneficio}).
                </p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate('/agendar')}
                >
                  Agendar Cita
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Información Personal */}
          <div className="lg:col-span-1">
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Mi Información</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">RUT</p>
                  <p className="font-mono text-gray-900">{user?.rut}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Nombre</p>
                  <p className="text-gray-900">{user?.nombre}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Correo</p>
                  <p className="text-gray-900 text-sm">{user?.correo}</p>
                </div>
                {estudianteData?.carrera && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Carrera</p>
                    <p className="text-gray-900">{estudianteData.carrera}</p>
                  </div>
                )}
                {estudianteData?.sede && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Sede</p>
                    <p className="text-gray-900">{estudianteData.sede}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Citas */}
          <div className="lg:col-span-2 space-y-6">
            {/* Próximas Citas */}
            <Card>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Próximas Citas</h2>
                <Button size="sm" onClick={() => navigate('/agendar')}>
                  + Nueva Cita
                </Button>
              </div>

              {citasPendientes.length > 0 ? (
                <div className="space-y-3">
                  {citasPendientes.map(cita => (
                    <div
                      key={cita.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {formatDateTime(cita.inicio)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {cita.asistentes_sociales?.nombre || 'Asistente'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{cita.motivo}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getCitaStatusVariant(cita.estado)}>
                          {getCitaStatusLabel(cita.estado)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelarCita(cita.id)}
                          loading={cancelandoId === cita.id}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No tienes citas programadas</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate('/agendar')}
                  >
                    Agendar ahora
                  </Button>
                </div>
              )}
            </Card>

            {/* Historial */}
            {citasHistorial.length > 0 && (
              <Card>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Historial</h2>
                <div className="space-y-2">
                  {citasHistorial.slice(0, 5).map(cita => (
                    <div
                      key={cita.id}
                      className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm text-gray-900">{formatDateShort(cita.inicio)}</p>
                        <p className="text-xs text-gray-500">{cita.motivo}</p>
                      </div>
                      <Badge variant={getCitaStatusVariant(cita.estado)}>
                        {getCitaStatusLabel(cita.estado)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
