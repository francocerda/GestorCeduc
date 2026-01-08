import { format, parseISO } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { es } from 'date-fns/locale'

// Zona horaria de Chile
const ZONA_HORARIA_CHILE = 'America/Santiago'

/**
 * Convierte fecha UTC a hora de Chile
 */
export function aHoraChile(fechaUtc: string | Date): Date {
  const fecha = typeof fechaUtc === 'string' ? parseISO(fechaUtc) : fechaUtc
  return toZonedTime(fecha, ZONA_HORARIA_CHILE)
}

/**
 * Convierte hora de Chile a UTC
 */
export function aUtc(fechaChile: Date): Date {
  return fromZonedTime(fechaChile, ZONA_HORARIA_CHILE)
}

/**
 * Formatea una fecha usando la zona horaria de Chile
 */
export function formatearFechaChile(
  fecha: string | Date,
  formato: string = 'PPPp'
): string {
  const fechaChile = typeof fecha === 'string' ? aHoraChile(fecha) : fecha

  return format(fechaChile, formato, {
    locale: es,
  })
}

// Formatos predefinidos

/**
 * Formato corto: dd/MM/yyyy
 */
export function formatearFechaCorta(fecha: string | Date): string {
  return formatearFechaChile(fecha, 'dd/MM/yyyy')
}

/**
 * Formato con hora: dd/MM/yyyy HH:mm
 */
export function formatearFechaHora(fecha: string | Date): string {
  return formatearFechaChile(fecha, 'dd/MM/yyyy HH:mm')
}

/**
 * Formato largo: "lunes 8 de enero de 2026"
 */
export function formatearFechaLarga(fecha: string | Date): string {
  return formatearFechaChile(fecha, "EEEE d 'de' MMMM 'de' yyyy")
}

/**
 * Solo hora: HH:mm
 */
export function formatearSoloHora(fecha: string | Date): string {
  return formatearFechaChile(fecha, 'HH:mm')
}

/**
 * Verifica si la hora está dentro del horario laboral
 */
export function estaDentroDeHorarioLaboral(
  fecha: Date,
  horaInicio: number = 9,
  horaFin: number = 18
): boolean {
  const hora = fecha.getHours()
  return hora >= horaInicio && hora < horaFin
}

/**
 * Calcula la diferencia en minutos entre dos fechas
 */
export function obtenerDiferenciaMinutos(inicio: Date, fin: Date): number {
  const diferenciaMs = fin.getTime() - inicio.getTime()
  return Math.floor(diferenciaMs / (1000 * 60))
}

/**
 * Agrega minutos a una fecha
 */
export function agregarMinutos(fecha: Date, minutos: number): Date {
  const resultado = new Date(fecha)
  resultado.setMinutes(resultado.getMinutes() + minutos)
  return resultado
}

/**
 * Verifica si una fecha es hoy
 */
export function esHoy(fecha: string | Date): boolean {
  const fechaChile = typeof fecha === 'string' ? aHoraChile(fecha) : fecha
  const hoy = aHoraChile(new Date())

  return (
    fechaChile.getDate() === hoy.getDate() &&
    fechaChile.getMonth() === hoy.getMonth() &&
    fechaChile.getFullYear() === hoy.getFullYear()
  )
}

// Alias para compatibilidad con código existente
export const toChileTime = aHoraChile
export const toUTC = aUtc
export const formatChileDate = formatearFechaChile
export const formatDateShort = formatearFechaCorta
export const formatDateTime = formatearFechaHora
export const formatDateLong = formatearFechaLarga
export const formatTimeOnly = formatearSoloHora
export const isWithinBusinessHours = estaDentroDeHorarioLaboral
export const getMinutesDifference = obtenerDiferenciaMinutos
export const addMinutes = agregarMinutos
export const isToday = esHoy