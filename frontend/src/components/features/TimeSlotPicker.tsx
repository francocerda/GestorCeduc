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
    hora: string
}

type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes'

const DIAS_SEMANA: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']

const HORARIO_DEFECTO: HorarioAtencion = {
    lunes: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:30', fin: '17:30' }],
    martes: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:30', fin: '17:30' }],
    miercoles: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:30', fin: '17:30' }],
    jueves: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:30', fin: '17:30' }],
    viernes: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:30', fin: '17:30' }]
}

export default function TimeSlotPicker({
    date,
    existingAppointments,
    onSelectSlot,
    selectedSlot,
    horarioAsistente,
    slotDuration = 30
}: TimeSlotPickerProps) {

    const getDiaSemana = (fecha: Date): DiaSemana | null => {
        const dia = fecha.getDay()
        if (dia === 0 || dia === 6) return null
        return DIAS_SEMANA[dia - 1]
    }

    const bloquesDelDia = useMemo((): BloqueHorario[] => {
        const dia = getDiaSemana(date)
        if (!dia) return []
        const horario = horarioAsistente || HORARIO_DEFECTO
        return horario[dia] || []
    }, [date, horarioAsistente])

    const timeSlots = useMemo((): TimeSlot[] => {
        const slots: TimeSlot[] = []
        if (bloquesDelDia.length === 0) return slots

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
                if (slotEnd > bloqueEnd) break

                const isConflict = existingAppointments.some(appt => {
                    if (appt.estado === 'cancelada') return false
                    const apptStart = new Date(appt.inicio)
                    const apptEnd = new Date(appt.fin)
                    return (
                        (currentSlot >= apptStart && currentSlot < apptEnd) ||
                        (slotEnd > apptStart && slotEnd <= apptEnd) ||
                        (currentSlot <= apptStart && slotEnd >= apptEnd)
                    )
                })

                const isPast = currentSlot < new Date()

                const hora = currentSlot.toLocaleTimeString('es-CL', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                })

                slots.push({
                    start: new Date(currentSlot),
                    end: new Date(slotEnd),
                    isAvailable: !isConflict && !isPast,
                    hora
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

    const { slotsMañana, slotsTarde } = useMemo(() => {
        const mañana: TimeSlot[] = []
        const tarde: TimeSlot[] = []

        timeSlots.forEach(slot => {
            const hora = slot.start.getHours()
            hora < 13 ? mañana.push(slot) : tarde.push(slot)
        })

        return { slotsMañana: mañana, slotsTarde: tarde }
    }, [timeSlots])

    const diaActual = getDiaSemana(date)

    if (!diaActual || bloquesDelDia.length === 0) {
        return (
            <div className="py-12 text-center">
                <p className="text-slate-500 text-sm">
                    {!diaActual 
                        ? 'No hay atención los fines de semana' 
                        : 'Sin horario disponible este día'
                    }
                </p>
                <p className="text-slate-400 text-xs mt-1">
                    Selecciona otro día
                </p>
            </div>
        )
    }

    const renderSlots = (slots: TimeSlot[], titulo: string) => {
        if (slots.length === 0) return null

        return (
            <div>
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    {titulo}
                </h4>
                <div className="grid grid-cols-4 gap-1.5">
                    {slots.map((slot, index) => (
                        <button
                            key={index}
                            onClick={() => slot.isAvailable && onSelectSlot(slot.start, slot.end)}
                            disabled={!slot.isAvailable}
                            className={`
                                px-2 py-2 text-sm font-medium rounded-md transition-all
                                ${slot.isAvailable
                                    ? isSlotSelected(slot)
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                }
                            `}
                        >
                            {slot.hora}
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {/* Slots por período */}
            <div className="space-y-4 max-h-64 overflow-y-auto">
                {renderSlots(slotsMañana, 'Mañana')}
                {renderSlots(slotsTarde, 'Tarde')}
            </div>

            {timeSlots.length === 0 && (
                <p className="text-center py-6 text-slate-400 text-sm">
                    No hay horarios configurados
                </p>
            )}

            {/* Hora seleccionada */}
            {selectedSlot && (
                <div className="pt-3 border-t border-slate-200 text-center">
                    <p className="text-sm text-slate-600">
                        <span className="font-medium">Hora seleccionada: </span>
                        {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
                    </p>
                </div>
            )}
        </div>
    )
}
