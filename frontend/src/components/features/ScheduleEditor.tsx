import { useState, useEffect, useCallback } from 'react'
import Button from '../ui/Button'
import type { HorarioAtencion } from '../../types/database'

interface ScheduleEditorProps {
    horarioInicial: HorarioAtencion | null
    onSave: (horario: HorarioAtencion) => Promise<void>
    loading?: boolean
    readOnly?: boolean
}

type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes'

const DIAS: { key: DiaSemana; label: string; short: string }[] = [
    { key: 'lunes', label: 'Lunes', short: 'Lun' },
    { key: 'martes', label: 'Martes', short: 'Mar' },
    { key: 'miercoles', label: 'Miércoles', short: 'Mié' },
    { key: 'jueves', label: 'Jueves', short: 'Jue' },
    { key: 'viernes', label: 'Viernes', short: 'Vie' }
]

// Generar bloques de 30 minutos
const generarBloques = (): string[] => {
    const bloques: string[] = []
    
    // Mañana: 9:00 a 13:00
    for (let h = 9; h < 13; h++) {
        bloques.push(`${h.toString().padStart(2, '0')}:00`)
        bloques.push(`${h.toString().padStart(2, '0')}:30`)
    }
    
    // Tarde: 14:00 a 18:00
    for (let h = 14; h < 18; h++) {
        bloques.push(`${h.toString().padStart(2, '0')}:00`)
        bloques.push(`${h.toString().padStart(2, '0')}:30`)
    }
    
    return bloques
}

const BLOQUES_30MIN = generarBloques()
const BLOQUES_MANANA = BLOQUES_30MIN.filter(b => {
    const h = parseInt(b.split(':')[0])
    return h >= 9 && h < 13
})
const BLOQUES_TARDE = BLOQUES_30MIN.filter(b => {
    const h = parseInt(b.split(':')[0])
    return h >= 14 && h < 18
})

const INTERVALO_MINUTOS = 30

