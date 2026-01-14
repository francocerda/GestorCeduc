import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCitas } from '../hooks/useCitas'
import { useAsistentesSociales } from '../hooks/useStudents'
import { api } from '../lib/api'
import { formatDateLong, toUTC } from '../lib/dateUtils'
import type { AsistenteSocial, Cita, CitaInsert } from '../types/database'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import TimeSlotPicker from '../components/features/TimeSlotPicker'

export default function BookAppointmentPage() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { crearCita, fetchCitasEnRango, loading: citasLoading } = useCitas()
    const { fetchAsistentes, loading: asistentesLoading } = useAsistentesSociales()

    const [asistentes, setAsistentes] = useState<AsistenteSocial[]>([])
    const [selectedAsistente, setSelectedAsistente] = useState<AsistenteSocial | null>(null)
    const [selectedDate, setSelectedDate] = useState<string>('')
    const [existingCitas, setExistingCitas] = useState<Cita[]>([])
    const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null)
    const [motivo, setMotivo] = useState('Consulta FUAS')
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [hasAppointmentThisWeek, setHasAppointmentThisWeek] = useState(false)

    // Load social workers
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

    // Load existing appointments when date/asistente changes
    useEffect(() => {
        const cargarCitas = async () => {
            if (!selectedAsistente || !selectedDate) return

            // Fix: Parse date correctly to avoid timezone offset
            const [year, month, day] = selectedDate.split('-').map(Number)
            const dateObj = new Date(year, month - 1, day)

            const startOfDay = new Date(dateObj)
            startOfDay.setHours(0, 0, 0, 0)

            const endOfDay = new Date(dateObj)
            endOfDay.setHours(23, 59, 59, 999)

            const citas = await fetchCitasEnRango(selectedAsistente.rut, startOfDay.toISOString(), endOfDay.toISOString())
            setExistingCitas(citas)
            setSelectedSlot(null) // Reset selection when date changes
        }
        cargarCitas()
    }, [selectedAsistente, selectedDate, fetchCitasEnRango])

    // Check if student already has an appointment this week
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
                console.error('Error verificando cita semanal:', error)
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

    // Get min date (tomorrow) and max date (30 days from now)
    const today = new Date()
    const minDate = new Date(today.setDate(today.getDate() + 1)).toISOString().split('T')[0]
    const maxDate = new Date(today.setDate(today.getDate() + 30)).toISOString().split('T')[0]

    const isWeekend = (dateStr: string): boolean => {
        // Fix: Parse date correctly to avoid timezone offset
        const [year, month, day] = dateStr.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        const dayOfWeek = date.getDay()
        return dayOfWeek === 0 || dayOfWeek === 6
    }

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
                <Card className="text-center max-w-md">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Cita Agendada!</h2>
                    <p className="text-gray-600 mb-4">
                        Tu cita ha sido agendada exitosamente. Recibirás un correo de confirmación.
                    </p>
                    <p className="text-sm text-gray-500">Redirigiendo...</p>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/estudiante')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Agendar Cita</h1>
                            <p className="text-sm text-gray-500">Paso {step} de 3</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Progress bar */}
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center gap-2">
                    {[1, 2, 3].map((s) => (
                        <div
                            key={s}
                            className={`h-2 flex-1 rounded-full transition-colors ${s <= step ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Content */}
            <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
                {/* Step 1: Select Social Worker */}
                {step === 1 && (
                    <Card title="Selecciona un Asistente Social" subtitle="Elige con quién deseas agendar tu cita">
                        {asistentesLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : asistentes.length > 0 ? (
                            <div className="space-y-3">
                                {asistentes.map((asistente) => (
                                    <button
                                        key={asistente.rut}
                                        onClick={() => handleSelectAsistente(asistente)}
                                        className={`w-full p-4 rounded-lg border-2 text-left transition-all hover:border-blue-400 ${selectedAsistente?.rut === asistente.rut
                                            ? 'border-blue-600 bg-blue-50'
                                            : 'border-gray-200 bg-white hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{asistente.nombre}</p>
                                                <p className="text-sm text-gray-500">{asistente.sede || 'Sede principal'}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-gray-600">No hay asistentes sociales disponibles en este momento.</p>
                            </div>
                        )}
                    </Card>
                )}

                {/* Step 2: Select Date and Time */}
                {step === 2 && selectedAsistente && (
                    <div className="space-y-6">
                        <Card title="Selecciona Fecha y Hora">
                            <div className="space-y-6">
                                {/* Date picker */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Fecha de la cita
                                    </label>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => handleSelectDate(e.target.value)}
                                        min={minDate}
                                        max={maxDate}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {selectedDate && isWeekend(selectedDate) && (
                                        <p className="mt-2 text-sm text-amber-600">
                                            ⚠️ Has seleccionado un fin de semana. No hay atención esos días.
                                        </p>
                                    )}
                                    {selectedDate && hasAppointmentThisWeek && (
                                        <div className="mt-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                            ❌ Ya tienes una cita agendada para esta semana. Solo puedes tener 1 cita por semana.
                                        </div>
                                    )}
                                </div>

                                {/* Time slots */}
                                {selectedDate && !isWeekend(selectedDate) && !hasAppointmentThisWeek && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Hora disponible - {formatDateLong(parseDateString(selectedDate))}
                                        </label>
                                        <TimeSlotPicker
                                            date={parseDateString(selectedDate)}
                                            existingAppointments={existingCitas}
                                            onSelectSlot={handleSelectSlot}
                                            selectedSlot={selectedSlot}
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

                {/* Step 3: Confirm */}
                {step === 3 && selectedAsistente && selectedSlot && (
                    <div className="space-y-6">
                        <Card title="Confirmar Cita">
                            <div className="space-y-4">
                                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Asistente Social:</span>
                                        <span className="font-medium">{selectedAsistente.nombre}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Fecha:</span>
                                        <span className="font-medium">{formatDateLong(selectedSlot.start)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Hora:</span>
                                        <span className="font-medium">
                                            {selectedSlot.start.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} -
                                            {selectedSlot.end.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Motivo de la cita
                                    </label>
                                    <select
                                        value={motivo}
                                        onChange={(e) => setMotivo(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="Consulta FUAS">Consulta FUAS</option>
                                        <option value="Postulación FUAS">Postulación FUAS</option>
                                        <option value="Renovación FUAS">Renovación FUAS</option>
                                        <option value="Documentación">Documentación</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
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
