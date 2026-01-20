/**
 * Cliente API centralizado v2
 * Reemplaza llamadas directas a Supabase y unifica instituteApi
 */

import type {
    Estudiante,
    AsistenteSocial,
    Cita,
    GestionFUAS,
    DatosMinisterio,
    DatosInstituto,
    HorarioAtencion
} from '../types/database';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Tipos auxiliares importados de instituteApi logic
export interface ResultadoSync {
    exitoso: boolean;
    total: number;
    mensaje: string;
    error?: string;
}

export interface ResultadoCruce {
    exitoso: boolean;
    coincidencias: number;
    noEncontrados: number;
    estudiantes: GestionFUAS[];
    mensaje: string;
    error?: string;
}

export interface ResultadoDeteccion {
    exitoso: boolean;
    totalMatriculados: number;
    totalPostulantes: number;
    noPostularon: number;
    estudiantes: { rut: string; nombre: string }[];
    mensaje: string;
}

export interface FiltrosEstudiantes {
    busqueda?: string;
    debe_postular?: boolean;
    estado_fuas?: string;
    limite?: number;
    desplazamiento?: number;
}

export interface ResultadoCargaMinisterio {
    exitoso: boolean;
    totalGuardados: number;
    mensaje: string;
    error?: string;
}

export interface ResultadoSyncEstudiante {
    exitoso: boolean;
    estadoFuas: {
        estado: string;
        tipo_beneficio: string | null;
        carrera: string | null;
    } | null;
}