export default function ScheduleEditor({ horarioInicial, onSave, loading, readOnly = false }: ScheduleEditorProps) {
    const [seleccionados, setSeleccionados] = useState<Record<DiaSemana, Set<string>>>({
        lunes: new Set(),
        martes: new Set(),
        miercoles: new Set(),
        jueves: new Set(),
        viernes: new Set()
    })
    const [guardando, setGuardando] = useState(false)
    const [cambiosPendientes, setCambiosPendientes] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select')

    const convertirDesdeRangos = useCallback((horario: HorarioAtencion): Record<DiaSemana, Set<string>> => {
        const resultado: Record<DiaSemana, Set<string>> = {
            lunes: new Set(), martes: new Set(), miercoles: new Set(), jueves: new Set(), viernes: new Set()
        }

        DIAS.forEach(({ key }) => {
            const bloquesDia = horario[key] || []
            bloquesDia.forEach(bloque => {
                const [inicioH, inicioM] = bloque.inicio.split(':').map(Number)
                const [finH, finM] = bloque.fin.split(':').map(Number)
                
                BLOQUES_30MIN.forEach(slot => {
                    const [slotH, slotM] = slot.split(':').map(Number)
                    const slotMinutos = slotH * 60 + slotM
                    const inicioMinutos = inicioH * 60 + inicioM
                    const finMinutos = finH * 60 + finM
                    
                    if (slotMinutos >= inicioMinutos && slotMinutos < finMinutos) {
                        resultado[key].add(slot)
                    }
                })
            })
        })

        return resultado
    }, [])

    const convertirARangos = useCallback((sel: Record<DiaSemana, Set<string>>): HorarioAtencion => {
        const horario: HorarioAtencion = {}

        DIAS.forEach(({ key }) => {
            const bloquesOrdenados = Array.from(sel[key]).sort()
            if (bloquesOrdenados.length === 0) return

            const rangos: { inicio: string; fin: string }[] = []
            let inicioRango = bloquesOrdenados[0]
            let ultimoBloque = bloquesOrdenados[0]

            for (let i = 1; i < bloquesOrdenados.length; i++) {
                const bloqueActual = bloquesOrdenados[i]
                const [ultimoH, ultimoM] = ultimoBloque.split(':').map(Number)
                const [actualH, actualM] = bloqueActual.split(':').map(Number)
                
                if ((actualH * 60 + actualM) - (ultimoH * 60 + ultimoM) > INTERVALO_MINUTOS) {
                    const finMinutos = ultimoH * 60 + ultimoM + INTERVALO_MINUTOS
                    rangos.push({
                        inicio: inicioRango,
                        fin: `${Math.floor(finMinutos / 60).toString().padStart(2, '0')}:${(finMinutos % 60).toString().padStart(2, '0')}`
                    })
                    inicioRango = bloqueActual
                }
                ultimoBloque = bloqueActual
            }

            const [ultimoH, ultimoM] = ultimoBloque.split(':').map(Number)
            const finMinutos = ultimoH * 60 + ultimoM + INTERVALO_MINUTOS
            rangos.push({
                inicio: inicioRango,
                fin: `${Math.floor(finMinutos / 60).toString().padStart(2, '0')}:${(finMinutos % 60).toString().padStart(2, '0')}`
            })

            horario[key] = rangos
        })

        return horario
    }, [])

    useEffect(() => {
        if (horarioInicial) {
            setSeleccionados(convertirDesdeRangos(horarioInicial))
            setCambiosPendientes(false)
        }
    }, [horarioInicial, convertirDesdeRangos])

    const handleMouseDown = (dia: DiaSemana, bloque: string) => {
        if (readOnly) return
        setIsDragging(true)
        const isSelected = seleccionados[dia].has(bloque)
        setDragMode(isSelected ? 'deselect' : 'select')
        
        setSeleccionados(prev => {
            const nuevo = { ...prev }
            const set = new Set(prev[dia])
            isSelected ? set.delete(bloque) : set.add(bloque)
            nuevo[dia] = set
            return nuevo
        })
        setCambiosPendientes(true)
    }

    const handleMouseEnter = (dia: DiaSemana, bloque: string) => {
        if (!isDragging || readOnly) return
        
        setSeleccionados(prev => {
            const nuevo = { ...prev }
            const set = new Set(prev[dia])
            dragMode === 'select' ? set.add(bloque) : set.delete(bloque)
            nuevo[dia] = set
            return nuevo
        })
        setCambiosPendientes(true)
    }

    useEffect(() => {
        const handleMouseUp = () => setIsDragging(false)
        window.addEventListener('mouseup', handleMouseUp)
        return () => window.removeEventListener('mouseup', handleMouseUp)
    }, [])

    const togglePeriodo = (dia: DiaSemana, periodo: 'mañana' | 'tarde') => {
        if (readOnly) return
        const bloquesPeriodo = periodo === 'mañana' ? BLOQUES_MANANA : BLOQUES_TARDE
        
        setSeleccionados(prev => {
            const nuevo = { ...prev }
            const set = new Set(prev[dia])
            const todosSeleccionados = bloquesPeriodo.every(b => set.has(b))
            
            bloquesPeriodo.forEach(b => todosSeleccionados ? set.delete(b) : set.add(b))
            nuevo[dia] = set
            return nuevo
        })
        setCambiosPendientes(true)
    }

    const handleGuardar = async () => {
        setGuardando(true)
        try {
            await onSave(convertirARangos(seleccionados))
            setCambiosPendientes(false)
        } finally {
            setGuardando(false)
        }
    }

    const calcularStats = () => {
        let total = 0
        DIAS.forEach(({ key }) => { total += seleccionados[key].size })
        return { bloques: total, horas: (total * INTERVALO_MINUTOS / 60).toFixed(1) }
    }

    const stats = calcularStats()

    const renderBloque = (bloque: string, dia: DiaSemana) => {
        const isSelected = seleccionados[dia].has(bloque)
        return (
            <div
                key={`${dia}-${bloque}`}
                className={`
                    h-9 border-l border-slate-200/60 transition-all duration-75 rounded-sm mx-px
                    ${readOnly ? 'cursor-default' : 'cursor-pointer'}
                    ${isSelected 
                        ? 'bg-emerald-400 hover:bg-emerald-500 shadow-inner shadow-emerald-500/20' 
                        : readOnly 
                            ? 'bg-slate-50' 
                            : 'bg-white hover:bg-emerald-50 hover:border-emerald-200'
                    }
                `}
                onMouseDown={() => handleMouseDown(dia, bloque)}
                onMouseEnter={() => handleMouseEnter(dia, bloque)}
                title={`${bloque} - ${dia}`}
            />
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                        {readOnly ? 'Disponibilidad' : 'Configurar Disponibilidad'}
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                        <span className="font-semibold text-emerald-600">{stats.horas}h</span> semanales · {stats.bloques} bloques de 30 min
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {cambiosPendientes && !readOnly && (
                        <span className="text-xs px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full font-medium border border-amber-200/60 animate-pulse">
                            Cambios sin guardar
                        </span>
                    )}
                </div>
            </div>

            {/* Instrucción */}
            {!readOnly && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200/60 rounded-xl">
                    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-emerald-700">
                        Haz clic o arrastra sobre los bloques para marcar tu disponibilidad
                    </p>
                </div>
            )}

            {/* Grid */}
            <div className="border border-slate-200 rounded-xl overflow-hidden select-none bg-white shadow-sm">
                {/* Header días */}
                <div className="grid grid-cols-[72px_repeat(5,1fr)] bg-gradient-to-b from-slate-100 to-slate-50 border-b border-slate-200">
                    <div className="p-3 flex items-center justify-center">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    {DIAS.map(({ key, label, short }) => {
                        const count = seleccionados[key].size
                        return (
                            <div key={key} className="p-3 text-center border-l border-slate-200/60">
                                <span className="hidden sm:block text-xs font-semibold text-slate-700">{label}</span>
                                <span className="sm:hidden text-xs font-semibold text-slate-700">{short}</span>
                                {count > 0 && (
                                    <span className="block text-[10px] font-medium text-emerald-500 mt-0.5">
                                        {(count * INTERVALO_MINUTOS / 60).toFixed(1)}h
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Mañana Header */}
                <div className="grid grid-cols-[72px_repeat(5,1fr)] bg-slate-50 border-b border-slate-200/60">
                    <div className="py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                        Mañana
                    </div>
                    {DIAS.map(({ key }) => {
                        const todosSeleccionados = BLOQUES_MANANA.every(b => seleccionados[key].has(b))
                        return (
                            <button
                                key={key}
                                onClick={() => togglePeriodo(key, 'mañana')}
                                disabled={readOnly}
                                className={`py-2 px-1 text-[10px] font-medium border-l border-slate-200/60 transition-all
                                    ${readOnly ? 'cursor-default text-slate-300' : 'hover:bg-emerald-50'}
                                    ${todosSeleccionados ? 'text-emerald-600' : 'text-slate-400'}
                                `}
                            >
                                {todosSeleccionados ? '✓ Todo' : 'Todos'}
                            </button>
                        )
                    })}
                </div>

                {/* Bloques Mañana */}
                {BLOQUES_MANANA.map((bloque) => (
                    <div key={bloque} className="grid grid-cols-[72px_repeat(5,1fr)]">
                        <div className="px-3 py-1 text-xs text-right pr-4 flex items-center justify-end">
                            <span className="text-slate-500 font-medium tabular-nums">{bloque}</span>
                        </div>
                        {DIAS.map(({ key }) => renderBloque(bloque, key))}
                    </div>
                ))}

                {/* Break almuerzo */}
                <div className="grid grid-cols-[72px_repeat(5,1fr)] bg-gradient-to-r from-slate-100 to-slate-50 border-y border-slate-300/60">
                    <div className="py-2.5 px-3 text-[11px] text-slate-400 font-medium text-right pr-4">13:00</div>
                    {DIAS.map(({ key }) => (
                        <div key={key} className="py-2.5 text-[11px] text-slate-400 text-center border-l border-slate-200/60 flex items-center justify-center gap-1.5">
                            <span className="hidden sm:inline">Almuerzo</span>
                            <span className="sm:hidden">—</span>
                        </div>
                    ))}
                </div>

                {/* Tarde Header */}
                <div className="grid grid-cols-[72px_repeat(5,1fr)] bg-slate-50 border-b border-slate-200/60">
                    <div className="py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                        Tarde
                    </div>
                    {DIAS.map(({ key }) => {
                        const todosSeleccionados = BLOQUES_TARDE.every(b => seleccionados[key].has(b))
                        return (
                            <button
                                key={key}
                                onClick={() => togglePeriodo(key, 'tarde')}
                                disabled={readOnly}
                                className={`py-2 px-1 text-[10px] font-medium border-l border-slate-200/60 transition-all
                                    ${readOnly ? 'cursor-default text-slate-300' : 'hover:bg-emerald-50'}
                                    ${todosSeleccionados ? 'text-emerald-600' : 'text-slate-400'}
                                `}
                            >
                                {todosSeleccionados ? '✓ Todo' : 'Todos'}
                            </button>
                        )
                    })}
                </div>

                {/* Bloques Tarde */}
                {BLOQUES_TARDE.map((bloque) => (
                    <div key={bloque} className="grid grid-cols-[72px_repeat(5,1fr)]">
                        <div className="px-3 py-1 text-xs text-right pr-4 flex items-center justify-end">
                            <span className="text-slate-500 font-medium tabular-nums">{bloque}</span>
                        </div>
                        {DIAS.map(({ key }) => renderBloque(bloque, key))}
                    </div>
                ))}
            </div>

            {/* Leyenda */}
            <div className="flex items-center justify-center gap-8 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-emerald-400 rounded-md shadow-sm" />
                    <span className="font-medium">Disponible</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-white border border-slate-200 rounded-md" />
                    <span className="font-medium">No disponible</span>
                </div>
            </div>

            {/* Resumen por día */}
            <div className="grid grid-cols-5 gap-3">
                {DIAS.map(({ key, label, short }) => {
                    const count = seleccionados[key].size
                    const hrs = (count * INTERVALO_MINUTOS / 60).toFixed(1)
                    const porcentaje = Math.round((count / BLOQUES_30MIN.length) * 100)
                    return (
                        <div 
                            key={key} 
                            className={`text-center py-3 px-2 rounded-xl transition-all border ${
                                count > 0 
                                    ? 'bg-emerald-50 border-emerald-200/60' 
                                    : 'bg-slate-50 border-slate-200/40'
                            }`}
                        >
                            <div className="text-xs font-semibold text-slate-600 mb-1">
                                <span className="hidden sm:inline">{label}</span>
                                <span className="sm:hidden">{short}</span>
                            </div>
                            <div className={`text-lg font-bold ${count > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                {hrs}h
                            </div>
                            {count > 0 && (
                                <div className="mt-1.5">
                                    <div className="w-full bg-emerald-100 rounded-full h-1.5">
                                        <div 
                                            className="bg-emerald-400 h-1.5 rounded-full transition-all duration-300"
                                            style={{ width: `${Math.min(porcentaje, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Guardar */}
            {!readOnly && (
                <div className="flex justify-end pt-4 border-t border-slate-200">
                    <Button
                        onClick={handleGuardar}
                        loading={guardando || loading}
                        disabled={!cambiosPendientes}
                    >
                        {cambiosPendientes ? 'Guardar cambios' : 'Sin cambios'}
                    </Button>
                </div>
            )}
        </div>
    )
}
