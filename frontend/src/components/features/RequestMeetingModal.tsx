/**
 * RequestMeetingModal - Modal para solicitar reunión con un estudiante
 */

import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { api } from '../../lib/api';

interface EstudianteBasico {
    rut: string;
    nombre: string;
    correo: string;
}

interface AsistenteBasico {
    rut: string;
    nombre: string;
    sede?: string;
}

interface RequestMeetingModalProps {
    isOpen: boolean;
    onClose: () => void;
    estudiante: EstudianteBasico | null;
    asistente: AsistenteBasico | null;
    onSuccess?: () => void;
}

const MOTIVOS_REUNION = [
    { value: 'documentacion_fuas', label: 'Revisión de documentación FUAS' },
    { value: 'actualizacion_antecedentes', label: 'Actualización de antecedentes' },
    { value: 'seguimiento_academico', label: 'Seguimiento académico' },
    { value: 'consulta_beneficios', label: 'Consulta sobre beneficios' },
    { value: 'otro', label: 'Otro motivo' }
];

export function RequestMeetingModal({
    isOpen,
    onClose,
    estudiante,
    asistente,
    onSuccess
}: RequestMeetingModalProps) {
    const [motivo, setMotivo] = useState<string>('');
    const [mensaje, setMensaje] = useState<string>('');
    const [enviando, setEnviando] = useState(false);
    const [resultado, setResultado] = useState<{ exito: boolean; mensaje: string } | null>(null);

    const handleClose = () => {
        setMotivo('');
        setMensaje('');
        setResultado(null);
        onClose();
    };

    const handleSubmit = async () => {
        if (!motivo || !estudiante || !asistente) return;

        setEnviando(true);
        setResultado(null);

        try {
            const res = await api.enviarSolicitudReunion({
                estudiante: {
                    rut: estudiante.rut,
                    nombre: estudiante.nombre,
                    correo: estudiante.correo
                },
                asistente: {
                    rut: asistente.rut,
                    nombre: asistente.nombre,
                    sede: asistente.sede
                },
                motivo,
                mensaje: mensaje.trim() || undefined
            });

            setResultado({
                exito: res.exito,
                mensaje: res.exito 
                    ? `Solicitud enviada a ${estudiante.correo}`
                    : res.mensaje || 'Error al enviar'
            });

            if (res.exito && onSuccess) {
                setTimeout(() => {
                    onSuccess();
                    handleClose();
                }, 2000);
            }
        } catch (err) {
            console.error('Error enviando solicitud:', err);
            setResultado({
                exito: false,
                mensaje: 'Error de conexión. Intente nuevamente.'
            });
        } finally {
            setEnviando(false);
        }
    };

    if (!estudiante) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Solicitar Reunión"
            size="lg"
        >
            <div className="space-y-5">
                {/* Info del destinatario */}
                <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Destinatario</p>
                    <p className="font-medium text-slate-900">{estudiante.nombre}</p>
                    <p className="text-sm text-slate-500">{estudiante.correo}</p>
                </div>

                {/* Selector de motivo */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                        Motivo de la reunión
                    </label>
                    <div className="space-y-2">
                        {MOTIVOS_REUNION.map((m) => (
                            <label
                                key={m.value}
                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                    motivo === m.value
                                        ? 'border-indigo-500 bg-indigo-50'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="motivo"
                                    value={m.value}
                                    checked={motivo === m.value}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    className="h-4 w-4 text-slate-900 focus:ring-slate-500 border-slate-300"
                                />
                                <span className="text-sm text-slate-700">{m.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Mensaje personalizado */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Mensaje adicional <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <textarea
                        value={mensaje}
                        onChange={(e) => setMensaje(e.target.value)}
                        placeholder="Agrega un mensaje personalizado..."
                        rows={3}
                        maxLength={500}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none text-sm transition-all duration-200"
                    />
                    <p className="text-xs text-slate-400 text-right mt-1">
                        {mensaje.length}/500
                    </p>
                </div>

                {/* Resultado */}
                {resultado && (
                    <div className={`p-3 rounded-xl text-sm ${
                        resultado.exito 
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                    }`}>
                        {resultado.mensaje}
                    </div>
                )}

                {/* Info del remitente */}
                <div className="text-xs text-slate-500 pt-3 border-t border-slate-100">
                    <p>Remitente: Asuntos Estudiantiles CEDUC</p>
                    <p>Firmado por: {asistente?.nombre || 'Asistente Social'}</p>
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <Button
                        variant="secondary"
                        onClick={handleClose}
                        disabled={enviando}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!motivo || enviando || resultado?.exito}
                        loading={enviando}
                    >
                        Enviar solicitud
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
