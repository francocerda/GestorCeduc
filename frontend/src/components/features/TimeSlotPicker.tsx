import { useMemo } from 'react'
import { addMinutes } from '../../lib/dateUtils'
import type { Cita } from '../../types/database'

interface TimeSlotPickerProps {
    date: Date
    existingAppointments: Cita[]
    onSelectSlot: (start: Date, end: Date) => void
    selectedSlot: { start: Date; end: Date } | null
    startHour?: number
    endHour?: number
    slotDuration?: number
}

interface TimeSlot {
    start: Date
    end: Date
    isAvailable: boolean
}

export default function TimeSlotPicker({
    date,
    existingAppointments,
    onSelectSlot,
    selectedSlot,
    startHour = 9,
    endHour = 18,
    slotDuration = 15
}: TimeSlotPickerProps) {

    // Generate time slots for the day
    const timeSlots = useMemo((): TimeSlot[] => {
        const slots: TimeSlot[] = []
        const dayStart = new Date(date)
        dayStart.setHours(startHour, 0, 0, 0)

        const dayEnd = new Date(date)
        dayEnd.setHours(endHour, 0, 0, 0)

        let currentSlot = dayStart

        while (currentSlot < dayEnd) {
            const slotEnd = addMinutes(currentSlot, slotDuration)

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

        return slots
    }, [date, existingAppointments, startHour, endHour, slotDuration])

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

    return (
        <div className="space-y-4">
            {/* Legend */}
            <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
                    <span className="text-gray-600">Disponible ({availableCount})</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-200 border border-gray-300 rounded"></div>
                    <span className="text-gray-600">No disponible</span>
                </div>
            </div>

            {/* Time slots grid */}
            <div className="max-h-64 overflow-y-auto border rounded-lg p-3">
                {Object.entries(slotsByHour).map(([hour, slots]) => (
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
                ))}
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
