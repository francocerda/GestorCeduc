/**
 * StudentProfileModal - Modal de perfil completo del estudiante
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
    cod_carrera: string | null;
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
            // console.error('Error cargando perfil:', err);
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

    const InfoItem = ({ label, value, highlight }: { label: string; value: string | number | null; highlight?: boolean }) => (
        <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-sm font-medium ${highlight ? 'text-emerald-600' : 'text-slate-900'}`}>
                {value || '-'}
            </p>
        </div>
    );

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
                <div className="py-12 text-center">
                    <p className="text-slate-500 mb-4">{error}</p>
                    <Button variant="secondary" onClick={cargarPerfil}>Reintentar</Button>
                </div>
            ) : perfil && (
                <div className="space-y-5">
                    {/* Información Principal */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">{perfil.nombre}</h3>
                                <p className="text-sm text-slate-500">{perfil.rut}</p>
                            </div>
                            {perfil.estado_fuas && (
                                <Badge variant={getEstadoFuasBadge(perfil.estado_fuas)}>
                                    {perfil.estado_fuas}
                                </Badge>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <InfoItem label="Correo" value={perfil.correo} />
                            <InfoItem label="Teléfono" value={perfil.telefono} />
                            <InfoItem label="Sede" value={perfil.sede} />
                            <InfoItem label="Carrera" value={perfil.carrera} />
                        </div>
                    </div>

                    {/* Información Académica */}
                    <div>
                        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                            Información Académica
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                            <InfoItem label="Código Carrera" value={perfil.cod_carrera} />
                            <InfoItem label="Jornada" value={perfil.jornada} />
                            <InfoItem label="Año Ingreso" value={perfil.anno_ingreso} />
                            <InfoItem label="Nivel" value={perfil.nivel_actual ? `Nivel ${perfil.nivel_actual}` : null} />
                            <InfoItem label="Estado Matrícula" value={perfil.estado_matricula} highlight={perfil.estado_matricula === 'VIGENTE'} />
                            <InfoItem label="Beneficio" value={perfil.tipo_beneficio} />
                        </div>
                    </div>

                    {/* Estado FUAS */}
                    <div>
                        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                            Estado FUAS
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InfoItem label="Estado actual" value={perfil.estado_fuas} />
                            <div>
                                <p className="text-xs text-slate-500">Debe postular</p>
                                <p className={`text-sm font-medium ${perfil.debe_postular ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {perfil.debe_postular ? 'Sí' : 'No'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Historial de Citas */}
                    <div>
                        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                            Historial de Citas ({historial.length})
                        </h4>

                        {historial.length === 0 ? (
                            <p className="text-slate-400 text-sm text-center py-6">
                                Sin citas registradas
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {historial.map((cita) => (
                                    <div 
                                        key={cita.id} 
                                        className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-slate-800">
                                                    {formatDate(cita.inicio)}
                                                </span>
                                                <Badge variant={getEstadoCitaBadge(cita.estado)}>
                                                    {cita.estado}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {cita.nombre_asistente || 'Sin asistente'}
                                            </p>
                                        </div>
                                        {cita.documento_url && (
                                            <a
                                                href={cita.documento_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-slate-600 hover:text-slate-900 text-xs underline"
                                            >
                                                Ver doc
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                        <p className="text-xs text-slate-400">
                            Actualizado: {perfil.actualizado_en ? formatDate(perfil.actualizado_en) : '-'}
                        </p>
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={onClose}>
                                Cerrar
                            </Button>
                            {onRequestMeeting && perfil.correo && (
                                <Button onClick={() => onRequestMeeting(perfil)}>
                                    Solicitar reunión
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
}
