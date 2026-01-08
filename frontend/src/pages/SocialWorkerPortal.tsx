import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useStudents } from '../hooks/useStudents'
import { useCitas } from '../hooks/useCitas'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'
import { enviarNotificacionesMasivas } from '../lib/emailService'
import { parsearCSVMinisterio, leerArchivoComoTexto, validarArchivoCSV, type ResultadoParseCSV } from '../lib/csvParser'
import { formatDateTime, formatDateShort } from '../lib/dateUtils'
import type { Estudiante, EstadoCita } from '../types/database'
import Card from '../components/ui/Card'
import Badge, { getCitaStatusVariant, getCitaStatusLabel } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import FileUpload from '../components/ui/FileUpload'

// Interfaces
interface CitaConEstudiante {
    id: string
    inicio: string
    fin: string
    estado: EstadoCita
    motivo: string
    observaciones: string | null
    estudiantes: { nombre: string; correo: string; rut: string } | null
}

export default function SocialWorkerPortal() {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()
    const toast = useToast()
    const { fetchEstudiantes, contarEstudiantesPendientes } = useStudents()
    const { fetchCitasHoy, fetchCitasByAsistente, cambiarEstadoCita } = useCitas()

    // Estados
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
    const [citasHoy, setCitasHoy] = useState<CitaConEstudiante[]>([])
    const [todasCitas, setTodasCitas] = useState<CitaConEstudiante[]>([])
    const [busqueda, setBusqueda] = useState('')
    const [pendientesCount, setPendientesCount] = useState(0)
    const [tabActivo, setTabActivo] = useState<'estudiantes' | 'citas' | 'datos'>('estudiantes')
    const [cargando, setCargando] = useState(true)

    // CSV Upload
    const [procesandoCSV, setProcesandoCSV] = useState(false)
    const [resultadoCSV, setResultadoCSV] = useState<ResultadoParseCSV | null>(null)

    // Selección y notificaciones
    const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
    const [enviandoNotificacion, setEnviandoNotificacion] = useState(false)
    const [mostrarModalNotificacion, setMostrarModalNotificacion] = useState(false)

    // Modal cita
    const [citaSeleccionada, setCitaSeleccionada] = useState<CitaConEstudiante | null>(null)
    const [mostrarModalCita, setMostrarModalCita] = useState(false)

    // Cargar datos
    useEffect(() => {
        const cargarDatos = async () => {
            if (!user) return

            try {
                const count = await contarEstudiantesPendientes()
                setPendientesCount(count)

                const estudiantesData = await fetchEstudiantes({ limite: 50, debePostular: true })
                setEstudiantes(estudiantesData)

                const citasHoyData = await fetchCitasHoy(user.rut)
                setCitasHoy(citasHoyData as CitaConEstudiante[])

                const todasData = await fetchCitasByAsistente(user.rut)
                setTodasCitas(todasData as CitaConEstudiante[])
            } catch (error) {
                console.error('Error al cargar datos:', error)
            } finally {
                setCargando(false)
            }
        }

        cargarDatos()
    }, [user, fetchEstudiantes, contarEstudiantesPendientes, fetchCitasHoy, fetchCitasByAsistente])

    // Buscar estudiantes
    const handleBuscar = async () => {
        const data = await fetchEstudiantes({ busqueda, limite: 50, debePostular: true })
        setEstudiantes(data)
    }

    // Logout
    const handleLogout = () => {
        signOut()
        navigate('/login')
    }

    // Cambiar estado cita
    const handleCambiarEstado = async (id: string, nuevoEstado: EstadoCita) => {
        const exito = await cambiarEstadoCita(id, nuevoEstado)
        if (exito && user) {
            const mensajes: Record<EstadoCita, string> = {
                confirmada: 'Cita confirmada',
                completada: 'Cita completada',
                cancelada: 'Cita cancelada',
                pendiente: 'Cita actualizada'
            }
            toast.exito(mensajes[nuevoEstado])

            const citasHoyData = await fetchCitasHoy(user.rut)
            setCitasHoy(citasHoyData as CitaConEstudiante[])
            const todasData = await fetchCitasByAsistente(user.rut)
            setTodasCitas(todasData as CitaConEstudiante[])
            setMostrarModalCita(false)
        } else {
            toast.error('Error al actualizar')
        }
    }

    // Selección de estudiantes
    const toggleSeleccion = (rut: string) => {
        const nueva = new Set(seleccionados)
        if (nueva.has(rut)) nueva.delete(rut)
        else nueva.add(rut)
        setSeleccionados(nueva)
    }

    const estudiantesNotificables = estudiantes.filter(e =>
        e.debe_postular && !e.ha_agendado_cita && !e.notificacion_enviada
    )

    const seleccionarTodos = () => {
        if (seleccionados.size === estudiantesNotificables.length) {
            setSeleccionados(new Set())
        } else {
            setSeleccionados(new Set(estudiantesNotificables.map(e => e.rut)))
        }
    }

    // Enviar notificaciones
    const handleEnviarNotificaciones = async () => {
        const estudiantesAEnviar = estudiantes.filter(e => seleccionados.has(e.rut))
        if (estudiantesAEnviar.length === 0) return

        setEnviandoNotificacion(true)

        try {
            const resultado = await enviarNotificacionesMasivas(
                estudiantesAEnviar.map(e => ({ rut: e.rut, nombre: e.nombre, correo: e.correo }))
            )

            if (resultado.exitosos > 0) {
                const rutsExitosos = estudiantesAEnviar.slice(0, resultado.exitosos).map(e => e.rut)
                await supabase
                    .from('estudiantes')
                    .update({ notificacion_enviada: true, fecha_notificacion: new Date().toISOString() })
                    .in('rut', rutsExitosos)

                const estudiantesData = await fetchEstudiantes({ limite: 50, debePostular: true })
                setEstudiantes(estudiantesData)
                setSeleccionados(new Set())
                toast.exito(`${resultado.exitosos} correo(s) enviado(s)`)
            }

            if (resultado.fallidos > 0) {
                toast.advertencia(`${resultado.fallidos} correo(s) fallido(s)`)
            }
        } catch (error) {
            console.error('Error al enviar:', error)
            toast.error('Error al enviar notificaciones')
        } finally {
            setEnviandoNotificacion(false)
            setMostrarModalNotificacion(false)
        }
    }

    const citasPendientesHoy = citasHoy.filter(c => c.estado === 'pendiente' || c.estado === 'confirmada')

    // Manejar subida de CSV
    const handleCSVUpload = async (archivo: File) => {
        const validacion = validarArchivoCSV(archivo)
        if (!validacion.valido) {
            toast.error(validacion.error || 'Archivo inválido')
            return
        }

        setProcesandoCSV(true)
        setResultadoCSV(null)
        toast.info('Leyendo archivo...')

        try {
            // Leer archivo
            const contenido = await leerArchivoComoTexto(archivo)

            // Usar setTimeout para no bloquear UI
            await new Promise(resolve => setTimeout(resolve, 100))

            toast.info('Parseando datos...')
            const resultado = parsearCSVMinisterio(contenido)
            setResultadoCSV(resultado)

            if (resultado.datos.length === 0) {
                toast.error('No se encontraron registros válidos')
                return
            }

            toast.info(`${resultado.filasValidas} registros encontrados. Guardando...`)

            // Preparar datos
            const datosParaInsertar = resultado.datos.map(d => ({
                rut: d.rut,
                nombre: null,
                tipo: d.tipo,
                beneficio: d.observacion,
                fecha_carga: new Date().toISOString(),
                cargado_por: user?.rut || null
            }))

            // Subir en lotes de 500 para evitar timeouts
            const BATCH_SIZE = 500
            let totalExitosos = 0
            let totalErrores = 0

            for (let i = 0; i < datosParaInsertar.length; i += BATCH_SIZE) {
                const lote = datosParaInsertar.slice(i, i + BATCH_SIZE)
                const loteNum = Math.floor(i / BATCH_SIZE) + 1
                const totalLotes = Math.ceil(datosParaInsertar.length / BATCH_SIZE)

                try {
                    const { error } = await supabase
                        .from('datos_ministerio')
                        .upsert(lote, { onConflict: 'rut' })

                    if (error) {
                        console.error(`Error lote ${loteNum}:`, error)
                        totalErrores += lote.length
                    } else {
                        totalExitosos += lote.length
                    }
                } catch (err) {
                    console.error(`Error lote ${loteNum}:`, err)
                    totalErrores += lote.length
                }

                // Mostrar progreso cada 5 lotes para no saturar
                if (loteNum % 5 === 0 || loteNum === totalLotes) {
                    toast.info(`Guardando: ${loteNum}/${totalLotes} lotes`)
                }

                // Pequeña pausa para no saturar
                await new Promise(resolve => setTimeout(resolve, 50))
            }

            if (totalExitosos > 0) {
                toast.exito(`✓ ${totalExitosos} registros cargados`)
            }
            if (totalErrores > 0) {
                toast.advertencia(`${totalErrores} registros con error`)
            }

        } catch (error) {
            console.error('Error al procesar CSV:', error)
            toast.error('Error al procesar el archivo')
        } finally {
            setProcesandoCSV(false)
        }
    }

    if (cargando) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">GestorBecas</h1>
                            <p className="text-sm text-gray-500">Asuntos Estudiantiles</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600">{user?.nombre}</span>
                            <Button variant="ghost" size="sm" onClick={handleLogout}>
                                Salir
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
                {/* Estadísticas */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <p className="text-3xl font-bold text-gray-900">{pendientesCount}</p>
                        <p className="text-sm text-gray-500">Estudiantes Pendientes</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <p className="text-3xl font-bold text-gray-900">{citasPendientesHoy.length}</p>
                        <p className="text-sm text-gray-500">Citas Hoy</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <p className="text-3xl font-bold text-gray-900">
                            {todasCitas.filter(c => c.estado === 'completada').length}
                        </p>
                        <p className="text-sm text-gray-500">Completadas</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 border-b border-gray-200">
                    <button
                        onClick={() => setTabActivo('estudiantes')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tabActivo === 'estudiantes'
                            ? 'border-emerald-600 text-emerald-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Estudiantes
                    </button>
                    <button
                        onClick={() => setTabActivo('citas')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tabActivo === 'citas'
                            ? 'border-emerald-600 text-emerald-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Citas
                    </button>
                    <button
                        onClick={() => setTabActivo('datos')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tabActivo === 'datos'
                            ? 'border-emerald-600 text-emerald-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Cargar Datos
                    </button>
                </div>

                {/* Tab Estudiantes */}
                {tabActivo === 'estudiantes' && (
                    <Card>
                        {/* Buscador y acciones */}
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <div className="flex-1 flex gap-2">
                                <Input
                                    placeholder="Buscar por RUT o nombre..."
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
                                />
                                <Button onClick={handleBuscar}>Buscar</Button>
                            </div>
                            <Button
                                onClick={() => setMostrarModalNotificacion(true)}
                                disabled={seleccionados.size === 0}
                            >
                                Enviar Notificación ({seleccionados.size})
                            </Button>
                        </div>

                        {/* Seleccionar todos */}
                        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                            <input
                                type="checkbox"
                                checked={seleccionados.size > 0 && seleccionados.size === estudiantesNotificables.length}
                                onChange={seleccionarTodos}
                                className="w-4 h-4 text-emerald-600 rounded"
                            />
                            <span className="text-sm text-gray-600">
                                Seleccionar todos ({estudiantesNotificables.length} notificables)
                            </span>
                        </div>

                        {/* Tabla */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="w-10 py-3 px-2"></th>
                                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">RUT</th>
                                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">Nombre</th>
                                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">Correo</th>
                                        <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {estudiantes.map(est => {
                                        const esNotificable = est.debe_postular && !est.ha_agendado_cita && !est.notificacion_enviada
                                        return (
                                            <tr key={est.rut} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-2">
                                                    {esNotificable && (
                                                        <input
                                                            type="checkbox"
                                                            checked={seleccionados.has(est.rut)}
                                                            onChange={() => toggleSeleccion(est.rut)}
                                                            className="w-4 h-4 text-emerald-600 rounded"
                                                        />
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 font-mono text-sm">{est.rut}</td>
                                                <td className="py-3 px-3 font-medium">{est.nombre}</td>
                                                <td className="py-3 px-3 text-sm text-gray-600">{est.correo}</td>
                                                <td className="py-3 px-3">
                                                    {est.ha_agendado_cita ? (
                                                        <Badge variant="success">Con cita</Badge>
                                                    ) : est.notificacion_enviada ? (
                                                        <Badge variant="info">Notificado</Badge>
                                                    ) : (
                                                        <Badge variant="warning">Pendiente</Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            {estudiantes.length === 0 && (
                                <p className="text-center py-8 text-gray-500">No se encontraron estudiantes</p>
                            )}
                        </div>
                    </Card>
                )}

                {/* Tab Citas */}
                {tabActivo === 'citas' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Citas de hoy */}
                        <Card title="Citas de Hoy" subtitle={`${citasPendientesHoy.length} pendiente(s)`}>
                            {citasPendientesHoy.length > 0 ? (
                                <div className="space-y-3">
                                    {citasPendientesHoy.map(cita => (
                                        <div
                                            key={cita.id}
                                            onClick={() => { setCitaSeleccionada(cita); setMostrarModalCita(true) }}
                                            className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-medium">{cita.estudiantes?.nombre}</p>
                                                    <p className="text-sm text-gray-500">{formatDateTime(cita.inicio)}</p>
                                                </div>
                                                <Badge variant={getCitaStatusVariant(cita.estado)}>
                                                    {getCitaStatusLabel(cita.estado)}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center py-8 text-gray-500">Sin citas para hoy</p>
                            )}
                        </Card>

                        {/* Todas las citas */}
                        <Card title="Historial">
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {todasCitas.slice(0, 10).map(cita => (
                                    <div
                                        key={cita.id}
                                        onClick={() => { setCitaSeleccionada(cita); setMostrarModalCita(true) }}
                                        className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 px-2 rounded"
                                    >
                                        <div>
                                            <p className="text-sm font-medium">{cita.estudiantes?.nombre}</p>
                                            <p className="text-xs text-gray-500">{formatDateShort(cita.inicio)}</p>
                                        </div>
                                        <Badge variant={getCitaStatusVariant(cita.estado)}>
                                            {getCitaStatusLabel(cita.estado)}
                                        </Badge>
                                    </div>
                                ))}
                                {todasCitas.length === 0 && (
                                    <p className="text-center py-8 text-gray-500">Sin historial</p>
                                )}
                            </div>
                        </Card>
                    </div>
                )}

                {/* Tab Cargar Datos */}
                {tabActivo === 'datos' && (
                    <div className="max-w-2xl mx-auto">
                        <Card>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2 ">
                                Cargar Datos del Ministerio
                            </h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Sube el archivo CSV con los estudiantes que deben acreditar FUAS.
                                El formato debe ser: RUT;DV;FORMULARIO;OBSERVACION
                            </p>

                            <FileUpload
                                onFileSelect={handleCSVUpload}
                                accept=".csv"
                                label="Archivo CSV"
                                descripcion="Arrastra el archivo o haz clic para seleccionar"
                                loading={procesandoCSV}
                            />

                            {resultadoCSV && (
                                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                                    <h4 className="font-medium text-gray-900 mb-2">
                                        Resultado del procesamiento
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-500">Total filas</p>
                                            <p className="font-semibold">{resultadoCSV.totalFilas}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Válidas</p>
                                            <p className="font-semibold text-green-600">{resultadoCSV.filasValidas}</p>
                                        </div>
                                    </div>
                                    {resultadoCSV.errores.length > 0 && (
                                        <div className="mt-4">
                                            <p className="text-sm font-medium text-red-600 mb-1">
                                                Errores ({resultadoCSV.errores.length})
                                            </p>
                                            <div className="max-h-32 overflow-y-auto text-xs text-red-500 space-y-1">
                                                {resultadoCSV.errores.slice(0, 10).map((err, i) => (
                                                    <p key={i}>{err}</p>
                                                ))}
                                                {resultadoCSV.errores.length > 10 && (
                                                    <p>...y {resultadoCSV.errores.length - 10} más</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card>
                    </div>
                )}
            </main>

            {/* Modal Notificación */}
            <Modal
                isOpen={mostrarModalNotificacion}
                onClose={() => setMostrarModalNotificacion(false)}
                title="Enviar Notificaciones"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600">
                        ¿Enviar notificación a <strong>{seleccionados.size}</strong> estudiante(s)?
                    </p>
                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            onClick={() => setMostrarModalNotificacion(false)}
                            className="flex-1"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleEnviarNotificaciones}
                            loading={enviandoNotificacion}
                            className="flex-1"
                        >
                            Enviar
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Modal Detalle Cita */}
            <Modal
                isOpen={mostrarModalCita}
                onClose={() => setMostrarModalCita(false)}
                title="Detalle de Cita"
                size="sm"
            >
                {citaSeleccionada && (
                    <div className="space-y-4">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Estudiante</span>
                                <span className="font-medium">{citaSeleccionada.estudiantes?.nombre}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">RUT</span>
                                <span className="font-mono">{citaSeleccionada.estudiantes?.rut}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Fecha</span>
                                <span>{formatDateTime(citaSeleccionada.inicio)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Motivo</span>
                                <span>{citaSeleccionada.motivo}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500">Estado</span>
                                <Badge variant={getCitaStatusVariant(citaSeleccionada.estado)}>
                                    {getCitaStatusLabel(citaSeleccionada.estado)}
                                </Badge>
                            </div>
                        </div>

                        {(citaSeleccionada.estado === 'pendiente' || citaSeleccionada.estado === 'confirmada') && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                                {citaSeleccionada.estado === 'pendiente' && (
                                    <Button size="sm" onClick={() => handleCambiarEstado(citaSeleccionada.id, 'confirmada')}>
                                        Confirmar
                                    </Button>
                                )}
                                <Button size="sm" variant="secondary" onClick={() => handleCambiarEstado(citaSeleccionada.id, 'completada')}>
                                    Completar
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => handleCambiarEstado(citaSeleccionada.id, 'cancelada')}>
                                    Cancelar
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}