export const api = {
    // ==========================================
    // AUTENTICACIÓN (sync login)
    // ==========================================

    async syncAsistenteSocial(data: { rut: string; correo: string; nombre: string; roles: any[] }): Promise<{ exitoso: boolean }> {
        const res = await fetch(`${API_URL}/auth/sync-asistente`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Error sincronizando asistente social');
        return res.json();
    },

    async syncEstudiante(data: { rut: string; correo: string; nombre: string; roles: any[] }): Promise<ResultadoSyncEstudiante> {
        const res = await fetch(`${API_URL}/auth/sync-estudiante`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Error sincronizando estudiante');
        return res.json();
    },

    // ==========================================
    // GESTIÓN ADMINISTRATIVA (SocialWorkerPortal)
    // ==========================================

    async syncInstituto(): Promise<ResultadoSync> {
        const res = await fetch(`${API_URL}/sync-instituto`);
        if (!res.ok) throw new Error('Error en sincronización');
        return res.json();
    },

    async cargarDatosMinisterio(datos: any[]): Promise<ResultadoCargaMinisterio> {
        const res = await fetch(`${API_URL}/cargar-datos-ministerio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ datos })
        });
        if (!res.ok) throw new Error('Error cargando datos ministerio');
        return res.json();
    },

    async cruzarDatos(datosMinisterio: any[]): Promise<ResultadoCruce> {
        const res = await fetch(`${API_URL}/cruzar-datos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ datos_ministerio: datosMinisterio })
        });
        if (!res.ok) throw new Error('Error cruzando datos');
        return res.json();
    },

    async getPendientes(): Promise<{ exitoso: boolean; estudiantes: GestionFUAS[] }> {
        const res = await fetch(`${API_URL}/estudiantes-pendientes`);
        if (!res.ok) throw new Error('Error obteniendo pendientes');
        return res.json();
    },

    async detectarNoPostulantes(rutsPostulantes: string[]): Promise<ResultadoDeteccion> {
        const res = await fetch(`${API_URL}/detectar-no-postulantes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ruts_postulantes: rutsPostulantes })
        });
        if (!res.ok) throw new Error('Error detectando no postulantes');
        return res.json();
    },

    async getNoPostulantes(): Promise<{ exitoso: boolean; estudiantes: GestionFUAS[] }> {
        const res = await fetch(`${API_URL}/no-postulantes`);
        if (!res.ok) throw new Error('Error obteniendo no postulantes');
        return res.json();
    },

    async marcarNotificados(ruts: string[]) {
        const res = await fetch(`${API_URL}/marcar-notificado`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ruts })
        });
        if (!res.ok) throw new Error('Error marcando notificados');
        return res.json();
    },

    async marcarNotificadosFUAS(ruts: string[]) {
        const res = await fetch(`${API_URL}/marcar-notificado-fuas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ruts })
        });
        if (!res.ok) throw new Error('Error marcando notificados FUAS');
        return res.json();
    },

    // ==========================================
    // GESTIÓN ESTUDIANTES (useStudents)
    // ==========================================

    async getEstudiantes(filtros: FiltrosEstudiantes = {}): Promise<Estudiante[]> {
        const params = new URLSearchParams();
        if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
        if (filtros.debe_postular !== undefined) params.append('debe_postular', String(filtros.debe_postular));
        if (filtros.estado_fuas) params.append('estado_fuas', filtros.estado_fuas);
        if (filtros.limite) params.append('limit', String(filtros.limite));
        if (filtros.desplazamiento) params.append('offset', String(filtros.desplazamiento));

        const res = await fetch(`${API_URL}/estudiantes?${params.toString()}`);
        if (!res.ok) throw new Error('Error obteniendo estudiantes');
        return res.json();
    },

    async countEstudiantesPendientes(): Promise<number> {
        const res = await fetch(`${API_URL}/estudiantes/count/pendientes`);
        if (!res.ok) throw new Error('Error contando pendientes');
        const data = await res.json();
        return data.count;
    },

    async getInfoEstudiante(rut: string): Promise<Estudiante> {
        const res = await fetch(`${API_URL}/estudiantes/${rut}`);
        if (!res.ok) throw new Error('Error obteniendo estudiante');
        return res.json();
    },

    async updateEstudiante(rut: string, updates: Partial<Estudiante>): Promise<boolean> {
        const res = await fetch(`${API_URL}/estudiantes/${rut}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return res.ok;
    },

    async notificarEstudiantes(ruts: string[]): Promise<boolean> {
        const res = await fetch(`${API_URL}/estudiantes/notificar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ruts })
        });
        return res.ok;
    },

    // ==========================================
    // GESTIÓN ASISTENTES (useAsistentesSociales)
    // ==========================================

    async getAsistentesSociales(): Promise<AsistenteSocial[]> {
        const res = await fetch(`${API_URL}/asistentes-sociales`);
        if (!res.ok) throw new Error('Error obteniendo asistentes sociales');
        return res.json();
    },

    async getAsistente(rut: string): Promise<AsistenteSocial> {
        const res = await fetch(`${API_URL}/asistentes/${rut}`);
        if (!res.ok) throw new Error('Error obteniendo asistente');
        return res.json();
    },

    async getHorarioAsistente(rut: string): Promise<{ horario_atencion: HorarioAtencion | null; sede: string | null }> {
        const res = await fetch(`${API_URL}/asistentes/${rut}/horario`);
        if (!res.ok) throw new Error('Error obteniendo horario');
        return res.json();
    },

    async actualizarHorarioAsistente(rut: string, horario: HorarioAtencion): Promise<{ exitoso: boolean; horario_atencion: HorarioAtencion }> {
        const res = await fetch(`${API_URL}/asistentes/${rut}/horario`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ horario_atencion: horario })
        });
        if (!res.ok) throw new Error('Error actualizando horario');
        return res.json();
    },

    async actualizarSedeAsistente(rut: string, sede: string): Promise<{ exitoso: boolean; sede: string }> {
        const res = await fetch(`${API_URL}/asistentes/${rut}/sede`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sede })
        });
        if (!res.ok) throw new Error('Error actualizando sede');
        return res.json();
    },

    async getSedes(): Promise<string[]> {
        const res = await fetch(`${API_URL}/sedes`);
        if (!res.ok) throw new Error('Error obteniendo sedes');
        return res.json();
    },

    // ==========================================
    // GESTIÓN CITAS (useCitas)
    // ==========================================

    async crearCita(cita: Partial<Cita>): Promise<Cita> {
        const res = await fetch(`${API_URL}/citas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cita)
        });
        if (!res.ok) throw new Error('Error creando cita');
        return res.json();
    },

    async getCitasEstudiante(rut: string): Promise<any[]> {
        const res = await fetch(`${API_URL}/citas/estudiante/${rut}`);
        if (!res.ok) throw new Error('Error obteniendo citas estudiante');
        return res.json();
    },

    async getCitasAsistente(rut: string): Promise<any[]> {
        const res = await fetch(`${API_URL}/citas/asistente/${rut}`);
        if (!res.ok) throw new Error('Error obteniendo citas asistente');
        return res.json();
    },

    async getCitasHoyAsistente(rut: string): Promise<any[]> {
        const res = await fetch(`${API_URL}/citas/hoy/${rut}`);
        if (!res.ok) throw new Error('Error obteniendo citas de hoy');
        return res.json();
    },

    async updateCita(id: string, updates: Partial<Cita>): Promise<boolean> {
        const res = await fetch(`${API_URL}/citas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return res.ok;
    },

    async cancelarCita(id: string, motivo?: string): Promise<boolean> {
        const res = await fetch(`${API_URL}/citas/${id}/cancelar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ motivo })
        });
        return res.ok;
    },

    async getCitasRango(rutAsistente: string, inicio: string, fin: string): Promise<Cita[]> {
        const params = new URLSearchParams({ rut_asistente: rutAsistente, inicio, fin });
        const res = await fetch(`${API_URL}/citas/rango?${params.toString()}`);
        if (!res.ok) throw new Error('Error obteniendo citas en rango');
        return res.json();
    },

    // ==========================================
    // GESTIÓN FUAS 
    // ==========================================

    async getGestionFuas(rut: string): Promise<GestionFUAS | null> {
        const res = await fetch(`${API_URL}/gestion-fuas/${rut}`);
        if (!res.ok) throw new Error('Error obteniendo estado FUAS');
        return res.json();
    },

    async registrarDocumento(rut: string, url: string): Promise<void> {
        const res = await fetch(`${API_URL}/gestion-fuas/${rut}/documento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documento_url: url })
        });
        if (!res.ok) throw new Error('Error registrando documento');
        return res.json();
    },

    // Subir documento a Google Drive (nuevo)
    async subirDocumentoEstudiante(archivo: File, rut: string): Promise<{ exitoso: boolean; url: string; id: string }> {
        const formData = new FormData();
        formData.append('archivo', archivo);

        const res = await fetch(`${API_URL}/documentos/estudiante/${rut}`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Error subiendo documento');
        }
        return res.json();
    },

    // Subir documento de cita (asistente)
    async subirDocumentoCita(archivo: File, citaId: string): Promise<{ exitoso: boolean; url: string; id: string }> {
        const formData = new FormData();
        formData.append('archivo', archivo);

        const res = await fetch(`${API_URL}/citas/${citaId}/documento`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Error subiendo documento');
        }
        return res.json();
    },

    async getDatosMinisterio(): Promise<DatosMinisterio[]> {
        const res = await fetch(`${API_URL}/datos-ministerio`);
        if (!res.ok) throw new Error('Error obteniendo datos ministerio');
        return res.json();
    },

    async getDatosInstituto(): Promise<DatosInstituto[]> {
        const res = await fetch(`${API_URL}/datos-instituto`);
        if (!res.ok) throw new Error('Error obteniendo datos instituto');
        return res.json();
    },

    // ==========================================
    // Metodos Postgres
    // ==========================================

    async verificarCitaSemana(rut: string, fecha?: string): Promise<{ tieneCita: boolean; cantidad: number }> {
        const params = fecha ? `?fecha=${fecha}` : '';
        const res = await fetch(`${API_URL}/citas/verificar-semana/${rut}${params}`);
        if (!res.ok) throw new Error('Error verificando cita semanal');
        return res.json();
    },

    async validarDocumento(rut: string, validado: boolean, comentario?: string, validadoPor?: string): Promise<{ exitoso: boolean; estado: string }> {
        const res = await fetch(`${API_URL}/gestion-fuas/${rut}/validar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ validado, comentario, validado_por: validadoPor })
        });
        if (!res.ok) throw new Error('Error validando documento');
        return res.json();
    },

    async notificarEstudiantesTabla(ruts: string[]): Promise<boolean> {
        const res = await fetch(`${API_URL}/estudiantes/notificar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ruts })
        });
        return res.ok;
    },

    // ==========================================
    // SERVICIOS DE EMAIL (via Backend)
    // ==========================================

    /**
     * Envía notificaciones FUAS masivas a múltiples estudiantes
     */
    async enviarNotificacionesMasivas(
        estudiantes: Array<{ rut: string; nombre: string; correo: string }>
    ): Promise<{ exitosos: number; fallidos: number; resultados: Array<{ rut: string; exito: boolean; mensaje: string }> }> {
        const res = await fetch(`${API_URL}/email/notificaciones-masivas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estudiantes })
        });
        if (!res.ok) throw new Error('Error enviando notificaciones');
        return res.json();
    },

    /**
     * Envía recordatorios FUAS masivos a estudiantes que no han postulado
     */
    async enviarRecordatoriosMasivosFUAS(
        estudiantes: Array<{ rut: string; nombre: string; correo: string }>
    ): Promise<{ exitosos: number; fallidos: number; resultados: Array<{ rut: string; exito: boolean; mensaje: string }> }> {
        const res = await fetch(`${API_URL}/email/recordatorios-masivos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estudiantes })
        });
        if (!res.ok) throw new Error('Error enviando recordatorios');
        return res.json();
    },

    /**
     * Verifica conexión con el servicio de email
     */
    async verificarConexionEmail(): Promise<boolean> {
        try {
            const res = await fetch(`${API_URL}/email/verificar`);
            const data = await res.json();
            return data.conectado === true;
        } catch {
            return false;
        }
    },

    // ==========================================
    // DIRECTORIO ESTUDIANTES (Nueva funcionalidad)
    // ==========================================

    /**
     * Obtiene directorio completo de estudiantes con filtros
     */
    async getDirectorioEstudiantes(filtros: {
        busqueda?: string;
        sede?: string;
        estado?: string;
        limite?: number;
        offset?: number;
    } = {}): Promise<{
        estudiantes: Array<{
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
        }>;
        total: number;
        limite: number;
        offset: number;
    }> {
        const params = new URLSearchParams();
        if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
        if (filtros.sede) params.append('sede', filtros.sede);
        if (filtros.estado) params.append('estado', filtros.estado);
        if (filtros.limite) params.append('limite', String(filtros.limite));
        if (filtros.offset) params.append('offset', String(filtros.offset));

        const res = await fetch(`${API_URL}/estudiantes/directorio?${params.toString()}`);
        if (!res.ok) throw new Error('Error obteniendo directorio de estudiantes');
        return res.json();
    },

    /**
     * Obtiene perfil completo de un estudiante con historial
     */
    async getPerfilEstudiante(rut: string): Promise<{
        estudiante: {
            rut: string;
            nombre: string;
            correo: string;
            telefono: string | null;
            sede: string;
            carrera: string | null;
            jornada: string | null;
            anno_ingreso: number | null;
            nivel_actual: number | null;
            estado_matricula: string | null;
            estado_fuas: string | null;
            tipo_beneficio: string | null;
            debe_postular: boolean;
            creado_en: string;
            actualizado_en: string;
        };
        historial_citas: Array<{
            id: string;
            inicio: string;
            fin: string;
            estado: string;
            motivo: string | null;
            observaciones: string | null;
            descripcion_sesion: string | null;
            documento_url: string | null;
            nombre_asistente: string;
        }>;
    }> {
        const res = await fetch(`${API_URL}/estudiantes/${rut}/perfil`);
        if (!res.ok) throw new Error('Error obteniendo perfil del estudiante');
        return res.json();
    },

    /**
     * Envía solicitud de reunión por email a un estudiante
     */
    async enviarSolicitudReunion(datos: {
        estudiante: {
            rut: string;
            nombre: string;
            correo: string;
        };
        asistente: {
            rut: string;
            nombre: string;
            sede?: string;
        };
        motivo: string;
        mensaje?: string;
    }): Promise<{
        exito: boolean;
        mensaje: string;
        transactionId?: string;
    }> {
        const res = await fetch(`${API_URL}/email/solicitar-reunion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.mensaje || 'Error enviando solicitud de reunión');
        }
        return res.json();
    }
};
