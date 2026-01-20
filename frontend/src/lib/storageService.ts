/**
 * Servicio para manejo de archivos (Legacy / Validación)
 * Nota: La subida de archivos ahora se maneja vía API -> Google Drive en backend
 */

export interface ResultadoUpload {
    exitoso: boolean
    url?: string
    path?: string
    error?: string
}

/**
 * Valida que el archivo sea un PDF válido
 */
export function validarArchivoPDF(archivo: File): { valido: boolean; error?: string } {
    // Verificar tipo MIME
    if (archivo.type !== 'application/pdf') {
        return { valido: false, error: 'El archivo debe ser un PDF' }
    }

    // Verificar extensión
    if (!archivo.name.toLowerCase().endsWith('.pdf')) {
        return { valido: false, error: 'El archivo debe tener extensión .pdf' }
    }

    // Verificar tamaño (máx 10MB para PDFs)
    const maxSize = 10 * 1024 * 1024
    if (archivo.size > maxSize) {
        return { valido: false, error: 'El archivo no puede superar 10MB' }
    }

    return { valido: true }
}

// Las funciones de subida directa a Supabase han sido deprecadas
// Usar api.subirDocumentoEstudiante o api.subirDocumentoCita en su lugar

