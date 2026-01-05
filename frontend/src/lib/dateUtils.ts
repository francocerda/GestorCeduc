import { format, parseISO } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { es } from 'date-fns/locale'

const CHILE_TIMEZONE = 'America/Santiago'

//UTC -> Tiempo en Chile
export function toChileTime(utcDate: string | Date): Date {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate
  return toZonedTime(date, CHILE_TIMEZONE)
}

//Tiempo en Chile -> UTC
export function toUTC(chileDate: Date): Date {
  return fromZonedTime(chileDate, CHILE_TIMEZONE)
}

//Formatear fecha Chile
export function formatChileDate(
  date: string | Date,
  formatStr: string = 'PPPp'
): string {
  const chileDate = typeof date === 'string' ? toChileTime(date) : date
  
  return format(chileDate, formatStr, { 
    locale: es,
  })
}

//Formatos predefinidos
export function formatDateShort(date: string | Date): string {
  return formatChileDate(date, 'dd/MM/yyyy')
}

export function formatDateTime(date: string | Date): string {
  return formatChileDate(date, 'dd/MM/yyyy HH:mm')
}

export function formatDateLong(date: string | Date): string {
  return formatChileDate(date, "EEEE d 'de' MMMM 'de' yyyy")
}

export function formatTimeOnly(date: string | Date): string {
  return formatChileDate(date, 'HH:mm')
}

//Validar se encuentra dentro de Horario
export function isWithinBusinessHours(
  date: Date,
  startHour: number = 9,
  endHour: number = 16
): boolean {
  const hour = date.getHours()
  return hour >= startHour && hour < endHour
}

export function getMinutesDifference(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime()
  return Math.floor(diffMs / (1000 * 60))
}

//Agregar Minutos
export function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date)
  result.setMinutes(result.getMinutes() + minutes)
  return result
}

//Verificar Presente
export function isToday(date: string | Date): boolean {
  const chileDate = typeof date === 'string' ? toChileTime(date) : date
  const today = toChileTime(new Date())
  
  return (
    chileDate.getDate() === today.getDate() &&
    chileDate.getMonth() === today.getMonth() &&
    chileDate.getFullYear() === today.getFullYear()
  )
}