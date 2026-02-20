/**
 * Página de agendamiento de citas para estudiantes.
 *
 * Flujo principal:
 * 1) selección de asistente,
 * 2) selección de fecha/hora,
 * 3) confirmación y creación de cita.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCitas } from '../hooks/useCitas'
import { useAsistentesSociales } from '../hooks/useStudents'
import { api } from '../lib/api'
import { formatDateLong, toUTC } from '../lib/dateUtils'
import type { AsistenteSocial, Cita, CitaInsert, HorarioAtencion } from '../types/database'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import TimeSlotPicker from '../components/features/TimeSlotPicker'

export default function BookAppointmentPage() {
    // Contexto de usuario autenticado y navegación.
    const { user } = useAuth()
    const navigate = useNavigate()

    // Hooks de dominio para citas y asistentes.
    const { crearCita, fetchCitasEnRango, loading: citasLoading } = useCitas()
    const { fetchAsistentes, loading: asistentesLoading } = useAsistentesSociales()

    // Estado de datos de negocio.
    const [asistentes, setAsistentes] = useState<AsistenteSocial[]>([])
    const [selectedAsistente, setSelectedAsistente] = useState<AsistenteSocial | null>(null)
    const [horarioAsistente, setHorarioAsistente] = useState<HorarioAtencion | null>(null)
    const [selectedDate, setSelectedDate] = useState<string>('')
    const [existingCitas, setExistingCitas] = useState<Cita[]>([])
    const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null)
    const [motivo, setMotivo] = useState('Consulta FUAS')
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [hasAppointmentThisWeek, setHasAppointmentThisWeek] = useState(false)

    // Carga asistentes disponibles al iniciar la pantalla.
    useEffect(() => {
        const cargarAsistentes = async () => {
            const data = await fetchAsistentes()
            setAsistentes(data)
            if (data.length === 1) {
                setSelectedAsistente(data[0])
            }
        }
        cargarAsistentes()
    }, [fetchAsistentes])

    // Carga horario del asistente seleccionado para filtrar slots disponibles.
    useEffect(() => {
        const cargarHorario = async () => {
            if (!selectedAsistente) {
                setHorarioAsistente(null)
                return
            }
            
            try {
                const data = await api.getHorarioAsistente(selectedAsistente.rut)
                setHorarioAsistente(data.horario_atencion)
            } catch (error) {
                // console.error('Error cargando horario:', error)
                setHorarioAsistente(null)
            }
        }
        cargarHorario()
    }, [selectedAsistente])

    // Carga citas del día para bloquear horarios ya ocupados.
    useEffect(() => {
        const cargarCitas = async () => {
            if (!selectedAsistente || !selectedDate) return

            // Parse manual para evitar desplazamiento por zona horaria.
            const [year, month, day] = selectedDate.split('-').map(Number)
            const dateObj = new Date(year, month - 1, day)

            const startOfDay = new Date(dateObj)
            startOfDay.setHours(0, 0, 0, 0)

            const endOfDay = new Date(dateObj)
            endOfDay.setHours(23, 59, 59, 999)

            const citas = await fetchCitasEnRango(selectedAsistente.rut, startOfDay.toISOString(), endOfDay.toISOString())
            setExistingCitas(citas)
            setSelectedSlot(null) // Reinicia selección si cambia fecha/asistente.
        }
        cargarCitas()
    }, [selectedAsistente, selectedDate, fetchCitasEnRango])

    // Regla de negocio: estudiante puede tener máximo 1 cita por semana.
    useEffect(() => {
        const verificarCitaSemana = async () => {
            if (!user || !selectedDate) {
                setHasAppointmentThisWeek(false)
                return
            }

            try {
                const resultado = await api.verificarCitaSemana(user.rut, selectedDate)
                setHasAppointmentThisWeek(resultado.tieneCita)
            } catch (error) {
                // console.error('Error verificando cita semanal:', error)
                setHasAppointmentThisWeek(false)
            }
        }
        verificarCitaSemana()
    }, [user, selectedDate])

    const handleSelectAsistente = (asistente: AsistenteSocial) => {
        setSelectedAsistente(asistente)
        setStep(2)
    }

    const handleSelectDate = (date: string) => {
        setSelectedDate(date)
        setSelectedSlot(null)
    }

    /**
     * Parsea una fecha en formato YYYY-MM-DD correctamente sin desfase de timezone
     * Evita que new Date("2026-01-20") se interprete como UTC y muestre día anterior
     */
    const parseDateString = (dateStr: string): Date => {
        const [year, month, day] = dateStr.split('-').map(Number)
        return new Date(year, month - 1, day)
    }

    const handleSelectSlot = (start: Date, end: Date) => {
        setSelectedSlot({ start, end })
        setStep(3)
    }

    const handleConfirm = async () => {
        if (!user || !selectedAsistente || !selectedSlot) return

        setError(null)

        try {
            // Persistir siempre en UTC para consistencia con backend/BD.
            const citaData: CitaInsert = {
                rut_estudiante: user.rut,
                rut_asistente: selectedAsistente.rut,
                inicio: toUTC(selectedSlot.start).toISOString(),
                fin: toUTC(selectedSlot.end).toISOString(),
                estado: 'pendiente',
                motivo: motivo,
                observaciones: null
            }

            const result = await crearCita(citaData)

            if (result) {
                setSuccess(true)
                setTimeout(() => {
                    navigate('/estudiante')
                }, 2000)
            } else {
                setError('No se pudo crear la cita. Intenta nuevamente.')
            }
        } catch (err) {
            setError('Error al agendar la cita. Intenta nuevamente.')
        }
    }

    // Ventana de reserva: desde mañana hasta 30 días en adelante.
    const today = new Date()
    const minDate = new Date(today.setDate(today.getDate() + 1)).toISOString().split('T')[0]
    const maxDate = new Date(today.setDate(today.getDate() + 30)).toISOString().split('T')[0]

    const isWeekend = (dateStr: string): boolean => {
        // Parse manual para evitar desfase de día por timezone.
        const [year, month, day] = dateStr.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        const dayOfWeek = date.getDay()
        return dayOfWeek === 0 || dayOfWeek === 6
    }

    if (success) {
        return (
            <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
                <Card className="text-center max-w-md">
                    <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Cita Agendada!</h2>
                    <p className="text-slate-500 mb-4">
                        Tu cita ha sido agendada exitosamente. Recibirás un correo de confirmación.
                    </p>
                    <p className="text-sm text-slate-400">Redirigiendo...</p>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-mesh">
            {/* Encabezado */}
            <header className="glass-strong border-b border-slate-200/60 sticky top-0 z-40">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/estudiante')}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-all duration-200"
                        >
                            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900">Agendar Cita</h1>
                            <p className="text-xs text-slate-400 font-medium">Paso {step} de 3</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Barra de progreso */}
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center gap-2">
                    {[1, 2, 3].map((s) => (
                        <div
                            key={s}
                            className={`h-2 flex-1 rounded-full transition-all duration-500 ${s <= step ? 'bg-indigo-600' : 'bg-slate-200'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Contenido principal del flujo */}
            <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
                {/* Paso 1: Selección de asistente */}
                {step === 1 && (
                    <Card title="Selecciona un Asistente Social" subtitle="Elige con quién deseas agendar tu cita">
                        {asistentesLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : asistentes.length > 0 ? (
                            <div className="space-y-3">
                                {asistentes.map((asistente) => (
                                    <button
                                        key={asistente.rut}
                                        onClick={() => handleSelectAsistente(asistente)}
                                        className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 hover:border-indigo-400 ${selectedAsistente?.rut === asistente.rut
                                            ? 'border-indigo-600 bg-indigo-50'
                                            : 'border-slate-200 bg-white hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-sm">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900">{asistente.nombre}</p>
                                                <p className="text-sm text-slate-400">{asistente.sede || 'Sede principal'}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-slate-500">No hay asistentes sociales disponibles en este momento.</p>
                            </div>
                        )}
                    </Card>
                )}

                {/* Paso 2: Selección de fecha y hora */}
                {step === 2 && selectedAsistente && (
                    <div className="space-y-6">
                        <Card title="Selecciona Fecha y Hora">
                            <div className="space-y-6">
                                {/* Selector de fecha */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Fecha de la cita
                                    </label>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => handleSelectDate(e.target.value)}
                                        min={minDate}
                                        max={maxDate}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                                    />
                                    {selectedDate && isWeekend(selectedDate) && (
                                        <p className="mt-2 text-sm text-amber-600">
                                            Has seleccionado un fin de semana. No hay atención esos días.
                                        </p>
                                    )}
                                    {selectedDate && hasAppointmentThisWeek && (
                                        <div className="mt-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                                            Ya tienes una cita agendada para esta semana. Solo puedes tener 1 cita por semana.
                                        </div>
                                    )}
                                </div>

                                {/* Horarios disponibles */}
                                {selectedDate && !isWeekend(selectedDate) && !hasAppointmentThisWeek && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Hora disponible - {formatDateLong(parseDateString(selectedDate))}
                                        </label>
                                        <TimeSlotPicker
                                            date={parseDateString(selectedDate)}
                                            existingAppointments={existingCitas}
                                            onSelectSlot={handleSelectSlot}
                                            selectedSlot={selectedSlot}
                                            horarioAsistente={horarioAsistente}
                                        />
                                    </div>
                                )}
                            </div>
                        </Card>

                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">
                                Volver
                            </Button>
                            <Button
                                onClick={() => selectedSlot && setStep(3)}
                                disabled={!selectedSlot}
                                className="flex-1"
                            >
                                Continuar
                            </Button>
                        </div>
                    </div>
                )}

                {/* Paso 3: Confirmación */}
                {step === 3 && selectedAsistente && selectedSlot && (
                    <div className="space-y-6">
                        <Card title="Confirmar Cita">
                            <div className="space-y-4">
                                <div className="bg-slate-50 rounded-xl p-5 space-y-3 border border-slate-100">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Asistente Social:</span>
                                        <span className="font-medium">{selectedAsistente.nombre}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Fecha:</span>
                                        <span className="font-medium">{formatDateLong(selectedSlot.start)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Hora:</span>
                                        <span className="font-medium">
                                            {selectedSlot.start.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} -
                                            {selectedSlot.end.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Motivo de la cita
                                    </label>
                                    <select
                                        value={motivo}
                                        onChange={(e) => setMotivo(e.target.value)}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                                    >
                                        <option value="Consulta FUAS">Consulta FUAS</option>
                                        <option value="Postulación FUAS">Postulación FUAS</option>
                                        <option value="Renovación FUAS">Renovación FUAS</option>
                                        <option value="Documentación">Documentación</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                                        {error}
                                    </div>
                                )}
                            </div>
                        </Card>

                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setStep(2)} className="flex-1">
                                Volver
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                loading={citasLoading}
                                className="flex-1"
                            >
                                Confirmar Cita
                            </Button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
