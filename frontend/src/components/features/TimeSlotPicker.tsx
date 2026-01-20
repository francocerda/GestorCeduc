import { useMemo } from 'react'
import { addMinutes } from '../../lib/dateUtils'
import type { Cita, HorarioAtencion, BloqueHorario } from '../../types/database'

interface TimeSlotPickerProps {
    date: Date
    existingAppointments: Cita[]
    onSelectSlot: (start: Date, end: Date) => void
    selectedSlot: { start: Date; end: Date } | null
    horarioAsistente?: HorarioAtencion | null
    slotDuration?: number
}

interface TimeSlot {
    start: Date
    end: Date
    isAvailable: boolean
}

type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes'

const DIAS_SEMANA: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']

// Horario por defecto si no hay horario configurado
const HORARIO_DEFECTO: HorarioAtencion = {
    lunes: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
    martes: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
    miercoles: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
    jueves: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
    viernes: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '17:00' }]
}

export default function TimeSlotPicker({
    date,
    existingAppointments,
    onSelectSlot,
    selectedSlot,
    horarioAsistente,
    slotDuration = 15
}: TimeSlotPickerProps) {

    // Obtener el día de la semana
    const getDiaSemana = (fecha: Date): DiaSemana | null => {
        const dia = fecha.getDay() // 0=domingo, 1=lunes, ..., 6=sábado
        if (dia === 0 || dia === 6) return null // Fin de semana
        return DIAS_SEMANA[dia - 1]
    }

    // Obtener bloques de horario para el día seleccionado
    const bloquesDelDia = useMemo((): BloqueHorario[] => {
        const dia = getDiaSemana(date)
        if (!dia) return []
        
        const horario = horarioAsistente || HORARIO_DEFECTO
        return horario[dia] || []
    }, [date, horarioAsistente])

    // Generate time slots for the day based on assistant's schedule
    const timeSlots = useMemo((): TimeSlot[] => {
        const slots: TimeSlot[] = []
        
        // Si no hay bloques para este día, no hay slots
        if (bloquesDelDia.length === 0) return slots

        // Generar slots para cada bloque de horario
        bloquesDelDia.forEach(bloque => {
            const [inicioH, inicioM] = bloque.inicio.split(':').map(Number)
            const [finH, finM] = bloque.fin.split(':').map(Number)

            const bloqueStart = new Date(date)
            bloqueStart.setHours(inicioH, inicioM, 0, 0)

            const bloqueEnd = new Date(date)
            bloqueEnd.setHours(finH, finM, 0, 0)

            let currentSlot = new Date(bloqueStart)

            while (currentSlot < bloqueEnd) {
                const slotEnd = addMinutes(currentSlot, slotDuration)
                
                // No exceder el fin del bloque
                if (slotEnd > bloqueEnd) break

                // Check if slot conflicts with existing appointments
                const isConflict = existingAppointments.some(appt => {
                    const apptStart = new Date(appt.inicio)
                    const apptEnd = new Date(appt.fin)

                    // Check for overlap
                    return (
                        (currentSlot >= apptStart && currentSlot < apptEnd) ||
                        (slotEnd > apptStart && slotEnd <= apptEnd) ||
                        (currentSlot <= apptStart && slotEnd >= apptEnd)
                    )
                })

                // Check if slot is in the past
                const isPast = currentSlot < new Date()

                slots.push({
                    start: new Date(currentSlot),
                    end: new Date(slotEnd),
                    isAvailable: !isConflict && !isPast
                })

                currentSlot = slotEnd
            }
        })

        return slots
    }, [date, existingAppointments, bloquesDelDia, slotDuration])

    const formatTime = (date: Date): string => {
        return date.toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })
    }

    const isSlotSelected = (slot: TimeSlot): boolean => {
        if (!selectedSlot) return false
        return slot.start.getTime() === selectedSlot.start.getTime()
    }

    // Group slots by hour for better organization
    const slotsByHour = useMemo(() => {
        const grouped: { [hour: number]: TimeSlot[] } = {}

        timeSlots.forEach(slot => {
            const hour = slot.start.getHours()
            if (!grouped[hour]) {
                grouped[hour] = []
            }
            grouped[hour].push(slot)
        })

        return grouped
    }, [timeSlots])

    const availableCount = timeSlots.filter(s => s.isAvailable).length
    const diaActual = getDiaSemana(date)

    // Si es fin de semana o no hay horario para este día
    if (!diaActual || bloquesDelDia.length === 0) {
        return (
            <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-600 font-medium">
                    {!diaActual 
                        ? 'No hay atención los fines de semana' 
                        : 'El asistente no tiene horario disponible este día'
                    }
                </p>
                <p className="text-sm text-gray-500 mt-1">
                    Selecciona otro día para ver horarios disponibles
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Info de horario del día */}
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-800">
                    <span className="font-medium capitalize">{diaActual}:</span>{' '}
                    {bloquesDelDia.map((b, i) => (
                        <span key={i}>
                            {b.inicio} - {b.fin}
                            {i < bloquesDelDia.length - 1 && ', '}
                        </span>
                    ))}
                </div>
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    {availableCount} disponible{availableCount !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
                    <span className="text-gray-600">Disponible</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-200 border border-gray-300 rounded"></div>
                    <span className="text-gray-600">No disponible</span>
                </div>
            </div>

            {/* Time slots grid */}
            <div className="max-h-64 overflow-y-auto border rounded-lg p-3">
                {Object.entries(slotsByHour).length > 0 ? (
                    Object.entries(slotsByHour).map(([hour, slots]) => (
                        <div key={hour} className="mb-3 last:mb-0">
                            <div className="text-xs text-gray-500 font-medium mb-1">
                                {hour}:00 hrs
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                                {slots.map((slot, index) => (
                                    <button
                                        key={index}
                                        onClick={() => slot.isAvailable && onSelectSlot(slot.start, slot.end)}
                                        disabled={!slot.isAvailable}
                                        className={`
                                            px-2 py-1.5 text-xs rounded transition-all
                                            ${slot.isAvailable
                                                ? isSlotSelected(slot)
                                                    ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-1'
                                                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            }
                                        `}
                                    >
                                        {formatTime(slot.start)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-center py-4 text-gray-500">
                        No hay horarios disponibles
                    </p>
                )}
            </div>

            {/* Selected slot info */}
            {selectedSlot && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <p className="text-sm text-blue-800">
                        <span className="font-medium">Hora seleccionada: </span>
                        {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
                    </p>
                </div>
            )}
        </div>
    )
}
