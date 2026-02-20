/**
 * Portal del estudiante.
 *
 * Muestra estado FUAS, historial de citas y acciones de gestión documental.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import { api } from '../lib/api'
import { formatDateTime, formatDateShort } from '../lib/dateUtils'
import { validarArchivoPDF } from '../lib/storageService'
import type { Estudiante, EstadoCita, AsistenteSocial, EstadoGestionFUAS } from '../types/database'
import Card from '../components/ui/Card'
import Badge, { getCitaStatusVariant, getCitaStatusLabel } from '../components/ui/Badge'
import Button from '../components/ui/Button'

interface GestionFUASData {
  rut: string
  estado: EstadoGestionFUAS | null
  documento_url: string | null
  comentario_rechazo: string | null
}

interface CitaConAsistente {
  id: string
  inicio: string
  fin: string
  estado: EstadoCita
  motivo: string
  observaciones: string | null
  asistentes_sociales: Pick<AsistenteSocial, 'nombre' | 'correo'> | null
}

// Configuración de estados FUAS
const ESTADO_CONFIG: Record<string, { titulo: string; descripcion: string; color: 'success' | 'warning' | 'danger' | 'info' }> = {
  no_postulo: {
    titulo: 'Debes subir comprobante FUAS',
    descripcion: 'Nuestros registros indican que no has completado tu postulación FUAS. Si ya postulaste, sube el comprobante.',
    color: 'warning'
  },
  debe_acreditar: {
    titulo: 'Debes acreditar tu situación',
    descripcion: 'Tienes pendiente una acreditación socioeconómica. Agenda una cita con un asistente social.',
    color: 'warning'
  },
  documento_pendiente: {
    titulo: 'Comprobante en revisión',
    descripcion: 'Tu comprobante está siendo revisado por un asistente social.',
    color: 'info'
  },
  documento_validado: {
    titulo: 'Comprobante validado',
    descripcion: 'Tu comprobante de postulación FUAS ha sido validado correctamente.',
    color: 'success'
  },
  documento_rechazado: {
    titulo: 'Comprobante rechazado',
    descripcion: 'Tu comprobante fue rechazado. Por favor sube uno nuevo.',
    color: 'danger'
  },
  acreditado: {
    titulo: 'Proceso completado',
    descripcion: 'Tu acreditación socioeconómica ha sido completada exitosamente.',
    color: 'success'
  }
}

const COLOR_CLASSES = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  danger: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800'
}

export default function StudentPortal() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [estudianteData, setEstudianteData] = useState<Estudiante | null>(null)
  const [citas, setCitas] = useState<CitaConAsistente[]>([])
  const [cargando, setCargando] = useState(true)
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)

  const [gestionFUASData, setGestionFUASData] = useState<GestionFUASData | null>(null)
  const [archivoComprobante, setArchivoComprobante] = useState<File | null>(null)
  const [subiendoComprobante, setSubiendoComprobante] = useState(false)

  useEffect(() => {
    const cargarDatos = async () => {
      if (!user) return

      try {
        const estudiante = await api.getInfoEstudiante(user.rut)
        if (estudiante) setEstudianteData(estudiante)

        const citasData = await api.getCitasEstudiante(user.rut)
        setCitas(citasData as CitaConAsistente[])

        const gestionFuas = await api.getGestionFuas(user.rut)
        if (gestionFuas) {
          setGestionFUASData(gestionFuas)
        }
      } catch (error) {
        // console.error('Error al cargar datos:', error)
      } finally {
        setCargando(false)
      }
    }

    cargarDatos()
  }, [user])

  const handleCancelarCita = async (citaId: string) => {
    if (!confirm('¿Estás seguro de que deseas cancelar esta cita?')) return

    setCancelandoId(citaId)
    try {
      await api.cancelarCita(citaId)
      toast.exito('Cita cancelada exitosamente')

      if (user) {
        const citasData = await api.getCitasEstudiante(user.rut)
        setCitas(citasData as CitaConAsistente[])
      }
    } catch (error) {
      // console.error('Error al cancelar cita:', error)
      toast.error('Error al cancelar la cita')
    } finally {
      setCancelandoId(null)
    }
  }

  const handleLogout = () => {
    signOut()
    navigate('/login')
  }

  const handleSubirComprobante = async () => {
    if (!archivoComprobante || !user) return

    setSubiendoComprobante(true)
    try {
      const resultado = await api.subirDocumentoEstudiante(archivoComprobante, user.rut)

      if (!resultado.exitoso) {
        toast.error('Error al subir documento')
        return
      }

      toast.exito('Comprobante subido correctamente')
      setArchivoComprobante(null)

      const gestionFuas = await api.getGestionFuas(user.rut)
      if (gestionFuas) setGestionFUASData(gestionFuas)
    } catch (error) {
      // console.error(error)
      toast.error('Error al subir comprobante')
    } finally {
      setSubiendoComprobante(false)
    }
  }

  const citasPendientes = citas.filter(c => c.estado === 'pendiente' || c.estado === 'confirmada')
  const citasHistorial = citas.filter(c => c.estado === 'completada' || c.estado === 'cancelada')

  if (cargando) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm font-medium">Cargando...</p>
        </div>
      </div>
    )
  }

  const estadoConfig = gestionFUASData?.estado ? ESTADO_CONFIG[gestionFUASData.estado] : null
  const mostrarAlerta = gestionFUASData?.estado && gestionFUASData.estado !== 'sin_pendientes'
  const puedeSubirDocumento = gestionFUASData?.estado === 'no_postulo' || gestionFUASData?.estado === 'documento_rechazado'

  return (
    <div className="min-h-screen bg-mesh">
      {/* Header */}
      <header className="glass-strong border-b border-slate-200/60 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900">GestorBecas</h1>
                <p className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase">Portal Estudiante</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-600 hidden sm:block">{user?.nombre}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Alerta de estado FUAS */}
        {mostrarAlerta && estadoConfig && (
          <div className={`border rounded-lg p-4 ${COLOR_CLASSES[estadoConfig.color]}`}>
            <h3 className="font-medium">{estadoConfig.titulo}</h3>
            <p className="text-sm mt-1 opacity-90">
              {gestionFUASData?.estado === 'documento_rechazado' && gestionFUASData.comentario_rechazo
                ? gestionFUASData.comentario_rechazo
                : estadoConfig.descripcion}
            </p>

            {/* Subir documento */}
            {puedeSubirDocumento && (
              <div className="mt-4 pt-3 border-t border-current/10">
                {archivoComprobante ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm truncate flex-1">{archivoComprobante.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => setArchivoComprobante(null)}>
                      Cancelar
                    </Button>
                    <Button size="sm" loading={subiendoComprobante} onClick={handleSubirComprobante}>
                      Subir
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      id="input-comprobante-fuas"
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const validacion = validarArchivoPDF(file)
                          if (validacion.valido) {
                            setArchivoComprobante(file)
                          } else {
                            toast.error(validacion.error || 'Archivo inválido')
                          }
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => document.getElementById('input-comprobante-fuas')?.click()}
                    >
                      Seleccionar PDF
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Información Personal */}
          <div className="lg:col-span-1">
            <Card>
              <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">Mi Información</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-400">RUT</p>
                  <p className="font-mono text-slate-900">{user?.rut}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Nombre</p>
                  <p className="text-slate-900">{user?.nombre}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Correo</p>
                  <p className="text-slate-900 text-sm">{user?.correo}</p>
                </div>
                {estudianteData?.carrera && (
                  <div>
                    <p className="text-xs text-slate-400">Carrera</p>
                    <p className="text-slate-900">{estudianteData.carrera}</p>
                  </div>
                )}
                {estudianteData?.sede && (
                  <div>
                    <p className="text-xs text-slate-400">Sede</p>
                    <p className="text-slate-900">{estudianteData.sede}</p>
                  </div>
                )}
                {gestionFUASData?.estado && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-400">Estado FUAS</p>
                    <Badge variant={estadoConfig?.color || 'default'}>
                      {gestionFUASData.estado.replace(/_/g, ' ')}
                    </Badge>
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
                <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Próximas Citas</h2>
                <Button size="sm" onClick={() => navigate('/agendar')}>
                  Nueva Cita
                </Button>
              </div>

              {citasPendientes.length > 0 ? (
                <div className="space-y-3">
                  {citasPendientes.map(cita => (
                    <div
                      key={cita.id}
                      className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {formatDateTime(cita.inicio)}
                        </p>
                        <p className="text-sm text-slate-500">
                          {cita.asistentes_sociales?.nombre || 'Asistente'}
                        </p>
                        {cita.motivo && (
                          <p className="text-xs text-slate-400 mt-1">{cita.motivo}</p>
                        )}
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
                <div className="text-center py-8 text-slate-400">
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
                <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">Historial</h2>
                <div className="space-y-2">
                  {citasHistorial.slice(0, 5).map(cita => (
                    <div
                      key={cita.id}
                      className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm text-slate-900">{formatDateShort(cita.inicio)}</p>
                        <p className="text-xs text-slate-400">{cita.motivo}</p>
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
