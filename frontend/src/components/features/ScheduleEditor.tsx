import { useState, useEffect } from 'react'
import Button from '../ui/Button'
import type { HorarioAtencion } from '../../types/database'

interface ScheduleEditorProps {
    horarioInicial: HorarioAtencion | null
    onSave: (horario: HorarioAtencion) => Promise<void>
    loading?: boolean
}

type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes'

const DIAS: { key: DiaSemana; label: string }[] = [
    { key: 'lunes', label: 'Lunes' },
    { key: 'martes', label: 'Martes' },
    { key: 'miercoles', label: 'Miércoles' },
    { key: 'jueves', label: 'Jueves' },
    { key: 'viernes', label: 'Viernes' }
]

const HORAS_OPCIONES = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'
]

const HORARIO_DEFECTO: HorarioAtencion = {
    lunes: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
    martes: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
    miercoles: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
    jueves: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
    viernes: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '17:00' }]
}

export default function ScheduleEditor({ horarioInicial, onSave, loading }: ScheduleEditorProps) {
    const [horario, setHorario] = useState<HorarioAtencion>(horarioInicial || HORARIO_DEFECTO)
    const [diasActivos, setDiasActivos] = useState<Record<DiaSemana, boolean>>({
        lunes: true,
        martes: true,
        miercoles: true,
        jueves: true,
        viernes: true
    })
    const [guardando, setGuardando] = useState(false)
    const [cambiosPendientes, setCambiosPendientes] = useState(false)

    useEffect(() => {
        if (horarioInicial) {
            setHorario(horarioInicial)
            // Detectar qué días están activos (tienen bloques)
            const activos: Record<DiaSemana, boolean> = {
                lunes: Boolean(horarioInicial.lunes?.length),
                martes: Boolean(horarioInicial.martes?.length),
                miercoles: Boolean(horarioInicial.miercoles?.length),
                jueves: Boolean(horarioInicial.jueves?.length),
                viernes: Boolean(horarioInicial.viernes?.length)
            }
            setDiasActivos(activos)
        }
    }, [horarioInicial])

    const toggleDia = (dia: DiaSemana) => {
        setDiasActivos(prev => {
            const nuevo = { ...prev, [dia]: !prev[dia] }
            // Si se activa, agregar bloque por defecto
            if (!prev[dia]) {
                setHorario(h => ({
                    ...h,
                    [dia]: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }]
                }))
            } else {
                // Si se desactiva, limpiar bloques
                setHorario(h => ({ ...h, [dia]: [] }))
            }
            return nuevo
        })
        setCambiosPendientes(true)
    }

    const actualizarBloque = (dia: DiaSemana, index: number, campo: 'inicio' | 'fin', valor: string) => {
        setHorario(prev => {
            const bloques = [...(prev[dia] || [])]
            bloques[index] = { ...bloques[index], [campo]: valor }
            return { ...prev, [dia]: bloques }
        })
        setCambiosPendientes(true)
    }

    const agregarBloque = (dia: DiaSemana) => {
        setHorario(prev => {
            const bloques = [...(prev[dia] || [])]
            // Intentar agregar después del último bloque
            const ultimoBloque = bloques[bloques.length - 1]
            let nuevoInicio = '14:00'
            let nuevoFin = '18:00'
            
            if (ultimoBloque) {
                const indexFin = HORAS_OPCIONES.indexOf(ultimoBloque.fin)
                if (indexFin !== -1 && indexFin < HORAS_OPCIONES.length - 2) {
                    nuevoInicio = HORAS_OPCIONES[indexFin + 1]
                    nuevoFin = HORAS_OPCIONES[Math.min(indexFin + 5, HORAS_OPCIONES.length - 1)]
                }
            }
            
            bloques.push({ inicio: nuevoInicio, fin: nuevoFin })
            return { ...prev, [dia]: bloques }
        })
        setCambiosPendientes(true)
    }

    const eliminarBloque = (dia: DiaSemana, index: number) => {
        setHorario(prev => {
            const bloques = [...(prev[dia] || [])]
            bloques.splice(index, 1)
            return { ...prev, [dia]: bloques }
        })
        setCambiosPendientes(true)
    }

    const handleGuardar = async () => {
        setGuardando(true)
        try {
            // Limpiar días inactivos antes de guardar
            const horarioLimpio: HorarioAtencion = {}
            DIAS.forEach(({ key }) => {
                if (diasActivos[key] && horario[key]?.length) {
                    horarioLimpio[key] = horario[key]
                }
            })
            await onSave(horarioLimpio)
            setCambiosPendientes(false)
        } finally {
            setGuardando(false)
        }
    }

    // Calcular horas totales
    const calcularHorasTotales = () => {
        let minutosTotales = 0
        DIAS.forEach(({ key }) => {
            if (diasActivos[key] && horario[key]) {
                horario[key]!.forEach(bloque => {
                    const [inicioH, inicioM] = bloque.inicio.split(':').map(Number)
                    const [finH, finM] = bloque.fin.split(':').map(Number)
                    minutosTotales += (finH * 60 + finM) - (inicioH * 60 + inicioM)
                })
            }
        })
        return (minutosTotales / 60).toFixed(1)
    }

    return (
        <div className="space-y-6">
            {/* Header con resumen */}
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div>
                    <h4 className="font-medium text-emerald-800">Horario Semanal</h4>
                    <p className="text-sm text-emerald-600">
                        {DIAS.filter(d => diasActivos[d.key]).length} días activos • {calcularHorasTotales()} horas semanales
                    </p>
                </div>
                {cambiosPendientes && (
                    <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                        Cambios sin guardar
                    </span>
                )}
            </div>

            {/* Editor por día */}
            <div className="space-y-4">
                {DIAS.map(({ key, label }) => (
                    <div key={key} className="border rounded-lg overflow-hidden">
                        {/* Header del día */}
                        <div 
                            className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                                diasActivos[key] ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-200'
                            }`}
                            onClick={() => toggleDia(key)}
                        >
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={diasActivos[key]}
                                    onChange={() => {}}
                                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                                />
                                <span className={`font-medium ${diasActivos[key] ? 'text-gray-900' : 'text-gray-500'}`}>
                                    {label}
                                </span>
                            </div>
                            {diasActivos[key] && horario[key]?.length ? (
                                <span className="text-sm text-gray-500">
                                    {horario[key]!.map(b => `${b.inicio}-${b.fin}`).join(', ')}
                                </span>
                            ) : (
                                <span className="text-sm text-gray-400 italic">No disponible</span>
                            )}
                        </div>

                        {/* Bloques de horario */}
                        {diasActivos[key] && (
                            <div className="p-4 bg-white space-y-3">
                                {(horario[key] || []).map((bloque, index) => (
                                    <div key={index} className="flex items-center gap-3">
                                        <span className="text-sm text-gray-500 w-16">Bloque {index + 1}</span>
                                        <select
                                            value={bloque.inicio}
                                            onChange={(e) => actualizarBloque(key, index, 'inicio', e.target.value)}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        >
                                            {HORAS_OPCIONES.map(hora => (
                                                <option key={hora} value={hora}>{hora}</option>
                                            ))}
                                        </select>
                                        <span className="text-gray-400">a</span>
                                        <select
                                            value={bloque.fin}
                                            onChange={(e) => actualizarBloque(key, index, 'fin', e.target.value)}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        >
                                            {HORAS_OPCIONES.filter(h => h > bloque.inicio).map(hora => (
                                                <option key={hora} value={hora}>{hora}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => eliminarBloque(key, index)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Eliminar bloque"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                
                                {(horario[key]?.length || 0) < 3 && (
                                    <button
                                        onClick={() => agregarBloque(key)}
                                        className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 px-3 py-2 hover:bg-emerald-50 rounded-lg transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Agregar bloque horario
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Botón guardar */}
            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                    onClick={handleGuardar}
                    loading={guardando || loading}
                    disabled={!cambiosPendientes}
                >
                    Guardar Horario
                </Button>
            </div>
        </div>
    )
}
