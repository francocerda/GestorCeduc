/**
 * StudentProfileModal - Modal de perfil completo del estudiante
 * Muestra información detallada y historial de citas
 */

import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Skeleton from '../ui/Skeleton';
import { api } from '../../lib/api';

interface HistorialCita {
    id: string;
    inicio: string;
    fin: string;
    estado: string;
    motivo: string | null;
    observaciones: string | null;
    descripcion_sesion: string | null;
    documento_url: string | null;
    nombre_asistente: string;
}

interface PerfilEstudiante {
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
}

interface StudentProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    rutEstudiante: string | null;
    onRequestMeeting?: (estudiante: PerfilEstudiante) => void;
}

export function StudentProfileModal({
    isOpen,
    onClose,
    rutEstudiante,
    onRequestMeeting
}: StudentProfileModalProps) {
    const [perfil, setPerfil] = useState<PerfilEstudiante | null>(null);
    const [historial, setHistorial] = useState<HistorialCita[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && rutEstudiante) {
            cargarPerfil();
        } else {
            // Reset cuando se cierra
            setPerfil(null);
            setHistorial([]);
            setError(null);
        }
    }, [isOpen, rutEstudiante]);

    const cargarPerfil = async () => {
        if (!rutEstudiante) return;
        
        setLoading(true);
        setError(null);

        try {
            const data = await api.getPerfilEstudiante(rutEstudiante);
            setPerfil(data.estudiante);
            setHistorial(data.historial_citas || []);
        } catch (err) {
            console.error('Error cargando perfil:', err);
            setError('No se pudo cargar la información del estudiante');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-CL', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getEstadoCitaBadge = (estado: string) => {
        const estilos: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
            completada: 'success',
            pendiente: 'warning',
            cancelada: 'danger',
            no_asistio: 'danger'
        };
        return estilos[estado] || 'default';
    };

    const getEstadoFuasBadge = (estado: string | null) => {
        if (!estado) return 'default';
        const lower = estado.toLowerCase();
        if (lower.includes('pendiente')) return 'warning';
        if (lower.includes('aprob') || lower.includes('complet') || lower.includes('validado')) return 'success';
        if (lower.includes('rechaz')) return 'danger';
        return 'default';
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={perfil?.nombre || 'Perfil del Estudiante'}
            size="lg"
        >
            {loading ? (
                <div className="space-y-4 p-4">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            ) : error ? (
                <div className="p-6 text-center">
                    <div className="text-red-500 mb-4">
                        <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>{error}</p>
                    </div>
                    <Button onClick={cargarPerfil}>Reintentar</Button>
                </div>
            ) : perfil && (
                <div className="space-y-6">
                    {/* Información Principal */}
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-5 border border-emerald-100">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">{perfil.nombre}</h3>
                                <p className="text-gray-600 text-sm">RUT: {perfil.rut}</p>
                            </div>
                            {perfil.estado_fuas && (
                                <Badge variant={getEstadoFuasBadge(perfil.estado_fuas)}>
                                    {perfil.estado_fuas}
                                </Badge>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">Correo:</span>
                                <p className="text-gray-800 font-medium">{perfil.correo || 'No registrado'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500">Teléfono:</span>
                                <p className="text-gray-800 font-medium">{perfil.telefono || 'No registrado'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500">Sede:</span>
                                <p className="text-gray-800 font-medium">{perfil.sede || 'Sin sede'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500">Carrera:</span>
                                <p className="text-gray-800 font-medium">{perfil.carrera || 'No especificada'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Información Académica */}
                    <div className="bg-white rounded-lg border border-gray-200 p-5">
                        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span></span> Información Académica
                        </h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">Jornada:</span>
                                <p className="font-medium">{perfil.jornada || '-'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500">Año ingreso:</span>
                                <p className="font-medium">{perfil.anno_ingreso || '-'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500">Nivel actual:</span>
                                <p className="font-medium">{perfil.nivel_actual || '-'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500">Estado matrícula:</span>
                                <p className="font-medium">{perfil.estado_matricula || '-'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500">Beneficio:</span>
                                <p className="font-medium">{perfil.tipo_beneficio || 'Sin beneficio'}</p>
                            </div>
                            <div>
                                <span className="text-gray-500">Debe postular FUAS:</span>
                                <p className="font-medium">{perfil.debe_postular ? 'Sí' : 'No'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Historial de Citas */}
                    <div className="bg-white rounded-lg border border-gray-200 p-5">
                        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span></span> Historial de Citas
                            <span className="text-xs font-normal text-gray-400">
                                ({historial.length} {historial.length === 1 ? 'cita' : 'citas'})
                            </span>
                        </h4>

                        {historial.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-4">
                                Este estudiante no tiene citas registradas
                            </p>
                        ) : (
                            <div className="space-y-3 max-h-60 overflow-y-auto">
                                {historial.map((cita) => (
                                    <div 
                                        key={cita.id} 
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-800">
                                                    {formatDate(cita.inicio)}
                                                </span>
                                                <Badge variant={getEstadoCitaBadge(cita.estado)}>
                                                    {cita.estado}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Atendido por: {cita.nombre_asistente || 'No especificado'}
                                            </p>
                                            {cita.motivo && (
                                                <p className="text-xs text-gray-600 mt-1">
                                                    Motivo: {cita.motivo}
                                                </p>
                                            )}
                                        </div>
                                        {cita.documento_url && (
                                            <a
                                                href={cita.documento_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-emerald-600 hover:text-emerald-700 text-xs"
                                            >
                                                Ver documento
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                        <div className="text-xs text-gray-400">
                            Última actualización: {perfil.actualizado_en ? formatDate(perfil.actualizado_en) : 'N/A'}
                        </div>
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={onClose}>
                                Cerrar
                            </Button>
                            {onRequestMeeting && perfil.correo && (
                                <Button
                                    variant="primary"
                                    onClick={() => onRequestMeeting(perfil)}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    Solicitar Reunión
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
}
