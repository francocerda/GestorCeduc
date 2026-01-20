import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useStudents } from '../hooks/useStudents'
import { useCitas } from '../hooks/useCitas'
import { useToast } from '../components/ui/Toast'
import { api } from '../lib/api'
import { parsearCSVMinisterio, leerArchivoComoTexto, validarArchivoCSV, type ResultadoParseCSV } from '../lib/csvParserAcreditacion'
import { parsearCSVPostulantesFUAS, validarArchivoCSVFUAS, type ResultadoParseFUAS } from '../lib/csvParserFUAS'
import { parsearCSVPreseleccion, validarArchivoCSVPreseleccion, type ResultadoParsePreseleccion } from '../lib/csvParserPreseleccion'
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
    cruzarBeneficios,
    notificarBeneficiosMasivos,
    guardarCruceBeneficios,
    type EstudianteFUASCruce,
    type ResultadoSync,
    type ResultadoCruce,
    type NoPostulanteResult,
    type ResultadoDeteccion,
    type EstudianteConBeneficios,
    type ResultadoCruceBeneficios
} from '../lib/instituteApi'
import type { EstadoCita } from '../types/database'
import Badge, { getCitaStatusVariant, getCitaStatusLabel } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import FileUpload from '../components/ui/FileUpload'
import ScheduleEditor from '../components/features/ScheduleEditor'
import { StudentProfileModal } from '../components/features/StudentProfileModal'
import { RequestMeetingModal } from '../components/features/RequestMeetingModal'
import { validarArchivoPDF } from '../lib/storageService'

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
    const { contarEstudiantesPendientes } = useStudents()
    const { fetchCitasHoy, fetchCitasByAsistente, cambiarEstadoCita } = useCitas()

    // Estados
    const [citasHoy, setCitasHoy] = useState<CitaConEstudiante[]>([])
    const [todasCitas, setTodasCitas] = useState<CitaConEstudiante[]>([])
    const [pendientesCount, setPendientesCount] = useState(0)
    const [tabActivo, setTabActivo] = useState<'estudiantes' | 'citas' | 'sincronizar' | 'fuas' | 'beneficios' | 'horario'>('estudiantes')
    const [cargando, setCargando] = useState(true)

    // Horario del asistente
    const [miHorario, setMiHorario] = useState<import('../types/database').HorarioAtencion | null>(null)
    const [miSede, setMiSede] = useState<string>('')
    const [sedesDisponibles, setSedesDisponibles] = useState<string[]>([])
    const [cargandoHorario, setCargandoHorario] = useState(false)
    
    // Filtro por sede en documentos
    const [filtroSede, setFiltroSede] = useState<string>('todas')

    // ========== DIRECTORIO ESTUDIANTES (Nuevo) ==========
    interface EstudianteDirectorio {
        rut: string;
        nombre: string;
        correo: string;
        telefono: string | null;
        sede: string;
        carrera: string | null;
        estado_fuas: string | null;
        tipo_beneficio: string | null;
        ultima_cita: string | null;
        total_citas: number;
    }
    const [directorio, setDirectorio] = useState<EstudianteDirectorio[]>([])
    const [directorioTotal, setDirectorioTotal] = useState(0)
    const [directorioCargando, setDirectorioCargando] = useState(false)
    const [directorioBusqueda, setDirectorioBusqueda] = useState('')
    const [directorioSede, setDirectorioSede] = useState<string>('todas')
    const [directorioEstado, setDirectorioEstado] = useState<string>('todos')
    const [directorioPagina, setDirectorioPagina] = useState(1)
    const DIRECTORIO_POR_PAGINA = 20

    // Modales de perfil y solicitud reunión
    const [estudianteSeleccionadoPerfil, setEstudianteSeleccionadoPerfil] = useState<string | null>(null)
    const [mostrarPerfilModal, setMostrarPerfilModal] = useState(false)
    const [estudianteParaReunion, setEstudianteParaReunion] = useState<{ rut: string; nombre: string; correo: string } | null>(null)
    const [mostrarReunionModal, setMostrarReunionModal] = useState(false)

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

    // Notificaciones
    const [enviandoNotificacion, setEnviandoNotificacion] = useState(false)

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
    const docsPendientes = noPostulantes.filter(e => e.documento_url && e.estado === 'documento_pendiente').length

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
            case 'sin_doc': return !est.documento_url && est.estado === 'no_postulo'
            case 'pendiente': return est.estado === 'documento_pendiente'
            case 'validado': return est.estado === 'documento_validado'
            case 'rechazado': return est.estado === 'documento_rechazado'
            default: return true
        }
    }).filter(est => {
        // Filtro por sede
        if (filtroSede === 'todas') return true
        if (filtroSede === 'mi_sede') return est.sede === miSede
        return est.sede === filtroSede
    })

    // ========== BENEFICIOS (Preselección) ==========
    const [procesandoCSVBeneficios, setProcesandoCSVBeneficios] = useState(false)
    const [resultadoCSVBeneficios, setResultadoCSVBeneficios] = useState<ResultadoParsePreseleccion | null>(null)
    const [cruzandoBeneficios, setCruzandoBeneficios] = useState(false)
    const [resultadoCruceBeneficios, setResultadoCruceBeneficios] = useState<ResultadoCruceBeneficios | null>(null)
    const [estudiantesConBeneficios, setEstudiantesConBeneficios] = useState<EstudianteConBeneficios[]>([])
    const [seleccionadosBeneficios, setSeleccionadosBeneficios] = useState<Set<string>>(new Set())
    const [paginaBeneficios, setPaginaBeneficios] = useState(1)
    const [busquedaBeneficios, setBusquedaBeneficios] = useState('')
    const [enviandoNotificacionBeneficios, setEnviandoNotificacionBeneficios] = useState(false)
    const [filtroBeneficio, setFiltroBeneficio] = useState<string>('todos')
    const BENEFICIOS_POR_PAGINA = 30

    // Filtrar estudiantes con beneficios
    const estudiantesBeneficiosFiltrados = estudiantesConBeneficios.filter(est => {
        // Filtro de búsqueda
        if (busquedaBeneficios.trim()) {
            const termino = busquedaBeneficios.toLowerCase().trim()
            const coincide = est.rut.toLowerCase().includes(termino) ||
                (est.nombre && est.nombre.toLowerCase().includes(termino)) ||
                (est.correo && est.correo.toLowerCase().includes(termino))
            if (!coincide) return false
        }
        // Filtro por tipo de beneficio
        if (filtroBeneficio !== 'todos') {
            const tieneBeneficio = est.beneficios.some(b => b.tipo === filtroBeneficio)
            if (!tieneBeneficio) return false
        }
        return true
    })

    // Paginación de beneficios
    const totalPaginasBeneficios = Math.ceil(estudiantesBeneficiosFiltrados.length / BENEFICIOS_POR_PAGINA)
    const estudiantesBeneficiosPaginados = estudiantesBeneficiosFiltrados.slice(
        (paginaBeneficios - 1) * BENEFICIOS_POR_PAGINA,
        paginaBeneficios * BENEFICIOS_POR_PAGINA
    )

    // ========== MODAL COMPLETAR CITA ==========
    const [mostrarModalCompletar, setMostrarModalCompletar] = useState(false)
    const [descripcionSesion, setDescripcionSesion] = useState('')
    const [archivoCompletarCita, setArchivoCompletarCita] = useState<File | null>(null)
    const [completandoCita, setCompletandoCita] = useState(false)

    // ========== MODAL CANCELAR CITA ==========
    const [mostrarModalCancelar, setMostrarModalCancelar] = useState(false)
    const [motivoCancelacion, setMotivoCancelacion] = useState('')
    const [cancelandoCita, setCancelandoCita] = useState(false)

    // Cargar datos
    useEffect(() => {
        const cargarDatos = async () => {
            if (!user) return

            try {
                const count = await contarEstudiantesPendientes()
                setPendientesCount(count)

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
    }, [user, contarEstudiantesPendientes, fetchCitasHoy, fetchCitasByAsistente])

    // ========== CARGAR DIRECTORIO ESTUDIANTES ==========
    const cargarDirectorio = async (resetPagina = false) => {
        setDirectorioCargando(true)
        try {
            const pagina = resetPagina ? 1 : directorioPagina
            if (resetPagina) setDirectorioPagina(1)

            const data = await api.getDirectorioEstudiantes({
                busqueda: directorioBusqueda.trim() || undefined,
                sede: directorioSede !== 'todas' ? directorioSede : undefined,
                estado: directorioEstado !== 'todos' ? directorioEstado : undefined,
                limite: DIRECTORIO_POR_PAGINA,
                offset: (pagina - 1) * DIRECTORIO_POR_PAGINA
            })

            setDirectorio(data.estudiantes as EstudianteDirectorio[])
            setDirectorioTotal(data.total)
        } catch (error) {
            console.error('Error cargando directorio:', error)
            toast.error('Error al cargar estudiantes')
        } finally {
            setDirectorioCargando(false)
        }
    }

    // Cargar sedes disponibles al iniciar
    useEffect(() => {
        const cargarSedes = async () => {
            try {
                const sedes = await api.getSedes()
                setSedesDisponibles(sedes)
            } catch (error) {
                console.error('Error cargando sedes:', error)
            }
        }
        cargarSedes()
    }, [])

    // Cargar directorio al entrar al tab
    useEffect(() => {
        if (tabActivo === 'estudiantes' && directorio.length === 0) {
            cargarDirectorio()
        }
    }, [tabActivo])

    // Cargar al cambiar filtros o página
    useEffect(() => {
        if (tabActivo === 'estudiantes') {
            cargarDirectorio()
        }
    }, [directorioPagina])

    // Manejar click en estudiante para ver perfil
    const handleVerPerfil = (rut: string) => {
        setEstudianteSeleccionadoPerfil(rut)
        setMostrarPerfilModal(true)
    }

    // Manejar solicitud de reunión desde el perfil
    const handleSolicitarReunionDesdePerfil = (estudiante: { rut: string; nombre: string; correo: string }) => {
        setMostrarPerfilModal(false)
        setEstudianteParaReunion(estudiante)
        setMostrarReunionModal(true)
    }

    // Manejar solicitud de reunión directa (desde tabla)
    const handleSolicitarReunionDirecta = (estudiante: EstudianteDirectorio) => {
        if (!estudiante.correo) {
            toast.error('Este estudiante no tiene correo registrado')
            return
        }
        setEstudianteParaReunion({
            rut: estudiante.rut,
            nombre: estudiante.nombre,
            correo: estudiante.correo
        })
        setMostrarReunionModal(true)
    }

    // Cargar horario y sedes al cambiar al tab de horario
    const cargarHorarioYSedes = async () => {
        if (!user) return
        setCargandoHorario(true)
        try {
            const [horarioData, sedesData] = await Promise.all([
                api.getHorarioAsistente(user.rut),
                api.getSedes()
            ])
            setMiHorario(horarioData.horario_atencion)
            setMiSede(horarioData.sede || '')
            setSedesDisponibles(sedesData)
        } catch (error) {
            console.error('Error cargando horario:', error)
            toast.error('Error al cargar configuración')
        } finally {
            setCargandoHorario(false)
        }
    }

    // Guardar horario
    const handleGuardarHorario = async (horario: import('../types/database').HorarioAtencion) => {
        if (!user) return
        try {
            await api.actualizarHorarioAsistente(user.rut, horario)
            setMiHorario(horario)
            toast.exito('Horario actualizado correctamente')
        } catch (error) {
            console.error('Error guardando horario:', error)
            toast.error('Error al guardar horario')
            throw error
        }
    }

    // Guardar sede
    const handleGuardarSede = async (sede: string) => {
        if (!user) return
        try {
            await api.actualizarSedeAsistente(user.rut, sede)
            setMiSede(sede)
            toast.exito('Sede actualizada')
        } catch (error) {
            console.error('Error guardando sede:', error)
            toast.error('Error al guardar sede')
        }
    }

    // Logout
    const handleLogout = () => {
        signOut()
        navigate('/login')
    }

    // Cambiar estado cita
    const handleCambiarEstado = async (id: string, nuevoEstado: EstadoCita, motivo?: string) => {
        // Si es cancelar, abrir modal para pedir motivo
        if (nuevoEstado === 'cancelada' && !motivo) {
            setMostrarModalCancelar(true)
            return
        }
        
        const exito = await cambiarEstadoCita(id, nuevoEstado, motivo)
        if (exito && user) {
            const mensajes: Record<EstadoCita, string> = {
                confirmada: 'Cita confirmada',
                completada: 'Cita completada',
                cancelada: 'Cita cancelada. Se notificará al estudiante por correo.',
                pendiente: 'Cita actualizada'
            }
            toast.exito(mensajes[nuevoEstado])

            const citasHoyData = await fetchCitasHoy(user.rut)
            setCitasHoy(citasHoyData as CitaConEstudiante[])
            const todasData = await fetchCitasByAsistente(user.rut)
            setTodasCitas(todasData as CitaConEstudiante[])
            setMostrarModalCita(false)
            setMostrarModalCancelar(false)
            setMotivoCancelacion('')
        } else {
            toast.error('Error al actualizar')
        }
    }

    // Confirmar cancelación de cita con motivo
    const handleConfirmarCancelacion = async () => {
        if (!citaSeleccionada) return
        setCancelandoCita(true)
        try {
            await handleCambiarEstado(citaSeleccionada.id, 'cancelada', motivoCancelacion || undefined)
        } finally {
            setCancelandoCita(false)
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

    // Cargar estudiantes pendientes desde PostgreSQL (gestion_fuas)
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

            // Obtener datos del ministerio y del instituto via API
            const [datosMinisterio, datosInstituto] = await Promise.all([
                api.getDatosMinisterio(),
                api.getDatosInstituto()
            ])

            if (!datosMinisterio || datosMinisterio.length === 0) {
                toast.advertencia('No hay datos del ministerio cargados')
                return
            }

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
                        sede: datosInst.sede || null,
                        origen: 'acreditacion',
                        estado: null,
                        tipo_beneficio: dm.tipo || null,
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
            const resultado = await api.enviarNotificacionesMasivas(
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
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 backdrop-blur-sm bg-white/95">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Gestor de Becas</h1>
                            <p className="text-xs text-slate-400 tracking-wide uppercase">Asuntos Estudiantiles</p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <p className="text-sm font-medium text-slate-700">{user?.nombre}</p>
                                <p className="text-xs text-slate-400">Asistente Social</p>
                            </div>
                            <button 
                                onClick={handleLogout}
                                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                            >
                                Cerrar sesión
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main id="main-content" className="max-w-7xl mx-auto px-6 py-8">
                {/* Estadísticas */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Pendientes</p>
                        <p className="text-3xl font-bold text-slate-900">{pendientesCount}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Citas hoy</p>
                        <p className="text-3xl font-bold text-slate-900">{citasPendientesHoy.length}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Completadas</p>
                        <p className="text-3xl font-bold text-slate-900">
                            {todasCitas.filter(c => c.estado === 'completada').length}
                        </p>
                    </div>
                    <div className={`rounded-2xl p-5 border shadow-sm hover:shadow-md transition-shadow ${docsPendientes > 0 ? 'bg-amber-50/80 border-amber-200/60' : 'bg-white border-slate-200/60'}`}>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Por validar</p>
                        <p className={`text-3xl font-bold ${docsPendientes > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                            {docsPendientes}
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2 mb-8 p-1.5 bg-slate-100 rounded-xl w-fit">
                    <button
                        onClick={() => setTabActivo('estudiantes')}
                        className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                            tabActivo === 'estudiantes'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                    >
                        Estudiantes
                    </button>
                    <button
                        onClick={() => setTabActivo('citas')}
                        className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                            tabActivo === 'citas'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                    >
                        Citas
                    </button>
                    <button
                        onClick={() => { setTabActivo('sincronizar'); handleVerificarBackend() }}
                        className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                            tabActivo === 'sincronizar'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                    >
                        Acreditación
                    </button>
                    <button
                        onClick={() => { setTabActivo('fuas'); handleVerificarBackend() }}
                        className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                            tabActivo === 'fuas'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                    >
                        FUAS
                    </button>
                    <button
                        onClick={() => { setTabActivo('beneficios'); handleVerificarBackend() }}
                        className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                            tabActivo === 'beneficios'
                                ? 'bg-violet-500 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                    >
                        Beneficios
                    </button>
                    <button
                        onClick={() => { setTabActivo('horario'); cargarHorarioYSedes() }}
                        className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                            tabActivo === 'horario'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                    >
                        Mi Horario
                    </button>
                </div>

                {/* Tab Estudiantes - Directorio Completo */}
                {tabActivo === 'estudiantes' && (
                    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b border-slate-100">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">Directorio de Estudiantes</h2>
                                <p className="text-sm text-slate-400 mt-0.5">
                                    {directorioTotal} registros
                                </p>
                            </div>
                            <button
                                onClick={() => cargarDirectorio(true)}
                                disabled={directorioCargando}
                                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-all"
                            >
                                Actualizar
                            </button>
                        </div>

                        {/* Filtros */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-slate-50/50 border-b border-slate-100">
                            {/* Búsqueda */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Buscar</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="RUT, nombre o correo..."
                                        value={directorioBusqueda}
                                        onChange={(e) => setDirectorioBusqueda(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && cargarDirectorio(true)}
                                        className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                                    />
                                    <button 
                                        onClick={() => cargarDirectorio(true)}
                                        className="px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                                    >
                                        Buscar
                                    </button>
                                </div>
                            </div>

                            {/* Filtro Sede */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Sede</label>
                                <select
                                    value={directorioSede}
                                    onChange={(e) => {
                                        setDirectorioSede(e.target.value)
                                        setDirectorioPagina(1)
                                        setTimeout(() => cargarDirectorio(true), 0)
                                    }}
                                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white transition-all"
                                >
                                    <option value="todas">Todas las sedes</option>
                                    {sedesDisponibles.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro Estado */}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Estado FUAS</label>
                                <select
                                    value={directorioEstado}
                                    onChange={(e) => {
                                        setDirectorioEstado(e.target.value)
                                        setDirectorioPagina(1)
                                        setTimeout(() => cargarDirectorio(true), 0)
                                    }}
                                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white transition-all"
                                >
                                    <option value="todos">Todos los estados</option>
                                    <option value="pendiente">Pendiente</option>
                                    <option value="documento_validado">Doc. Validado</option>
                                    <option value="documento_pendiente">Doc. Pendiente</option>
                                    <option value="documento_rechazado">Doc. Rechazado</option>
                                    <option value="no_postulo">No postuló</option>
                                </select>
                            </div>
                        </div>

                        {/* Tabla de Estudiantes */}
                        <div className="overflow-x-auto">
                            {directorioCargando ? (
                                <div className="flex flex-col justify-center items-center py-16">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-slate-900"></div>
                                    <span className="mt-4 text-sm text-slate-400">Cargando...</span>
                                </div>
                            ) : directorio.length === 0 ? (
                                <div className="text-center py-16">
                                    <p className="text-slate-400 text-sm">No se encontraron estudiantes</p>
                                    <p className="text-slate-300 text-xs mt-1">Intenta con otros filtros</p>
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="text-left py-4 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Estudiante</th>
                                            <th className="text-left py-4 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Contacto</th>
                                            <th className="text-left py-4 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Sede</th>
                                            <th className="text-left py-4 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Estado</th>
                                            <th className="text-center py-4 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Citas</th>
                                            <th className="text-center py-4 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider w-32">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {directorio.map((est) => (
                                            <tr 
                                                key={est.rut} 
                                                className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                                onClick={() => handleVerPerfil(est.rut)}
                                            >
                                                <td className="py-4 px-6">
                                                    <div>
                                                        <p className="font-medium text-slate-800 group-hover:text-slate-900">{est.nombre}</p>
                                                        <p className="text-xs text-slate-400 font-mono mt-0.5">{est.rut}</p>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="text-sm">
                                                        <p className="text-slate-600 truncate max-w-[200px]">{est.correo || <span className="text-slate-300">Sin correo</span>}</p>
                                                        {est.telefono && <p className="text-xs text-slate-400 mt-0.5">{est.telefono}</p>}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-xs font-medium text-slate-600">
                                                        {est.sede || '—'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6">
                                                    {est.estado_fuas ? (
                                                        <Badge 
                                                            variant={
                                                                est.estado_fuas.includes('validado') ? 'success' :
                                                                est.estado_fuas.includes('pendiente') ? 'warning' :
                                                                est.estado_fuas.includes('rechazado') ? 'danger' :
                                                                'default'
                                                            }
                                                        >
                                                            {est.estado_fuas.replace(/_/g, ' ')}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-slate-300">—</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex flex-col items-center">
                                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-sm font-semibold text-slate-700 border border-slate-200">
                                                            {est.total_citas}
                                                        </span>
                                                        {est.ultima_cita && (
                                                            <p className="text-[10px] text-slate-400 mt-1 whitespace-nowrap">
                                                                {new Date(est.ultima_cita).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                                                            </p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex justify-center items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => handleVerPerfil(est.rut)}
                                                            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-all"
                                                        >
                                                            Ver perfil
                                                        </button>
                                                        {est.correo && (
                                                            <button
                                                                onClick={() => handleSolicitarReunionDirecta(est)}
                                                                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-all"
                                                            >
                                                                Citar
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Paginación */}
                        {directorioTotal > DIRECTORIO_POR_PAGINA && (
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-6 border-t border-slate-100">
                                <p className="text-sm text-slate-400">
                                    Mostrando <span className="font-medium text-slate-700">{((directorioPagina - 1) * DIRECTORIO_POR_PAGINA) + 1}</span> - <span className="font-medium text-slate-700">{Math.min(directorioPagina * DIRECTORIO_POR_PAGINA, directorioTotal)}</span> de <span className="font-medium text-slate-700">{directorioTotal}</span>
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setDirectorioPagina(p => Math.max(1, p - 1))}
                                        disabled={directorioPagina === 1 || directorioCargando}
                                        className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Anterior
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {[...Array(Math.min(5, Math.ceil(directorioTotal / DIRECTORIO_POR_PAGINA)))].map((_, idx) => {
                                            const totalPaginas = Math.ceil(directorioTotal / DIRECTORIO_POR_PAGINA);
                                            let pagina = idx + 1;
                                            
                                            if (totalPaginas > 5) {
                                                if (directorioPagina > 3) {
                                                    pagina = directorioPagina - 2 + idx;
                                                }
                                                if (directorioPagina > totalPaginas - 2) {
                                                    pagina = totalPaginas - 4 + idx;
                                                }
                                            }
                                            
                                            if (pagina < 1 || pagina > totalPaginas) return null;
                                            
                                            return (
                                                <button
                                                    key={pagina}
                                                    onClick={() => setDirectorioPagina(pagina)}
                                                    disabled={directorioCargando}
                                                    className={`w-9 h-9 text-sm font-medium rounded-lg transition-all ${
                                                        pagina === directorioPagina
                                                            ? 'bg-slate-900 text-white'
                                                            : 'text-slate-600 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {pagina}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        onClick={() => setDirectorioPagina(p => p + 1)}
                                        disabled={directorioPagina >= Math.ceil(directorioTotal / DIRECTORIO_POR_PAGINA) || directorioCargando}
                                        className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Citas */}
                {tabActivo === 'citas' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Citas de hoy */}
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h3 className="text-base font-semibold text-slate-900">Citas de Hoy</h3>
                                <p className="text-sm text-slate-400 mt-0.5">{citasPendientesHoy.length} pendiente(s)</p>
                            </div>
                            <div className="p-6">
                                {citasPendientesHoy.length > 0 ? (
                                    <div className="space-y-3">
                                        {citasPendientesHoy.map(cita => (
                                            <div
                                                key={cita.id}
                                                onClick={() => { setCitaSeleccionada(cita); setMostrarModalCita(true) }}
                                                className="p-4 bg-slate-50 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-medium text-slate-900">{cita.estudiantes?.nombre}</p>
                                                        <p className="text-sm text-slate-500 mt-0.5">{formatDateTime(cita.inicio)}</p>
                                                    </div>
                                                    <Badge variant={getCitaStatusVariant(cita.estado)}>
                                                        {getCitaStatusLabel(cita.estado)}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center py-8 text-slate-400">Sin citas para hoy</p>
                                )}
                            </div>
                        </div>

                        {/* Todas las citas */}
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h3 className="text-base font-semibold text-slate-900">Historial</h3>
                            </div>
                            <div className="p-6">
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {todasCitas.slice(0, 10).map(cita => (
                                        <div
                                            key={cita.id}
                                            onClick={() => { setCitaSeleccionada(cita); setMostrarModalCita(true) }}
                                            className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 px-2 rounded-lg"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">{cita.estudiantes?.nombre}</p>
                                                <p className="text-xs text-slate-400">{formatDateShort(cita.inicio)}</p>
                                            </div>
                                            <Badge variant={getCitaStatusVariant(cita.estado)}>
                                                {getCitaStatusLabel(cita.estado)}
                                            </Badge>
                                        </div>
                                    ))}
                                    {todasCitas.length === 0 && (
                                        <p className="text-center py-8 text-slate-400">Sin historial</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab Gestión FUAS */}
                {tabActivo === 'sincronizar' && (
                    <div className="space-y-6">
                        {/* Estado del Backend */}
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900">Sincronizar con Instituto</h3>
                                    <p className="text-sm text-slate-400 mt-0.5">
                                        Carga estudiantes matriculados desde la base de datos del instituto
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {backendDisponible === null ? (
                                        <Badge variant="default">Verificando...</Badge>
                                    ) : backendDisponible ? (
                                        <Badge variant="success">Conectado</Badge>
                                    ) : (
                                        <Badge variant="danger">No disponible</Badge>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleSyncInstituto}
                                    disabled={sincronizando || !backendDisponible}
                                    className="px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {sincronizando ? 'Sincronizando...' : 'Sincronizar Estudiantes'}
                                </button>
                                <button
                                    onClick={handleCargarPendientes}
                                    className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
                                >
                                    Ver Pendientes
                                </button>
                            </div>

                            {resultadoSync && (
                                <div className={`mt-4 p-4 rounded-xl ${resultadoSync.exitoso ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                                    <p className="font-medium">{resultadoSync.mensaje}</p>
                                    {resultadoSync.total > 0 && (
                                        <p className="text-sm mt-1">{resultadoSync.total} estudiantes sincronizados</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Subir CSV y Cruzar */}
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
                            <h3 className="text-base font-semibold text-slate-900 mb-1">Cruzar con Datos del Ministerio</h3>
                            <p className="text-sm text-slate-400 mb-6">
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
                                    <div className="p-4 bg-slate-50 rounded-xl">
                                        <p className="text-sm text-slate-700">
                                            {resultadoCSV.filasValidas} registros cargados del CSV
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleCruzarDatos}
                                        disabled={cruzandoDatos || !backendDisponible}
                                        className="px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {cruzandoDatos ? 'Cruzando...' : 'Cruzar con Instituto'}
                                    </button>
                                </div>
                            )}

                            {resultadoCruce && (
                                <div className={`mt-4 p-4 rounded-xl ${resultadoCruce.exitoso ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                    <p className={`font-medium ${resultadoCruce.exitoso ? 'text-emerald-800' : 'text-red-800'}`}>
                                        {resultadoCruce.mensaje}
                                    </p>
                                    {resultadoCruce.noEncontrados > 0 && (
                                        <p className="text-sm text-slate-600 mt-1">
                                            {resultadoCruce.noEncontrados} RUTs del CSV no están en el instituto
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Lista de Estudiantes FUAS */}
                        {estudiantesFUAS.length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100">
                                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                placeholder="Buscar por RUT, nombre o correo..."
                                                value={busquedaFUAS}
                                                onChange={(e) => {
                                                    setBusquedaFUAS(e.target.value)
                                                    setPaginaActual(1)
                                                }}
                                                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-base font-semibold text-slate-900">
                                                Estudiantes que deben Postular
                                            </h3>
                                            <p className="text-sm text-slate-400 mt-0.5">
                                                {estudiantesFUAS.length} estudiante(s) encontrado(s)
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleEnviarNotificacionesFUAS}
                                            disabled={seleccionadosFUAS.size === 0 || enviandoNotificacion}
                                            className="px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            {enviandoNotificacion ? 'Enviando...' : `Enviar Notificación (${seleccionadosFUAS.size})`}
                                        </button>
                                    </div>
                                </div>

                                {/* Seleccionar todos */}
                                <div className="flex items-center justify-between p-4 bg-slate-50/50">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={seleccionadosFUAS.size > 0 && seleccionadosFUAS.size === estudiantesFUAS.filter(e => e.correo).length}
                                            onChange={seleccionarTodosFUAS}
                                            className="w-4 h-4 text-slate-900 rounded border-slate-300"
                                        />
                                        <span className="text-sm text-slate-600">
                                            Seleccionar todos con correo ({estudiantesFUAS.filter(e => e.correo).length} notificables)
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        {estudiantesFUAS.filter(e => !e.correo).length} sin correo
                                    </span>
                                </div>

                                {/* Tabla */}
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-100">
                                                <th className="w-10 py-4 px-3"></th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">RUT</th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Nombre</th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Correo</th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Carrera</th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {estudiantesFUASFiltrados
                                                .slice((paginaActual - 1) * ESTUDIANTES_POR_PAGINA, paginaActual * ESTUDIANTES_POR_PAGINA)
                                                .map(est => (
                                                    <tr key={est.rut} className={`hover:bg-slate-50/80 transition-colors ${!est.correo ? 'opacity-60' : ''}`}>
                                                        <td className="py-4 px-3">
                                                            {est.correo && (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={seleccionadosFUAS.has(est.rut)}
                                                                    onChange={() => toggleSeleccionFUAS(est.rut)}
                                                                    className="w-4 h-4 text-slate-900 rounded border-slate-300"
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-4 font-mono text-sm text-slate-600">{est.rut}</td>
                                                        <td className="py-4 px-4 font-medium text-slate-900">{est.nombre || '-'}</td>
                                                        <td className="py-4 px-4 text-sm">
                                                            {est.correo ? (
                                                                <span className="text-slate-600">{est.correo}</span>
                                                            ) : (
                                                                <span className="text-slate-300">Sin correo</span>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-4 text-sm text-slate-600">{est.carrera || '-'}</td>
                                                        <td className="py-4 px-4">
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
                                    <div className="flex items-center justify-between p-6 border-t border-slate-100">
                                        <span className="text-sm text-slate-400">
                                            Mostrando {((paginaActual - 1) * ESTUDIANTES_POR_PAGINA) + 1} - {Math.min(paginaActual * ESTUDIANTES_POR_PAGINA, estudiantesFUASFiltrados.length)} de {estudiantesFUASFiltrados.length}
                                            {busquedaFUAS && ` (filtrado de ${estudiantesFUAS.length} total)`}
                                        </span>
                                        <div className="flex gap-2 items-center">
                                            <button
                                                disabled={paginaActual === 1}
                                                onClick={() => setPaginaActual(p => p - 1)}
                                                className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                            >
                                                Anterior
                                            </button>
                                            <span className="px-3 py-1 text-sm text-slate-600">
                                                {paginaActual} de {Math.ceil(estudiantesFUASFiltrados.length / ESTUDIANTES_POR_PAGINA)}
                                            </span>
                                            <button
                                                disabled={paginaActual >= Math.ceil(estudiantesFUASFiltrados.length / ESTUDIANTES_POR_PAGINA)}
                                                onClick={() => setPaginaActual(p => p + 1)}
                                                className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                            >
                                                Siguiente
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab FUAS - No Postulantes */}
                {tabActivo === 'fuas' && (
                    <div className="space-y-6">
                        {/* Subir CSV de Postulantes */}
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
                            <h3 className="text-base font-semibold text-slate-900 mb-1">Detectar Estudiantes que NO Postularon</h3>
                            <p className="text-sm text-slate-400 mb-6">
                                Sube el CSV de postulantes FUAS nacionales. El sistema identificará qué estudiantes matriculados no aparecen en ese listado.
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
                                    <div className="p-4 bg-slate-50 rounded-xl">
                                        <p className="text-sm text-slate-700">
                                            {resultadoCSVFUAS.filasValidas} postulantes cargados del CSV
                                        </p>
                                    </div>
                                    <button
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
                                        disabled={detectandoNoPostulantes || !backendDisponible}
                                        className="px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {detectandoNoPostulantes ? 'Detectando...' : 'Detectar No Postulantes'}
                                    </button>
                                </div>
                            )}

                            {resultadoDeteccion && (
                                <div className={`mt-4 p-4 rounded-xl ${resultadoDeteccion.exitoso ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                    <p className={`font-medium ${resultadoDeteccion.exitoso ? 'text-emerald-800' : 'text-red-800'}`}>
                                        {resultadoDeteccion.mensaje}
                                    </p>
                                    {resultadoDeteccion.exitoso && (
                                        <div className="mt-2 text-sm text-slate-600 space-y-1">
                                            <p>Matriculados: {resultadoDeteccion.totalMatriculados}</p>
                                            <p>Postulantes: {resultadoDeteccion.totalPostulantes}</p>
                                            <p>No postularon: {resultadoDeteccion.noPostularon}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-4">
                                <button
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
                                    className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
                                >
                                    Ver No Postulantes Guardados
                                </button>
                            </div>
                        </div>

                        {/* Lista de No Postulantes */}
                        {noPostulantes.length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100">
                                    <div className="flex flex-col gap-4">
                                        {/* Búsqueda */}
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                placeholder="Buscar por RUT, nombre o correo..."
                                                value={busquedaNP}
                                                onChange={(e) => {
                                                    setBusquedaNP(e.target.value)
                                                    setPaginaNP(1)
                                                }}
                                                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                                            />
                                        </div>

                                        {/* Filtros de Estado Documento */}
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => { setFiltroDocumento('todos'); setPaginaNP(1) }}
                                                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${filtroDocumento === 'todos'
                                                    ? 'bg-slate-900 text-white border-slate-900'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                                    }`}
                                            >
                                                Todos ({noPostulantes.length})
                                            </button>
                                            <button
                                                onClick={() => { setFiltroDocumento('sin_doc'); setPaginaNP(1) }}
                                                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${filtroDocumento === 'sin_doc'
                                                ? 'bg-slate-600 text-white border-slate-600'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            Sin documento ({noPostulantes.filter(e => !e.documento_url).length})
                                        </button>
                                        <button
                                            onClick={() => { setFiltroDocumento('pendiente'); setPaginaNP(1) }}
                                            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${filtroDocumento === 'pendiente'
                                                ? 'bg-amber-500 text-white border-amber-500'
                                                : 'bg-white text-amber-600 border-amber-200 hover:border-amber-300'
                                                }`}
                                        >
                                            Por validar ({noPostulantes.filter(e => e.estado === 'documento_pendiente').length})
                                        </button>
                                        <button
                                            onClick={() => { setFiltroDocumento('validado'); setPaginaNP(1) }}
                                            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${filtroDocumento === 'validado'
                                                ? 'bg-emerald-500 text-white border-emerald-500'
                                                : 'bg-white text-emerald-600 border-emerald-200 hover:border-emerald-300'
                                                }`}
                                        >
                                            Validados ({noPostulantes.filter(e => e.estado === 'documento_validado').length})
                                        </button>
                                        <button
                                            onClick={() => { setFiltroDocumento('rechazado'); setPaginaNP(1) }}
                                            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${filtroDocumento === 'rechazado'
                                                ? 'bg-red-500 text-white border-red-500'
                                                : 'bg-white text-red-600 border-red-200 hover:border-red-300'
                                                }`}
                                        >
                                            Rechazados ({noPostulantes.filter(e => e.estado === 'documento_rechazado').length})
                                        </button>
                                    </div>

                                    {/* Filtro por Sede */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-slate-500">Filtrar por sede:</span>
                                        <select
                                            value={filtroSede}
                                            onChange={(e) => { setFiltroSede(e.target.value); setPaginaNP(1) }}
                                            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                                        >
                                            <option value="todas">Todas las sedes</option>
                                            {miSede && <option value="mi_sede">Mi sede ({miSede})</option>}
                                            {[...new Set(noPostulantes.map(e => e.sede).filter((s): s is string => s !== null && s !== undefined))].sort().map(sede => (
                                                <option key={sede} value={sede}>{sede}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold text-slate-900">
                                            Estudiantes que NO Postularon
                                        </h3>
                                        <p className="text-sm text-slate-400 mt-0.5">
                                            {noPostulantesFiltrados.length} estudiante(s)
                                        </p>
                                    </div>
                                    <button
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
                                                const resultado = await api.enviarRecordatoriosMasivosFUAS(
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
                                        disabled={seleccionadosNP.size === 0 || enviandoRecordatorio}
                                        className="px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {enviandoRecordatorio ? 'Enviando...' : `Enviar Recordatorio (${seleccionadosNP.size})`}
                                    </button>
                                </div>
                                </div>

                                {/* Seleccionar todos */}
                                <div className="flex items-center justify-between p-4 bg-amber-50/50">
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
                                            className="w-4 h-4 text-slate-900 rounded border-slate-300"
                                        />
                                        <span className="text-sm text-slate-600">
                                            Seleccionar todos pendientes ({noPostulantes.filter(e => e.correo && !e.notificacion_enviada).length})
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        {noPostulantes.filter(e => !e.correo).length} sin correo |
                                        {noPostulantes.filter(e => e.notificacion_enviada).length} ya notificados
                                    </span>
                                </div>

                                {/* Tabla */}
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-100">
                                                <th className="w-10 py-4 px-3"></th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">RUT</th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Nombre</th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Correo</th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Carrera</th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Estado</th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Documento</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {noPostulantesFiltrados
                                                .slice((paginaNP - 1) * ESTUDIANTES_POR_PAGINA, paginaNP * ESTUDIANTES_POR_PAGINA)
                                                .map(est => (
                                                    <tr key={est.rut} className={`hover:bg-slate-50/80 transition-colors ${!est.correo ? 'opacity-60' : ''}`}>
                                                        <td className="py-4 px-3">
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
                                                                    className="w-4 h-4 text-slate-900 rounded border-slate-300"
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-4 font-mono text-sm text-slate-600">{est.rut}</td>
                                                        <td className="py-4 px-4 font-medium text-slate-900">{est.nombre || '-'}</td>
                                                        <td className="py-4 px-4 text-sm">
                                                            {est.correo ? (
                                                                <span className="text-slate-600">{est.correo}</span>
                                                            ) : (
                                                                <span className="text-slate-300">Sin correo</span>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-4 text-sm text-slate-600">{est.carrera || '-'}</td>
                                                        <td className="py-4 px-4">
                                                            {est.notificacion_enviada ? (
                                                                <Badge variant="info">Notificado</Badge>
                                                            ) : est.correo ? (
                                                                <Badge variant="warning">Pendiente</Badge>
                                                            ) : (
                                                                <Badge variant="danger">Sin correo</Badge>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-4">
                                                            {est.documento_url ? (
                                                                <div className="flex items-center gap-2">
                                                                    {est.estado === 'documento_validado' ? (
                                                                        <Badge variant="success">Validado</Badge>
                                                                    ) : est.estado === 'documento_rechazado' ? (
                                                                        <Badge variant="danger">Rechazado</Badge>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => setModalValidacion(est)}
                                                                            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
                                                                        >
                                                                            Revisar
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300 text-sm">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Paginación */}
                                {noPostulantesFiltrados.length > ESTUDIANTES_POR_PAGINA && (
                                    <div className="flex items-center justify-between p-6 border-t border-slate-100">
                                        <span className="text-sm text-slate-400">
                                            Mostrando {((paginaNP - 1) * ESTUDIANTES_POR_PAGINA) + 1} - {Math.min(paginaNP * ESTUDIANTES_POR_PAGINA, noPostulantesFiltrados.length)} de {noPostulantesFiltrados.length}
                                            {busquedaNP && ` (filtrado de ${noPostulantes.length} total)`}
                                        </span>
                                        <div className="flex gap-2 items-center">
                                            <button
                                                disabled={paginaNP === 1}
                                                onClick={() => setPaginaNP(p => p - 1)}
                                                className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                            >
                                                Anterior
                                            </button>
                                            <span className="px-3 py-1 text-sm text-slate-600">
                                                {paginaNP} de {Math.ceil(noPostulantesFiltrados.length / ESTUDIANTES_POR_PAGINA)}
                                            </span>
                                            <button
                                                disabled={paginaNP >= Math.ceil(noPostulantesFiltrados.length / ESTUDIANTES_POR_PAGINA)}
                                                onClick={() => setPaginaNP(p => p + 1)}
                                                className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                            >
                                                Siguiente
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Beneficios - Preselección */}
                {tabActivo === 'beneficios' && (
                    <div className="space-y-6">
                        {/* Card de carga de CSV */}
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
                            <div className="mb-6">
                                <h3 className="text-base font-semibold text-slate-900">Resultados de Preselección</h3>
                                <p className="text-sm text-slate-400 mt-0.5">
                                    Sube el archivo CSV con los resultados de preselección del Ministerio
                                </p>
                            </div>

                            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-6">
                                <h4 className="font-medium text-violet-900 mb-2">Formato esperado</h4>
                                <p className="text-sm text-violet-700 mb-2">
                                    El archivo debe contener las columnas de resultados de preselección con los beneficios asignados.
                                </p>
                                <div className="text-xs text-violet-600 bg-violet-100 p-2 rounded-lg font-mono overflow-x-auto">
                                    rut;dv;apellido_paterno;apellido_materno;nombres;GLOSA_GRATUIDAD;GLOSA_BVP;GLOSA_BB;GLOSA_BEA;...
                                </div>
                            </div>

                            <FileUpload
                                accept=".csv"
                                onFileSelect={async (file) => {
                                    const validacion = validarArchivoCSVPreseleccion(file)
                                    if (!validacion.valido) {
                                        toast.error(validacion.error || 'Archivo no válido')
                                        return
                                    }

                                    setProcesandoCSVBeneficios(true)
                                    setResultadoCSVBeneficios(null)
                                    setResultadoCruceBeneficios(null)
                                    setEstudiantesConBeneficios([])

                                    try {
                                        const contenido = await leerArchivoComoTexto(file)
                                        const resultado = parsearCSVPreseleccion(contenido)
                                        setResultadoCSVBeneficios(resultado)

                                        if (resultado.exitoso) {
                                            toast.exito(`CSV procesado: ${resultado.filasValidas} registros con beneficios`)
                                        } else {
                                            toast.error('Error al procesar CSV')
                                        }
                                    } catch (error) {
                                        console.error('Error procesando CSV:', error)
                                        toast.error('Error al leer el archivo')
                                    } finally {
                                        setProcesandoCSVBeneficios(false)
                                    }
                                }}
                                disabled={procesandoCSVBeneficios}
                            />

                            {procesandoCSVBeneficios && (
                                <div className="mt-4 flex items-center gap-2 text-violet-600">
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-violet-600 border-t-transparent"></div>
                                    <span className="text-sm">Procesando archivo...</span>
                                </div>
                            )}

                            {/* Resumen del CSV cargado */}
                            {resultadoCSVBeneficios?.exitoso && (
                                <div className="mt-6 bg-slate-50 rounded-xl p-5 border border-slate-200">
                                    <h4 className="font-medium text-slate-900 mb-4">Resumen del archivo</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                                            <p className="text-2xl font-bold text-slate-900">{resultadoCSVBeneficios.filasValidas}</p>
                                            <p className="text-xs text-slate-500">Total</p>
                                        </div>
                                        <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-center">
                                            <p className="text-2xl font-bold text-emerald-600">{resultadoCSVBeneficios.resumen.conGratuidad}</p>
                                            <p className="text-xs text-emerald-700">Gratuidad</p>
                                        </div>
                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-center">
                                            <p className="text-2xl font-bold text-blue-600">{resultadoCSVBeneficios.resumen.conBB}</p>
                                            <p className="text-xs text-blue-700">Bicentenario</p>
                                        </div>
                                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center">
                                            <p className="text-2xl font-bold text-amber-600">{resultadoCSVBeneficios.resumen.conBEA}</p>
                                            <p className="text-xs text-amber-700">BEA</p>
                                        </div>
                                        <div className="bg-cyan-50 p-3 rounded-lg border border-cyan-200 text-center">
                                            <p className="text-2xl font-bold text-cyan-600">{resultadoCSVBeneficios.resumen.conBNM}</p>
                                            <p className="text-xs text-cyan-700">Nuevo Milenio</p>
                                        </div>
                                    </div>

                                    <div className="mt-5 flex justify-end">
                                        <button
                                            onClick={async () => {
                                                if (!resultadoCSVBeneficios?.datos) return

                                                setCruzandoBeneficios(true)
                                                try {
                                                    const resultado = await cruzarBeneficios(resultadoCSVBeneficios.datos)
                                                    setResultadoCruceBeneficios(resultado)
                                                    
                                                    if (resultado.exito && resultado.estudiantes.length > 0) {
                                                        setEstudiantesConBeneficios(resultado.estudiantes)
                                                        toast.exito(`Cruce exitoso: ${resultado.estudiantes.length} estudiantes matriculados con beneficios`)
                                                        
                                                        await guardarCruceBeneficios(resultado.estudiantes)
                                                    } else if (resultado.estudiantes.length === 0) {
                                                        toast.advertencia('No se encontraron estudiantes matriculados con beneficios')
                                                    } else {
                                                        toast.error(resultado.error || 'Error en el cruce')
                                                    }
                                                } catch (error) {
                                                    console.error('Error en cruce:', error)
                                                    toast.error('Error al realizar el cruce')
                                                } finally {
                                                    setCruzandoBeneficios(false)
                                                }
                                            }}
                                            disabled={cruzandoBeneficios}
                                            className="px-4 py-2.5 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            {cruzandoBeneficios ? 'Cruzando...' : 'Cruzar con Matriculados'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Resultado del cruce */}
                        {resultadoCruceBeneficios?.exito && (
                            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-base font-semibold text-slate-900">
                                            Estudiantes Matriculados con Beneficios
                                        </h3>
                                        <p className="text-sm text-slate-400 mt-0.5">
                                            {estudiantesBeneficiosFiltrados.length} estudiantes encontrados
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => {
                                                if (seleccionadosBeneficios.size === estudiantesBeneficiosFiltrados.length) {
                                                    setSeleccionadosBeneficios(new Set())
                                                } else {
                                                    setSeleccionadosBeneficios(new Set(estudiantesBeneficiosFiltrados.map(e => e.rut)))
                                                }
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
                                        >
                                            {seleccionadosBeneficios.size === estudiantesBeneficiosFiltrados.length ? 'Deseleccionar' : 'Seleccionar'} todos
                                        </button>
                                        
                                        <button
                                            disabled={seleccionadosBeneficios.size === 0 || enviandoNotificacionBeneficios}
                                            onClick={async () => {
                                                const seleccionados = estudiantesConBeneficios.filter(e => seleccionadosBeneficios.has(e.rut))
                                                if (seleccionados.length === 0) return

                                                setEnviandoNotificacionBeneficios(true)
                                                try {
                                                    const resultado = await notificarBeneficiosMasivos(seleccionados, new Date().getFullYear())
                                                    
                                                    if (resultado.exito && resultado.enviados > 0) {
                                                        toast.exito(`${resultado.enviados} notificaciones enviadas`)
                                                        
                                                        setEstudiantesConBeneficios(prev => prev.map(e => 
                                                            seleccionadosBeneficios.has(e.rut) ? { ...e, notificado: true } : e
                                                        ))
                                                        setSeleccionadosBeneficios(new Set())
                                                    }
                                                    
                                                    if (resultado.fallidos > 0) {
                                                        toast.advertencia(`${resultado.fallidos} notificaciones fallaron`)
                                                    }
                                                } catch (error) {
                                                    console.error('Error notificando:', error)
                                                    toast.error('Error al enviar notificaciones')
                                                } finally {
                                                    setEnviandoNotificacionBeneficios(false)
                                                }
                                            }}
                                            className="px-4 py-2.5 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            {enviandoNotificacionBeneficios ? 'Enviando...' : `Notificar (${seleccionadosBeneficios.size})`}
                                        </button>
                                    </div>
                                </div>

                                {/* Filtros */}
                                <div className="flex flex-wrap gap-3 p-6 bg-slate-50/50 border-b border-slate-100">
                                    <input
                                        type="text"
                                        placeholder="Buscar por RUT, nombre o correo..."
                                        value={busquedaBeneficios}
                                        onChange={(e) => {
                                            setBusquedaBeneficios(e.target.value)
                                            setPaginaBeneficios(1)
                                        }}
                                        className="flex-1 min-w-[200px] px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                                    />
                                    <select
                                        value={filtroBeneficio}
                                        onChange={(e) => {
                                            setFiltroBeneficio(e.target.value)
                                            setPaginaBeneficios(1)
                                        }}
                                        className="px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white transition-all"
                                    >
                                        <option value="todos">Todos los beneficios</option>
                                        <option value="gratuidad">Gratuidad</option>
                                        <option value="bvp">BVP</option>
                                        <option value="bb">Bicentenario</option>
                                        <option value="bea">BEA</option>
                                        <option value="bjgm">BJGM</option>
                                        <option value="bnm">Nuevo Milenio</option>
                                        <option value="fscu">FSCU</option>
                                    </select>
                                </div>

                                {/* Tabla de estudiantes */}
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-100">
                                                <th className="py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider w-12">
                                                    <input
                                                        type="checkbox"
                                                        checked={seleccionadosBeneficios.size === estudiantesBeneficiosFiltrados.length && estudiantesBeneficiosFiltrados.length > 0}
                                                        onChange={() => {
                                                            if (seleccionadosBeneficios.size === estudiantesBeneficiosFiltrados.length) {
                                                                setSeleccionadosBeneficios(new Set())
                                                            } else {
                                                                setSeleccionadosBeneficios(new Set(estudiantesBeneficiosFiltrados.map(e => e.rut)))
                                                            }
                                                        }}
                                                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                                    />
                                                </th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">RUT</th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Nombre</th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Correo</th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Sede</th>
                                                <th className="text-left py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Beneficios</th>
                                                <th className="text-center py-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {estudiantesBeneficiosPaginados.map((est) => (
                                                <tr 
                                                    key={est.rut}
                                                    className={`hover:bg-slate-50/80 transition-colors ${
                                                        seleccionadosBeneficios.has(est.rut) ? 'bg-violet-50/50' : ''
                                                    }`}
                                                >
                                                    <td className="py-4 px-4">
                                                        <input
                                                            type="checkbox"
                                                            checked={seleccionadosBeneficios.has(est.rut)}
                                                            onChange={() => {
                                                                const nueva = new Set(seleccionadosBeneficios)
                                                                if (nueva.has(est.rut)) {
                                                                    nueva.delete(est.rut)
                                                                } else {
                                                                    nueva.add(est.rut)
                                                                }
                                                                setSeleccionadosBeneficios(nueva)
                                                            }}
                                                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                                        />
                                                    </td>
                                                    <td className="py-4 px-4 text-sm font-mono text-slate-600">{est.rut}</td>
                                                    <td className="py-4 px-4 text-sm font-medium text-slate-900">{est.nombre}</td>
                                                    <td className="py-4 px-4 text-sm text-slate-600">{est.correo}</td>
                                                    <td className="py-4 px-4 text-sm text-slate-600">{est.sede || '-'}</td>
                                                    <td className="py-4 px-4">
                                                        <div className="flex flex-wrap gap-1">
                                                            {est.beneficios.map((b, idx) => {
                                                                const colores: Record<string, string> = {
                                                                    gratuidad: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                                                    bvp: 'bg-purple-100 text-purple-700 border-purple-200',
                                                                    bb: 'bg-blue-100 text-blue-700 border-blue-200',
                                                                    bea: 'bg-amber-100 text-amber-700 border-amber-200',
                                                                    bdte: 'bg-teal-100 text-teal-700 border-teal-200',
                                                                    bjgm: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                                                                    bnm: 'bg-cyan-100 text-cyan-700 border-cyan-200',
                                                                    bhpe: 'bg-pink-100 text-pink-700 border-pink-200',
                                                                    fscu: 'bg-orange-100 text-orange-700 border-orange-200'
                                                                }
                                                                return (
                                                                    <span
                                                                        key={idx}
                                                                        className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colores[b.tipo] || 'bg-slate-100 text-slate-700'}`}
                                                                        title={b.detalle || b.tipo}
                                                                    >
                                                                        {b.tipo.toUpperCase()}
                                                                    </span>
                                                                )
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 text-center">
                                                        {est.notificado ? (
                                                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-full">
                                                                Notificado
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-500 bg-slate-100 rounded-full">
                                                                Pendiente
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Paginación */}
                                {totalPaginasBeneficios > 1 && (
                                    <div className="flex items-center justify-between p-6 border-t border-slate-100">
                                        <p className="text-sm text-slate-400">
                                            Mostrando {((paginaBeneficios - 1) * BENEFICIOS_POR_PAGINA) + 1} - {Math.min(paginaBeneficios * BENEFICIOS_POR_PAGINA, estudiantesBeneficiosFiltrados.length)} de {estudiantesBeneficiosFiltrados.length}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                disabled={paginaBeneficios <= 1}
                                                onClick={() => setPaginaBeneficios(p => p - 1)}
                                                className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                            >
                                                Anterior
                                            </button>
                                            <span className="px-3 py-1 text-sm text-slate-600">
                                                {paginaBeneficios} de {totalPaginasBeneficios}
                                            </span>
                                            <button
                                                disabled={paginaBeneficios >= totalPaginasBeneficios}
                                                onClick={() => setPaginaBeneficios(p => p + 1)}
                                                className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                            >
                                                Siguiente
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {estudiantesBeneficiosFiltrados.length === 0 && (
                                    <div className="text-center py-8 text-slate-400">
                                        <p>No se encontraron estudiantes con los filtros aplicados</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Info si no hay datos */}
                        {!resultadoCSVBeneficios && !cruzandoBeneficios && (
                            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8">
                                <div className="text-center">
                                    <h3 className="text-base font-semibold text-slate-900 mb-2">
                                        Gestión de Beneficios Estudiantiles
                                    </h3>
                                    <p className="text-sm text-slate-400 max-w-md mx-auto">
                                        Sube el archivo CSV de resultados de preselección del Ministerio de Educación
                                        para cruzarlo con tus estudiantes matriculados y notificarles sus beneficios.
                                    </p>
                                    <div className="mt-6 bg-violet-50 rounded-xl p-5 max-w-lg mx-auto text-left">
                                        <h4 className="font-medium text-violet-900 mb-3">Tipos de beneficios soportados</h4>
                                        <div className="grid grid-cols-2 gap-2 text-sm text-violet-700">
                                            <span>Gratuidad</span>
                                            <span>Beca Vocación de Profesor</span>
                                            <span>Beca Bicentenario</span>
                                            <span>Beca Excelencia Académica</span>
                                            <span>Beca Juan Gómez Millas</span>
                                            <span>Beca Nuevo Milenio</span>
                                            <span>FSCU</span>
                                            <span>Otros beneficios</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Mi Horario */}
                {tabActivo === 'horario' && (
                    <div className="space-y-6">
                        {/* Configuración de Sede */}
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
                            <h3 className="text-base font-semibold text-slate-900 mb-1">Mi Sede</h3>
                            <p className="text-sm text-slate-400 mb-4">
                                Configura la sede donde atiendes estudiantes.
                            </p>
                            
                            {cargandoHorario ? (
                                <div className="flex items-center justify-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-slate-900"></div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <select
                                        value={miSede}
                                        onChange={(e) => setMiSede(e.target.value)}
                                        className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white transition-all"
                                    >
                                        <option value="">Seleccionar sede...</option>
                                        {sedesDisponibles.map(sede => (
                                            <option key={sede} value={sede}>{sede}</option>
                                        ))}
                                        <option value="__nueva__">+ Agregar nueva sede</option>
                                    </select>
                                    {miSede === '__nueva__' && (
                                        <input
                                            type="text"
                                            placeholder="Nombre de la sede"
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    setMiSede(e.target.value)
                                                }
                                            }}
                                            onBlur={(e) => {
                                                if (e.target.value) {
                                                    setSedesDisponibles(prev => [...prev, e.target.value])
                                                }
                                            }}
                                            className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                                        />
                                    )}
                                    <button 
                                        onClick={() => handleGuardarSede(miSede)}
                                        disabled={!miSede || miSede === '__nueva__'}
                                        className="px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Guardar Sede
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Editor de Horarios */}
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
                            <h3 className="text-base font-semibold text-slate-900 mb-1">Horario de Atención Semanal</h3>
                            <p className="text-sm text-slate-400 mb-4">
                                Define los bloques horarios en los que estás disponible para atender citas cada día.
                            </p>
                            
                            {cargandoHorario ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-slate-900"></div>
                                    <span className="ml-3 text-slate-400">Cargando configuración...</span>
                                </div>
                            ) : (
                                <ScheduleEditor
                                    horarioInicial={miHorario}
                                    onSave={handleGuardarHorario}
                                    loading={cargandoHorario}
                                />
                            )}
                        </div>

                        {/* Info adicional */}
                        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
                            <h4 className="font-medium text-slate-900 mb-2">Información</h4>
                            <ul className="text-sm text-slate-600 space-y-1">
                                <li>Los estudiantes verán solo los horarios disponibles al agendar citas</li>
                                <li>Los cambios de horario no afectan a las citas ya agendadas</li>
                                <li>Puedes tener múltiples bloques por día (ej: mañana y tarde)</li>
                            </ul>
                        </div>
                    </div>
                )}
            </main>

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
                                <span className="text-slate-500">Estudiante</span>
                                <span className="font-medium text-slate-900">{citaSeleccionada.estudiantes?.nombre}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">RUT</span>
                                <span className="font-mono text-slate-700">{citaSeleccionada.estudiantes?.rut}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Fecha</span>
                                <span className="text-slate-700">{formatDateTime(citaSeleccionada.inicio)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Motivo</span>
                                <span className="text-slate-700">{citaSeleccionada.motivo}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Estado</span>
                                <Badge variant={getCitaStatusVariant(citaSeleccionada.estado)}>
                                    {getCitaStatusLabel(citaSeleccionada.estado)}
                                </Badge>
                            </div>
                        </div>

                        {(citaSeleccionada.estado === 'pendiente' || citaSeleccionada.estado === 'confirmada') && (
                            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                                {citaSeleccionada.estado === 'pendiente' && (
                                    <button 
                                        onClick={() => handleCambiarEstado(citaSeleccionada.id, 'confirmada')}
                                        className="px-3 py-1.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-all"
                                    >
                                        Confirmar
                                    </button>
                                )}
                                <button 
                                    onClick={() => {
                                        setDescripcionSesion('')
                                        setArchivoCompletarCita(null)
                                        setMostrarModalCompletar(true)
                                    }}
                                    className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
                                >
                                    Completar
                                </button>
                                <button 
                                    onClick={() => handleCambiarEstado(citaSeleccionada.id, 'cancelada')}
                                    className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-all"
                                >
                                    Cancelar
                                </button>
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
                        <div className="p-4 bg-slate-50 rounded-xl">
                            <p className="font-medium text-slate-900">{citaSeleccionada.estudiantes?.nombre}</p>
                            <p className="text-sm text-slate-500">RUT: {citaSeleccionada.estudiantes?.rut}</p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                                Descripción de la sesión
                            </label>
                            <textarea
                                value={descripcionSesion}
                                onChange={(e) => setDescripcionSesion(e.target.value)}
                                placeholder="Describe lo realizado en la reunión..."
                                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none min-h-[100px] transition-all"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                                Comprobante de postulación (PDF)
                            </label>
                            {archivoCompletarCita ? (
                                <div className="flex items-center justify-between gap-2 p-4 bg-emerald-50 rounded-xl">
                                    <span className="text-sm text-emerald-800 truncate flex-1">
                                        {archivoCompletarCita.name}
                                    </span>
                                    <button
                                        onClick={() => setArchivoCompletarCita(null)}
                                        className="text-sm text-red-500 hover:text-red-700"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            ) : (
                                <div
                                    onClick={() => document.getElementById('input-pdf-cita')?.click()}
                                    className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-slate-400 transition-colors"
                                >
                                    <p className="text-sm text-slate-500">Click para seleccionar PDF</p>
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

                        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => setMostrarModalCompletar(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                disabled={completandoCita || !descripcionSesion.trim() || !archivoCompletarCita}
                                onClick={async () => {
                                    if (!citaSeleccionada || !archivoCompletarCita) return

                                    setCompletandoCita(true)
                                    toast.info('Subiendo documento...')

                                    try {
                                        const resultadoUpload = await api.subirDocumentoCita(
                                            archivoCompletarCita,
                                            citaSeleccionada.id
                                        )

                                        if (!resultadoUpload.exitoso) {
                                            toast.error('Error al subir documento')
                                            return
                                        }

                                        const exitoUpdate = await api.updateCita(citaSeleccionada.id, {
                                            estado: 'completada',
                                            descripcion_sesion: descripcionSesion,
                                            documento_url: resultadoUpload.url,
                                            fecha_documento: new Date().toISOString()
                                        } as any)

                                        if (!exitoUpdate) {
                                            toast.error('Error al actualizar cita')
                                            return
                                        }

                                        toast.exito('Cita completada con éxito')
                                        setMostrarModalCompletar(false)
                                        setMostrarModalCita(false)

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
                                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {completandoCita ? 'Completando...' : 'Completar Cita'}
                            </button>
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
                        <div className="p-4 bg-slate-50 rounded-xl">
                            <p className="font-medium text-slate-900">{modalValidacion.nombre || 'Sin nombre'}</p>
                            <p className="text-sm text-slate-500">RUT: {modalValidacion.rut}</p>
                            <p className="text-sm text-slate-500">{modalValidacion.correo || 'Sin correo'}</p>
                        </div>

                        {/* Preview PDF */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                                Documento subido
                            </label>
                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100">
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
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button
                                disabled={validandoDoc}
                                onClick={async () => {
                                    const comentario = prompt('Motivo del rechazo:')
                                    if (comentario === null) return

                                    setValidandoDoc(true)
                                    try {
                                        const resultado = await api.validarDocumento(
                                            modalValidacion.rut,
                                            false,
                                            comentario || 'Documento no válido'
                                        )

                                        if (resultado.exitoso) {
                                            toast.advertencia('Documento rechazado')
                                            setModalValidacion(null)
                                            const res = await getNoPostulantes()
                                            if (res.exitoso) setNoPostulantes(res.estudiantes)
                                        }
                                    } finally {
                                        setValidandoDoc(false)
                                    }
                                }}
                                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-all"
                            >
                                {validandoDoc ? 'Procesando...' : 'Rechazar'}
                            </button>
                            <button
                                disabled={validandoDoc}
                                onClick={async () => {
                                    setValidandoDoc(true)
                                    try {
                                        const resultado = await api.validarDocumento(
                                            modalValidacion.rut,
                                            true,
                                            undefined,
                                            user?.rut
                                        )

                                        if (resultado.exitoso) {
                                            toast.exito('Documento validado')
                                            setModalValidacion(null)
                                            const res = await getNoPostulantes()
                                            if (res.exitoso) setNoPostulantes(res.estudiantes)
                                        }
                                    } finally {
                                        setValidandoDoc(false)
                                    }
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-all"
                            >
                                {validandoDoc ? 'Validando...' : 'Validar'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal Cancelar Cita */}
            <Modal
                isOpen={mostrarModalCancelar}
                onClose={() => {
                    setMostrarModalCancelar(false)
                    setMotivoCancelacion('')
                }}
                title="Cancelar Cita"
            >
                {citaSeleccionada && (
                    <div className="space-y-4">
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-red-800 text-sm">
                                Se enviará un correo automático al estudiante informando la cancelación.
                            </p>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl">
                            <p className="font-medium text-slate-900">{citaSeleccionada.estudiantes?.nombre}</p>
                            <p className="text-sm text-slate-500">RUT: {citaSeleccionada.estudiantes?.rut}</p>
                            <p className="text-sm text-slate-500">
                                Fecha: {formatDateTime(citaSeleccionada.inicio)}
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                                Motivo de cancelación (opcional)
                            </label>
                            <textarea
                                value={motivoCancelacion}
                                onChange={(e) => setMotivoCancelacion(e.target.value)}
                                placeholder="Ej: Reagendar para otra fecha, documentos faltantes..."
                                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none min-h-[80px] transition-all"
                            />
                            <p className="text-xs text-slate-400 mt-1">
                                Este motivo se incluirá en el correo enviado al estudiante.
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => {
                                    setMostrarModalCancelar(false)
                                    setMotivoCancelacion('')
                                }}
                                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
                            >
                                Volver
                            </button>
                            <button
                                disabled={cancelandoCita}
                                onClick={handleConfirmarCancelacion}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-all"
                            >
                                {cancelandoCita ? 'Cancelando...' : 'Confirmar Cancelación'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal Perfil Estudiante */}
            <StudentProfileModal
                isOpen={mostrarPerfilModal}
                onClose={() => {
                    setMostrarPerfilModal(false)
                    setEstudianteSeleccionadoPerfil(null)
                }}
                rutEstudiante={estudianteSeleccionadoPerfil}
                onRequestMeeting={(est) => handleSolicitarReunionDesdePerfil(est)}
            />

            {/* Modal Solicitar Reunión */}
            <RequestMeetingModal
                isOpen={mostrarReunionModal}
                onClose={() => {
                    setMostrarReunionModal(false)
                    setEstudianteParaReunion(null)
                }}
                estudiante={estudianteParaReunion}
                asistente={user ? { rut: user.rut, nombre: user.nombre, sede: miSede } : null}
                onSuccess={() => {
                    toast.exito('Solicitud de reunión enviada correctamente')
                }}
            />
        </div>
    )
}
