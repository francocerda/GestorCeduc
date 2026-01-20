/**
 * RequestMeetingModal - Modal para solicitar reunión con un estudiante
 * Permite seleccionar motivo y agregar mensaje personalizado
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
    { value: 'documentacion_fuas', label: 'Revisión de documentación FUAS', description: 'Documentos pendientes o incompletos' },
    { value: 'actualizacion_antecedentes', label: ' Actualización de antecedentes', description: 'Actualizar información socioeconómica' },
    { value: 'seguimiento_academico', label: 'Seguimiento académico', description: 'Revisar situación de estudios' },
    { value: 'consulta_beneficios', label: 'Consulta sobre beneficios', description: 'Información de becas y beneficios' },
    { value: 'otro', label: 'Otro motivo', description: 'Asunto general a especificar' }
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
                    ? `✅ Solicitud enviada correctamente a ${estudiante.correo}`
                    : `❌ ${res.mensaje || 'Error al enviar'}`
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
                mensaje: '❌ Error de conexión. Intente nuevamente.'
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
            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
                {/* Info del destinatario */}
                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
                    <p className="text-sm text-gray-600 mb-1">Enviando solicitud a:</p>
                    <p className="font-semibold text-gray-800">{estudiante.nombre}</p>
                    <p className="text-sm text-gray-600">{estudiante.correo}</p>
                </div>

                {/* Selector de motivo */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Motivo de la reunión <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                        {MOTIVOS_REUNION.map((m) => (
                            <label
                                key={m.value}
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                    motivo === m.value
                                        ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="motivo"
                                    value={m.value}
                                    checked={motivo === m.value}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    className="mt-0.5 h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                />
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{m.label}</p>
                                    <p className="text-xs text-gray-500">{m.description}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Mensaje personalizado */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mensaje adicional <span className="text-gray-400">(opcional)</span>
                    </label>
                    <textarea
                        value={mensaje}
                        onChange={(e) => setMensaje(e.target.value)}
                        placeholder="Agrega un mensaje personalizado para el estudiante..."
                        rows={3}
                        maxLength={500}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none text-sm"
                    />
                    <p className="text-xs text-gray-400 text-right mt-1">
                        {mensaje.length}/500 caracteres
                    </p>
                </div>

                {/* Resultado */}
                {resultado && (
                    <div className={`p-4 rounded-lg ${
                        resultado.exito 
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                        <p className="text-sm">{resultado.mensaje}</p>
                    </div>
                )}

                {/* Info del remitente */}
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-3">
                    <p>El correo se enviará desde: <strong>Asuntos Estudiantiles CEDUC</strong></p>
                    <p>Firmado por: <strong>{asistente?.nombre || 'Asistente Social'}</strong></p>
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
                    <Button
                        variant="secondary"
                        onClick={handleClose}
                        disabled={enviando}
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!motivo || enviando || resultado?.exito}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400"
                    >
                        {enviando ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Enviando...
                            </>
                        ) : (
                            'Enviar Solicitud'
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
