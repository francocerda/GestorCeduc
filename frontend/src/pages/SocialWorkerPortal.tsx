import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useStudents } from '../hooks/useStudents'
import { useCitas } from '../hooks/useCitas'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'
import { enviarNotificacionesMasivas, enviarRecordatoriosMasivosFUAS } from '../lib/emailService'
import { parsearCSVMinisterio, leerArchivoComoTexto, validarArchivoCSV, type ResultadoParseCSV } from '../lib/csvParserAcreditacion'
import { parsearCSVPostulantesFUAS, validarArchivoCSVFUAS, type ResultadoParseFUAS } from '../lib/csvParserFUAS'
import { formatDateTime, formatDateShort } from '../lib/dateUtils'
import {
    syncEstudiantesInstituto,
    cruzarDatosMinisterio,
    getEstudiantesPendientes,
    marcarNotificados,
    verificarBackend,
    detectarNoPostulantes,
    getNoPostulantes,
    marcarNotificadosFUAS,
    type EstudianteFUASCruce,
    type ResultadoSync,
    type ResultadoCruce,
    type NoPostulanteResult,
    type ResultadoDeteccion
} from '../lib/instituteApi'
import type { Estudiante, EstadoCita } from '../types/database'
import Card from '../components/ui/Card'
import Badge, { getCitaStatusVariant, getCitaStatusLabel } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import FileUpload from '../components/ui/FileUpload'
import { subirDocumentoCita, validarArchivoPDF } from '../lib/storageService'

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
    const [tabActivo, setTabActivo] = useState<'estudiantes' | 'citas' | 'sincronizar' | 'fuas'>('estudiantes')
    const [cargando, setCargando] = useState(true)

    // CSV Upload
    const [procesandoCSV, setProcesandoCSV] = useState(false)
    const [resultadoCSV, setResultadoCSV] = useState<ResultadoParseCSV | null>(null)

    // Sincronización Instituto
    const [sincronizando, setSincronizando] = useState(false)
    const [resultadoSync, setResultadoSync] = useState<ResultadoSync | null>(null)
    const [backendDisponible, setBackendDisponible] = useState<boolean | null>(null)

    // Cruce de datos
    const [cruzandoDatos, setCruzandoDatos] = useState(false)
    const [resultadoCruce, setResultadoCruce] = useState<ResultadoCruce | null>(null)
    const [estudiantesFUAS, setEstudiantesFUAS] = useState<EstudianteFUASCruce[]>([])
    const [seleccionadosFUAS, setSeleccionadosFUAS] = useState<Set<string>>(new Set())
    const [paginaActual, setPaginaActual] = useState(1)
    const [busquedaFUAS, setBusquedaFUAS] = useState('')  // Estado separado para búsqueda FUAS
    const ESTUDIANTES_POR_PAGINA = 30

    // Filtrar estudiantes FUAS según búsqueda
    const estudiantesFUASFiltrados = estudiantesFUAS.filter(est => {
        if (!busquedaFUAS.trim()) return true
        const termino = busquedaFUAS.toLowerCase().trim()
        return (
            est.rut.toLowerCase().includes(termino) ||
            (est.nombre && est.nombre.toLowerCase().includes(termino)) ||
            (est.correo && est.correo.toLowerCase().includes(termino))
        )
    })

    // Selección y notificaciones
    const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
    const [enviandoNotificacion, setEnviandoNotificacion] = useState(false)
    const [mostrarModalNotificacion, setMostrarModalNotificacion] = useState(false)

    // Modal cita
    const [citaSeleccionada, setCitaSeleccionada] = useState<CitaConEstudiante | null>(null)
    const [mostrarModalCita, setMostrarModalCita] = useState(false)

    // ========== FUAS NO POSTULANTES ==========
    const [procesandoCSVFUAS, setProcesandoCSVFUAS] = useState(false)
    const [resultadoCSVFUAS, setResultadoCSVFUAS] = useState<ResultadoParseFUAS | null>(null)
    const [detectandoNoPostulantes, setDetectandoNoPostulantes] = useState(false)
    const [resultadoDeteccion, setResultadoDeteccion] = useState<ResultadoDeteccion | null>(null)
    const [noPostulantes, setNoPostulantes] = useState<NoPostulanteResult[]>([])
    const [seleccionadosNP, setSeleccionadosNP] = useState<Set<string>>(new Set())
    const [paginaNP, setPaginaNP] = useState(1)
    const [busquedaNP, setBusquedaNP] = useState('')
    const [enviandoRecordatorio, setEnviandoRecordatorio] = useState(false)
    const [filtroDocumento, setFiltroDocumento] = useState<'todos' | 'sin_doc' | 'pendiente' | 'validado' | 'rechazado'>('todos')

    // Modal de validación de documento
    const [modalValidacion, setModalValidacion] = useState<NoPostulanteResult | null>(null)
    const [validandoDoc, setValidandoDoc] = useState(false)

    // Contador de documentos pendientes de validación
    const docsPendientes = noPostulantes.filter(e => e.documento_url && e.documento_estado !== 'validado' && e.documento_estado !== 'rechazado').length

    // Filtrar no postulantes según búsqueda Y estado de documento
    const noPostulantesFiltrados = noPostulantes.filter(est => {
        // Filtro de búsqueda
        if (busquedaNP.trim()) {
            const termino = busquedaNP.toLowerCase().trim()
            const coincide = est.rut.toLowerCase().includes(termino) ||
                (est.nombre && est.nombre.toLowerCase().includes(termino)) ||
                (est.correo && est.correo.toLowerCase().includes(termino))
            if (!coincide) return false
        }

        // Filtro de estado documento
        switch (filtroDocumento) {
            case 'sin_doc': return !est.documento_url
            case 'pendiente': return est.documento_url && (!est.documento_estado || est.documento_estado === 'pendiente')
            case 'validado': return est.documento_estado === 'validado'
            case 'rechazado': return est.documento_estado === 'rechazado'
            default: return true
        }
    })

    // ========== MODAL COMPLETAR CITA ==========
    const [mostrarModalCompletar, setMostrarModalCompletar] = useState(false)
    const [descripcionSesion, setDescripcionSesion] = useState('')
    const [archivoCompletarCita, setArchivoCompletarCita] = useState<File | null>(null)
    const [completandoCita, setCompletandoCita] = useState(false)

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

    // ========== Sync Instituto y Cruce ==========

    // Verificar backend al cargar tab
    const handleVerificarBackend = async () => {
        const disponible = await verificarBackend()
        setBackendDisponible(disponible)
        return disponible
    }

    // Sincronizar estudiantes desde SQL Server del Instituto
    const handleSyncInstituto = async () => {
        setSincronizando(true)
        setResultadoSync(null)
        toast.info('Conectando con servidor del Instituto...')

        try {
            const resultado = await syncEstudiantesInstituto()
            setResultadoSync(resultado)

            if (resultado.exitoso) {
                toast.exito(resultado.mensaje)
            } else {
                toast.error(resultado.mensaje)
            }
        } catch (error) {
            console.error('Error en sincronización:', error)
            toast.error('Error al conectar con el servidor')
        } finally {
            setSincronizando(false)
        }
    }

    // Cruzar datos del CSV con los del Instituto
    const handleCruzarDatos = async () => {
        if (!resultadoCSV || resultadoCSV.datos.length === 0) {
            toast.error('Primero debes cargar un archivo CSV')
            return
        }

        setCruzandoDatos(true)
        toast.info('Cruzando datos con estudiantes matriculados...')

        try {
            const resultado = await cruzarDatosMinisterio(
                resultadoCSV.datos.map(d => ({
                    rut: d.rut,
                    dv: d.dv,
                    tipo: d.tipo,
                    observacion: d.observacion
                }))
            )

            setResultadoCruce(resultado)

            if (resultado.exitoso) {
                setEstudiantesFUAS(resultado.estudiantes)
                setPaginaActual(1)
                toast.exito(`${resultado.coincidencias} estudiantes encontrados que deben postular`)
            } else {
                toast.error(resultado.mensaje || 'Error al cruzar datos')
            }
        } catch (error) {
            console.error('Error en cruce de datos:', error)
            toast.error('Error al procesar el cruce')
        } finally {
            setCruzandoDatos(false)
        }
    }

    // Cargar estudiantes pendientes desde Supabase
    // Primero intenta estudiantes_fuas, si está vacío, consulta datos_ministerio + datos_instituto
    const handleCargarPendientes = async () => {
        toast.info('Cargando estudiantes pendientes...')
        try {
            // Primero intentar desde estudiantes_fuas
            const resultado = await getEstudiantesPendientes()
            if (resultado.exitoso && resultado.estudiantes.length > 0) {
                setEstudiantesFUAS(resultado.estudiantes)
                setPaginaActual(1) // Reset a primera página
                toast.exito(`${resultado.total} estudiantes pendientes de postular`)
                return
            }

            // Si no hay en estudiantes_fuas, consultar directamente datos_ministerio + datos_instituto
            toast.info('Buscando en datos del ministerio...')

            // Obtener datos del ministerio
            const { data: datosMinisterio, error: errorMin } = await supabase
                .from('datos_ministerio')
                .select('rut, tipo, beneficio')

            if (errorMin || !datosMinisterio || datosMinisterio.length === 0) {
                toast.advertencia('No hay datos del ministerio cargados')
                return
            }

            // Obtener datos del instituto
            const { data: datosInstituto } = await supabase
                .from('datos_instituto')
                .select('rut, nombre, correo, carrera, sede')

            // Crear mapa de instituto por RUT
            const mapaInstituto = new Map()
            if (datosInstituto) {
                datosInstituto.forEach(est => {
                    mapaInstituto.set(est.rut, est)
                })
            }

            // Cruzar datos - SOLO incluir estudiantes que están EN AMBAS tablas
            const estudiantesCruzados: EstudianteFUASCruce[] = []
            datosMinisterio.forEach(dm => {
                const datosInst = mapaInstituto.get(dm.rut)
                // Solo agregar si existe en el instituto (cruce real)
                if (datosInst) {
                    estudiantesCruzados.push({
                        rut: dm.rut,
                        nombre: datosInst.nombre || '',
                        correo: datosInst.correo || '',
                        carrera: datosInst.carrera || null,
                        origen: datosInst.sede || null,
                        tipo_beneficio: dm.tipo || null,
                        debe_postular: true,
                        fecha_cruce: new Date().toISOString()
                    })
                }
            })

            if (estudiantesCruzados.length === 0) {
                toast.advertencia('No se encontraron coincidencias entre el ministerio y el instituto')
                return
            }

            setEstudiantesFUAS(estudiantesCruzados)
            setPaginaActual(1) // Reset a primera página

            toast.exito(`${estudiantesCruzados.length} estudiantes matriculados que deben postular`)

        } catch (error) {
            console.error('Error cargando pendientes:', error)
            toast.error('Error al cargar estudiantes')
        }
    }

    // Toggle selección estudiante FUAS
    const toggleSeleccionFUAS = (rut: string) => {
        const nueva = new Set(seleccionadosFUAS)
        if (nueva.has(rut)) nueva.delete(rut)
        else nueva.add(rut)
        setSeleccionadosFUAS(nueva)
    }

    // Seleccionar todos los estudiantes FUAS con correo válido
    const seleccionarTodosFUAS = () => {
        const notificables = estudiantesFUAS.filter(e => e.correo)
        if (seleccionadosFUAS.size === notificables.length) {
            setSeleccionadosFUAS(new Set())
        } else {
            setSeleccionadosFUAS(new Set(notificables.map(e => e.rut)))
        }
    }

    // Enviar notificaciones a estudiantes FUAS seleccionados
    const handleEnviarNotificacionesFUAS = async () => {
        const estudiantesAEnviar = estudiantesFUAS.filter(e => seleccionadosFUAS.has(e.rut))
        if (estudiantesAEnviar.length === 0) return

        setEnviandoNotificacion(true)
        toast.info(`Enviando ${estudiantesAEnviar.length} correo(s)...`)

        try {
            const resultado = await enviarNotificacionesMasivas(
                estudiantesAEnviar.map(e => ({ rut: e.rut, nombre: e.nombre, correo: e.correo }))
            )

            if (resultado.exitosos > 0) {
                // Marcar como notificados en backend
                const rutsExitosos = estudiantesAEnviar.slice(0, resultado.exitosos).map(e => e.rut)
                await marcarNotificados(rutsExitosos)

                // Actualizar lista local
                setEstudiantesFUAS(prev => prev.map(e =>
                    rutsExitosos.includes(e.rut)
                        ? { ...e, notificacion_enviada: true }
                        : e
                ))
                setSeleccionadosFUAS(new Set())
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
        }
    }

    // Manejar subida de CSV (solo parseo, NO envía al servidor)
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
            } else {
                toast.exito(`✓ ${resultado.filasValidas} registros listos para cargar`)
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
                            <h1 className="text-xl font-semibold text-gray-900">Gestor de Becas</h1>
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
                <div className="grid grid-cols-4 gap-4 mb-8">
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
                    <div className={`rounded-lg p-4 border ${docsPendientes > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
                        <p className={`text-3xl font-bold ${docsPendientes > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                            {docsPendientes}
                        </p>
                        <p className="text-sm text-gray-500">Docs por Validar</p>
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
                        onClick={() => { setTabActivo('sincronizar'); handleVerificarBackend() }}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tabActivo === 'sincronizar'
                            ? 'border-emerald-600 text-emerald-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Acreditación
                    </button>
                    <button
                        onClick={() => { setTabActivo('fuas'); handleVerificarBackend() }}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tabActivo === 'fuas'
                            ? 'border-amber-600 text-amber-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        FUAS
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

                {/* Tab Gestión FUAS */}
                {tabActivo === 'sincronizar' && (
                    <div className="space-y-6">
                        {/* Estado del Backend */}
                        <Card>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Sincronizar con Instituto</h3>
                                    <p className="text-sm text-gray-500">
                                        Carga estudiantes matriculados desde la base de datos del instituto
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {backendDisponible === null ? (
                                        <Badge variant="default">Verificando...</Badge>
                                    ) : backendDisponible ? (
                                        <Badge variant="success">Backend conectado</Badge>
                                    ) : (
                                        <Badge variant="danger">Backend no disponible</Badge>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={handleSyncInstituto}
                                    loading={sincronizando}
                                    disabled={!backendDisponible}
                                >
                                    Sincronizar Estudiantes
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={handleCargarPendientes}
                                >
                                    Ver Pendientes
                                </Button>
                            </div>

                            {resultadoSync && (
                                <div className={`mt-4 p-3 rounded-lg ${resultadoSync.exitoso ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                    <p className="font-medium">{resultadoSync.mensaje}</p>
                                    {resultadoSync.total > 0 && (
                                        <p className="text-sm mt-1">{resultadoSync.total} estudiantes sincronizados</p>
                                    )}
                                </div>
                            )}
                        </Card>

                        {/* Subir CSV y Cruzar */}
                        <Card>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cruzar con Datos del Ministerio</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Sube el CSV del Ministerio y cruza con estudiantes matriculados
                            </p>

                            <FileUpload
                                onFileSelect={handleCSVUpload}
                                accept=".csv"
                                label="Archivo CSV del Ministerio"
                                descripcion="Formato: RUT;DV;FORMULARIO;OBSERVACION"
                                loading={procesandoCSV}
                            />

                            {resultadoCSV && resultadoCSV.datos.length > 0 && (
                                <div className="mt-4 space-y-3">
                                    <div className="p-3 bg-blue-50 rounded-lg">
                                        <p className="text-sm text-blue-800">
                                            ✓ {resultadoCSV.filasValidas} registros cargados del CSV
                                        </p>
                                    </div>
                                    <Button
                                        onClick={handleCruzarDatos}
                                        loading={cruzandoDatos}
                                        disabled={!backendDisponible}
                                    >
                                        Cruzar con Instituto
                                    </Button>
                                </div>
                            )}

                            {resultadoCruce && (
                                <div className={`mt-4 p-3 rounded-lg ${resultadoCruce.exitoso ? 'bg-green-50' : 'bg-red-50'}`}>
                                    <p className={`font-medium ${resultadoCruce.exitoso ? 'text-green-800' : 'text-red-800'}`}>
                                        {resultadoCruce.mensaje}
                                    </p>
                                    {resultadoCruce.noEncontrados > 0 && (
                                        <p className="text-sm text-gray-600 mt-1">
                                            {resultadoCruce.noEncontrados} RUTs del CSV no están en el instituto
                                        </p>
                                    )}
                                </div>
                            )}
                        </Card>

                        {/* Lista de Estudiantes FUAS */}
                        {estudiantesFUAS.length > 0 && (
                            <Card>
                                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                                    <div className="flex-1">
                                        <Input
                                            placeholder="Buscar por RUT, nombre o correo..."
                                            value={busquedaFUAS}
                                            onChange={(e) => {
                                                setBusquedaFUAS(e.target.value)
                                                setPaginaActual(1)  // Reset a página 1 al buscar
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            Estudiantes que deben Postular
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {estudiantesFUAS.length} estudiante(s) encontrado(s)
                                        </p>
                                    </div>
                                    <Button
                                        onClick={handleEnviarNotificacionesFUAS}
                                        disabled={seleccionadosFUAS.size === 0}
                                        loading={enviandoNotificacion}
                                    >
                                        Enviar Notificación ({seleccionadosFUAS.size})
                                    </Button>
                                </div>

                                {/* Seleccionar todos */}
                                <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={seleccionadosFUAS.size > 0 && seleccionadosFUAS.size === estudiantesFUAS.filter(e => e.correo).length}
                                            onChange={seleccionarTodosFUAS}
                                            className="w-4 h-4 text-emerald-600 rounded"
                                        />
                                        <span className="text-sm text-gray-600">
                                            Seleccionar todos con correo ({estudiantesFUAS.filter(e => e.correo).length} notificables)
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {estudiantesFUAS.filter(e => !e.correo).length} sin correo
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
                                                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">Carrera</th>
                                                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {estudiantesFUASFiltrados
                                                .slice((paginaActual - 1) * ESTUDIANTES_POR_PAGINA, paginaActual * ESTUDIANTES_POR_PAGINA)
                                                .map(est => (
                                                    <tr key={est.rut} className={`border-b border-gray-100 hover:bg-gray-50 ${!est.correo ? 'opacity-60' : ''}`}>
                                                        <td className="py-3 px-2">
                                                            {est.correo && (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={seleccionadosFUAS.has(est.rut)}
                                                                    onChange={() => toggleSeleccionFUAS(est.rut)}
                                                                    className="w-4 h-4 text-emerald-600 rounded"
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 font-mono text-sm">{est.rut}</td>
                                                        <td className="py-3 px-3 font-medium">{est.nombre || '-'}</td>
                                                        <td className="py-3 px-3 text-sm">
                                                            {est.correo ? (
                                                                <span className="text-gray-600">{est.correo}</span>
                                                            ) : (
                                                                <span className="text-red-400 italic">Sin correo</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 text-sm text-gray-600">{est.carrera || '-'}</td>
                                                        <td className="py-3 px-3">
                                                            {est.correo ? (
                                                                <Badge variant="warning">Pendiente</Badge>
                                                            ) : (
                                                                <Badge variant="danger">Sin correo</Badge>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Paginación */}
                                {estudiantesFUASFiltrados.length > ESTUDIANTES_POR_PAGINA && (
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                                        <span className="text-sm text-gray-500">
                                            Mostrando {((paginaActual - 1) * ESTUDIANTES_POR_PAGINA) + 1} - {Math.min(paginaActual * ESTUDIANTES_POR_PAGINA, estudiantesFUASFiltrados.length)} de {estudiantesFUASFiltrados.length}
                                            {busquedaFUAS && ` (filtrado de ${estudiantesFUAS.length} total)`}
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled={paginaActual === 1}
                                                onClick={() => setPaginaActual(p => p - 1)}
                                            >
                                                ← Anterior
                                            </Button>
                                            <span className="px-3 py-1 text-sm text-gray-600">
                                                Página {paginaActual} de {Math.ceil(estudiantesFUASFiltrados.length / ESTUDIANTES_POR_PAGINA)}
                                            </span>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled={paginaActual >= Math.ceil(estudiantesFUASFiltrados.length / ESTUDIANTES_POR_PAGINA)}
                                                onClick={() => setPaginaActual(p => p + 1)}
                                            >
                                                Siguiente →
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        )}
                    </div>
                )}

                {/* Tab FUAS - No Postulantes */}
                {tabActivo === 'fuas' && (
                    <div className="space-y-6">
                        {/* Subir CSV de Postulantes */}
                        <Card>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Detectar Estudiantes que NO Postularon</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Sube el CSV de postulantes FUAS nacionales. El sistema identificará qué estudiantes matriculados <strong>NO aparecen</strong> en ese listado.
                            </p>

                            <FileUpload
                                onFileSelect={async (archivo: File) => {
                                    const validacion = validarArchivoCSVFUAS(archivo)
                                    if (!validacion.valido) {
                                        toast.error(validacion.error || 'Archivo inválido')
                                        return
                                    }

                                    setProcesandoCSVFUAS(true)
                                    setResultadoCSVFUAS(null)
                                    toast.info('Leyendo archivo...')

                                    try {
                                        const contenido = await leerArchivoComoTexto(archivo)
                                        await new Promise(resolve => setTimeout(resolve, 100))

                                        toast.info('Parseando datos...')
                                        const resultado = parsearCSVPostulantesFUAS(contenido)
                                        setResultadoCSVFUAS(resultado)

                                        if (resultado.datos.length === 0) {
                                            toast.error('No se encontraron registros válidos')
                                            setProcesandoCSVFUAS(false)
                                            return
                                        }

                                        toast.exito(`✓ ${resultado.filasValidas} postulantes encontrados en el CSV`)
                                    } catch (error) {
                                        console.error('Error al procesar CSV:', error)
                                        toast.error('Error al procesar el archivo')
                                    } finally {
                                        setProcesandoCSVFUAS(false)
                                    }
                                }}
                                accept=".csv"
                                label="Archivo CSV de Postulantes FUAS"
                                descripcion="Formato: RUT;DV;POSTULACION"
                                loading={procesandoCSVFUAS}
                            />

                            {resultadoCSVFUAS && resultadoCSVFUAS.datos.length > 0 && (
                                <div className="mt-4 space-y-3">
                                    <div className="p-3 bg-blue-50 rounded-lg">
                                        <p className="text-sm text-blue-800">
                                            ✓ {resultadoCSVFUAS.filasValidas} postulantes cargados del CSV
                                        </p>
                                    </div>
                                    <Button
                                        onClick={async () => {
                                            if (!resultadoCSVFUAS || resultadoCSVFUAS.datos.length === 0) {
                                                toast.error('Primero debes cargar un archivo CSV')
                                                return
                                            }

                                            setDetectandoNoPostulantes(true)
                                            toast.info('Detectando estudiantes que no postularon...')

                                            try {
                                                const rutsPostulantes = resultadoCSVFUAS.datos.map(d => d.rut)
                                                const resultado = await detectarNoPostulantes(rutsPostulantes)

                                                setResultadoDeteccion(resultado)

                                                if (resultado.exitoso) {
                                                    setNoPostulantes(resultado.estudiantes)
                                                    setPaginaNP(1)
                                                    toast.exito(`${resultado.noPostularon} estudiantes NO postularon a FUAS`)
                                                } else {
                                                    toast.error(resultado.mensaje || 'Error al detectar')
                                                }
                                            } catch (error) {
                                                console.error('Error detectando:', error)
                                                toast.error('Error al procesar')
                                            } finally {
                                                setDetectandoNoPostulantes(false)
                                            }
                                        }}
                                        loading={detectandoNoPostulantes}
                                        disabled={!backendDisponible}
                                    >
                                        Detectar No Postulantes
                                    </Button>
                                </div>
                            )}

                            {resultadoDeteccion && (
                                <div className={`mt-4 p-3 rounded-lg ${resultadoDeteccion.exitoso ? 'bg-green-50' : 'bg-red-50'}`}>
                                    <p className={`font-medium ${resultadoDeteccion.exitoso ? 'text-green-800' : 'text-red-800'}`}>
                                        {resultadoDeteccion.mensaje}
                                    </p>
                                    {resultadoDeteccion.exitoso && (
                                        <div className="mt-2 text-sm text-gray-600">
                                            <p>Matriculados: {resultadoDeteccion.totalMatriculados}</p>
                                            <p>Postulantes: {resultadoDeteccion.totalPostulantes}</p>
                                            <p>No postularon: {resultadoDeteccion.noPostularon}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-4">
                                <Button
                                    variant="secondary"
                                    onClick={async () => {
                                        toast.info('Cargando estudiantes que no postularon...')
                                        const resultado = await getNoPostulantes()
                                        if (resultado.exitoso && resultado.estudiantes.length > 0) {
                                            setNoPostulantes(resultado.estudiantes)
                                            setPaginaNP(1)
                                            toast.exito(`${resultado.total} estudiantes que no postularon`)
                                        } else if (resultado.estudiantes.length === 0) {
                                            toast.advertencia('No hay registros guardados. Sube un CSV primero.')
                                        } else {
                                            toast.error('Error al cargar')
                                        }
                                    }}
                                >
                                    Ver No Postulantes Guardados
                                </Button>
                            </div>
                        </Card>

                        {/* Lista de No Postulantes */}
                        {noPostulantes.length > 0 && (
                            <Card>
                                <div className="flex flex-col gap-4 mb-6">
                                    {/* Búsqueda */}
                                    <div className="flex-1">
                                        <Input
                                            placeholder="Buscar por RUT, nombre o correo..."
                                            value={busquedaNP}
                                            onChange={(e) => {
                                                setBusquedaNP(e.target.value)
                                                setPaginaNP(1)
                                            }}
                                        />
                                    </div>

                                    {/* Filtros de Estado Documento */}
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => { setFiltroDocumento('todos'); setPaginaNP(1) }}
                                            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${filtroDocumento === 'todos'
                                                ? 'bg-gray-900 text-white border-gray-900'
                                                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                                                }`}
                                        >
                                            Todos ({noPostulantes.length})
                                        </button>
                                        <button
                                            onClick={() => { setFiltroDocumento('sin_doc'); setPaginaNP(1) }}
                                            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${filtroDocumento === 'sin_doc'
                                                ? 'bg-gray-600 text-white border-gray-600'
                                                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                                                }`}
                                        >
                                            Sin documento ({noPostulantes.filter(e => !e.documento_url).length})
                                        </button>
                                        <button
                                            onClick={() => { setFiltroDocumento('pendiente'); setPaginaNP(1) }}
                                            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${filtroDocumento === 'pendiente'
                                                ? 'bg-amber-500 text-white border-amber-500'
                                                : 'bg-white text-amber-600 border-amber-300 hover:border-amber-400'
                                                }`}
                                        >
                                            Por validar ({noPostulantes.filter(e => e.documento_url && (!e.documento_estado || e.documento_estado === 'pendiente')).length})
                                        </button>
                                        <button
                                            onClick={() => { setFiltroDocumento('validado'); setPaginaNP(1) }}
                                            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${filtroDocumento === 'validado'
                                                ? 'bg-green-500 text-white border-green-500'
                                                : 'bg-white text-green-600 border-green-300 hover:border-green-400'
                                                }`}
                                        >
                                            Validados ({noPostulantes.filter(e => e.documento_estado === 'validado').length})
                                        </button>
                                        <button
                                            onClick={() => { setFiltroDocumento('rechazado'); setPaginaNP(1) }}
                                            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${filtroDocumento === 'rechazado'
                                                ? 'bg-red-500 text-white border-red-500'
                                                : 'bg-white text-red-600 border-red-300 hover:border-red-400'
                                                }`}
                                        >
                                            Rechazados ({noPostulantes.filter(e => e.documento_estado === 'rechazado').length})
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            Estudiantes que NO Postularon
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {noPostulantesFiltrados.length} estudiante(s) - Envía recordatorios para que postulen
                                        </p>
                                    </div>
                                    <Button
                                        onClick={async () => {
                                            const estudiantesAEnviar = noPostulantes.filter(e =>
                                                seleccionadosNP.has(e.rut) && e.correo && !e.notificacion_enviada
                                            )
                                            if (estudiantesAEnviar.length === 0) {
                                                toast.advertencia('Selecciona estudiantes con correo para enviar')
                                                return
                                            }

                                            setEnviandoRecordatorio(true)
                                            toast.info(`Enviando ${estudiantesAEnviar.length} recordatorio(s)...`)

                                            try {
                                                const resultado = await enviarRecordatoriosMasivosFUAS(
                                                    estudiantesAEnviar.map(e => ({
                                                        rut: e.rut,
                                                        nombre: e.nombre || 'Estudiante',
                                                        correo: e.correo!
                                                    }))
                                                )

                                                if (resultado.exitosos > 0) {
                                                    const rutsExitosos = estudiantesAEnviar.slice(0, resultado.exitosos).map(e => e.rut)
                                                    await marcarNotificadosFUAS(rutsExitosos)

                                                    setNoPostulantes(prev => prev.map(e =>
                                                        rutsExitosos.includes(e.rut)
                                                            ? { ...e, notificacion_enviada: true }
                                                            : e
                                                    ))
                                                    setSeleccionadosNP(new Set())
                                                    toast.exito(`${resultado.exitosos} recordatorio(s) enviado(s)`)
                                                }

                                                if (resultado.fallidos > 0) {
                                                    toast.advertencia(`${resultado.fallidos} fallido(s)`)
                                                }
                                            } catch (error) {
                                                console.error('Error:', error)
                                                toast.error('Error al enviar recordatorios')
                                            } finally {
                                                setEnviandoRecordatorio(false)
                                            }
                                        }}
                                        disabled={seleccionadosNP.size === 0}
                                        loading={enviandoRecordatorio}
                                    >
                                        Enviar Recordatorio ({seleccionadosNP.size})
                                    </Button>
                                </div>

                                {/* Seleccionar todos */}
                                <div className="flex items-center justify-between mb-4 p-3 bg-amber-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={seleccionadosNP.size > 0 && seleccionadosNP.size === noPostulantes.filter(e => e.correo && !e.notificacion_enviada).length}
                                            onChange={() => {
                                                const notificables = noPostulantes.filter(e => e.correo && !e.notificacion_enviada)
                                                if (seleccionadosNP.size === notificables.length) {
                                                    setSeleccionadosNP(new Set())
                                                } else {
                                                    setSeleccionadosNP(new Set(notificables.map(e => e.rut)))
                                                }
                                            }}
                                            className="w-4 h-4 text-amber-600 rounded"
                                        />
                                        <span className="text-sm text-gray-600">
                                            Seleccionar todos pendientes ({noPostulantes.filter(e => e.correo && !e.notificacion_enviada).length})
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {noPostulantes.filter(e => !e.correo).length} sin correo |
                                        {noPostulantes.filter(e => e.notificacion_enviada).length} ya notificados
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
                                                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">Carrera</th>
                                                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                                                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">Documento</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {noPostulantesFiltrados
                                                .slice((paginaNP - 1) * ESTUDIANTES_POR_PAGINA, paginaNP * ESTUDIANTES_POR_PAGINA)
                                                .map(est => (
                                                    <tr key={est.rut} className={`border-b border-gray-100 hover:bg-gray-50 ${!est.correo ? 'opacity-60' : ''}`}>
                                                        <td className="py-3 px-2">
                                                            {est.correo && !est.notificacion_enviada && (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={seleccionadosNP.has(est.rut)}
                                                                    onChange={() => {
                                                                        const nueva = new Set(seleccionadosNP)
                                                                        if (nueva.has(est.rut)) nueva.delete(est.rut)
                                                                        else nueva.add(est.rut)
                                                                        setSeleccionadosNP(nueva)
                                                                    }}
                                                                    className="w-4 h-4 text-amber-600 rounded"
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 font-mono text-sm">{est.rut}</td>
                                                        <td className="py-3 px-3 font-medium">{est.nombre || '-'}</td>
                                                        <td className="py-3 px-3 text-sm">
                                                            {est.correo ? (
                                                                <span className="text-gray-600">{est.correo}</span>
                                                            ) : (
                                                                <span className="text-red-400 italic">Sin correo</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 text-sm text-gray-600">{est.carrera || '-'}</td>
                                                        <td className="py-3 px-3">
                                                            {est.notificacion_enviada ? (
                                                                <Badge variant="info">Notificado</Badge>
                                                            ) : est.correo ? (
                                                                <Badge variant="warning">Pendiente</Badge>
                                                            ) : (
                                                                <Badge variant="danger">Sin correo</Badge>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3">
                                                            {est.documento_url ? (
                                                                <div className="flex items-center gap-2">
                                                                    {est.documento_estado === 'validado' ? (
                                                                        <Badge variant="success">Validado</Badge>
                                                                    ) : est.documento_estado === 'rechazado' ? (
                                                                        <Badge variant="danger">Rechazado</Badge>
                                                                    ) : (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="secondary"
                                                                            onClick={() => setModalValidacion(est)}
                                                                        >
                                                                            Revisar
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-400 text-sm">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Paginación */}
                                {noPostulantesFiltrados.length > ESTUDIANTES_POR_PAGINA && (
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                                        <span className="text-sm text-gray-500">
                                            Mostrando {((paginaNP - 1) * ESTUDIANTES_POR_PAGINA) + 1} - {Math.min(paginaNP * ESTUDIANTES_POR_PAGINA, noPostulantesFiltrados.length)} de {noPostulantesFiltrados.length}
                                            {busquedaNP && ` (filtrado de ${noPostulantes.length} total)`}
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled={paginaNP === 1}
                                                onClick={() => setPaginaNP(p => p - 1)}
                                            >
                                                ← Anterior
                                            </Button>
                                            <span className="px-3 py-1 text-sm text-gray-600">
                                                Página {paginaNP} de {Math.ceil(noPostulantesFiltrados.length / ESTUDIANTES_POR_PAGINA)}
                                            </span>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled={paginaNP >= Math.ceil(noPostulantesFiltrados.length / ESTUDIANTES_POR_PAGINA)}
                                                onClick={() => setPaginaNP(p => p + 1)}
                                            >
                                                Siguiente →
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        )}
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
                                <Button size="sm" variant="secondary" onClick={() => {
                                    setDescripcionSesion('')
                                    setArchivoCompletarCita(null)
                                    setMostrarModalCompletar(true)
                                }}>
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

            {/* Modal Completar Cita con Documento */}
            <Modal
                isOpen={mostrarModalCompletar}
                onClose={() => setMostrarModalCompletar(false)}
                title="Completar Cita"
            >
                {citaSeleccionada && (
                    <div className="space-y-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="font-medium">{citaSeleccionada.estudiantes?.nombre}</p>
                            <p className="text-sm text-gray-500">RUT: {citaSeleccionada.estudiantes?.rut}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Descripción de la sesión *
                            </label>
                            <textarea
                                value={descripcionSesion}
                                onChange={(e) => setDescripcionSesion(e.target.value)}
                                placeholder="Describe lo realizado en la reunión..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[100px]"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Comprobante de postulación (PDF) *
                            </label>
                            {archivoCompletarCita ? (
                                <div className="flex items-center justify-between gap-2 p-3 bg-green-50 rounded-lg">
                                    <span className="text-sm text-green-800 truncate flex-1">
                                        ✓ {archivoCompletarCita.name}
                                    </span>
                                    <button
                                        onClick={() => setArchivoCompletarCita(null)}
                                        className="text-red-500 hover:text-red-700 flex-shrink-0"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            ) : (
                                <div
                                    onClick={() => document.getElementById('input-pdf-cita')?.click()}
                                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-emerald-500"
                                >
                                    <p className="text-sm text-gray-500">Click para seleccionar PDF</p>
                                    <input
                                        id="input-pdf-cita"
                                        type="file"
                                        accept=".pdf"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) {
                                                const validacion = validarArchivoPDF(file)
                                                if (validacion.valido) {
                                                    setArchivoCompletarCita(file)
                                                } else {
                                                    toast.error(validacion.error || 'Archivo inválido')
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button
                                variant="secondary"
                                onClick={() => setMostrarModalCompletar(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                loading={completandoCita}
                                disabled={!descripcionSesion.trim() || !archivoCompletarCita}
                                onClick={async () => {
                                    if (!citaSeleccionada || !archivoCompletarCita) return

                                    setCompletandoCita(true)
                                    toast.info('Subiendo documento...')

                                    try {
                                        // Subir PDF
                                        const resultadoUpload = await subirDocumentoCita(
                                            archivoCompletarCita,
                                            citaSeleccionada.id
                                        )

                                        if (!resultadoUpload.exitoso) {
                                            toast.error(resultadoUpload.error || 'Error al subir documento')
                                            return
                                        }

                                        // Actualizar cita en DB con estado, descripción y documento
                                        const { error: errorUpdate } = await supabase
                                            .from('citas')
                                            .update({
                                                estado: 'completada',
                                                descripcion_sesion: descripcionSesion,
                                                documento_url: resultadoUpload.url,
                                                fecha_documento: new Date().toISOString()
                                            })
                                            .eq('id', citaSeleccionada.id)

                                        if (errorUpdate) {
                                            toast.error('Error al actualizar cita')
                                            return
                                        }

                                        toast.exito('Cita completada con éxito')
                                        setMostrarModalCompletar(false)
                                        setMostrarModalCita(false)

                                        // Recargar citas
                                        if (user) {
                                            const hoy = await fetchCitasHoy(user.rut)
                                            setCitasHoy(hoy)
                                            const todas = await fetchCitasByAsistente(user.rut)
                                            setTodasCitas(todas)
                                        }
                                    } catch (error) {
                                        console.error('Error:', error)
                                        toast.error('Error al completar cita')
                                    } finally {
                                        setCompletandoCita(false)
                                    }
                                }}
                            >
                                Completar Cita
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal Validación Documento */}
            <Modal
                isOpen={!!modalValidacion}
                onClose={() => setModalValidacion(null)}
                title="Revisar Comprobante"
            >
                {modalValidacion && (
                    <div className="space-y-4">
                        {/* Info Estudiante */}
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="font-medium">{modalValidacion.nombre || 'Sin nombre'}</p>
                            <p className="text-sm text-gray-500">RUT: {modalValidacion.rut}</p>
                            <p className="text-sm text-gray-500">{modalValidacion.correo || 'Sin correo'}</p>
                        </div>

                        {/* Preview PDF */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Documento subido
                            </label>
                            <div className="border rounded-lg overflow-hidden bg-gray-100">
                                <iframe
                                    src={modalValidacion.documento_url || ''}
                                    className="w-full h-64"
                                    title="Preview PDF"
                                />
                            </div>
                            <a
                                href={modalValidacion.documento_url || ''}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                            >
                                Abrir en nueva pestaña ↗
                            </a>
                        </div>

                        {/* Acciones */}
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button
                                variant="danger"
                                loading={validandoDoc}
                                onClick={async () => {
                                    const comentario = prompt('Motivo del rechazo:')
                                    if (comentario === null) return

                                    setValidandoDoc(true)
                                    try {
                                        const { error } = await supabase
                                            .from('no_postularon_fuas')
                                            .update({
                                                documento_estado: 'rechazado',
                                                comentario_rechazo: comentario || 'Documento no válido'
                                            })
                                            .eq('rut', modalValidacion.rut)

                                        if (!error) {
                                            toast.advertencia('Documento rechazado')
                                            setModalValidacion(null)
                                            const res = await getNoPostulantes()
                                            if (res.exitoso) setNoPostulantes(res.estudiantes)
                                        }
                                    } finally {
                                        setValidandoDoc(false)
                                    }
                                }}
                            >
                                Rechazar
                            </Button>
                            <Button
                                loading={validandoDoc}
                                onClick={async () => {
                                    setValidandoDoc(true)
                                    try {
                                        const { error } = await supabase
                                            .from('no_postularon_fuas')
                                            .update({
                                                documento_estado: 'validado',
                                                validado_por: user?.rut
                                            })
                                            .eq('rut', modalValidacion.rut)

                                        if (!error) {
                                            toast.exito('Documento validado')
                                            setModalValidacion(null)
                                            const res = await getNoPostulantes()
                                            if (res.exitoso) setNoPostulantes(res.estudiantes)
                                        }
                                    } finally {
                                        setValidandoDoc(false)
                                    }
                                }}
                            >
                                Validar ✓
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
