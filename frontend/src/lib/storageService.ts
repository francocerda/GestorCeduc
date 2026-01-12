/**
 * Servicio para manejo de archivos en Supabase Storage
 */

import { supabase } from './supabase'

// Buckets disponibles
const BUCKETS = {
    FUAS_COMPROBANTES: 'fuas-comprobantes',
    CITAS_DOCUMENTOS: 'citas-documentos'
} as const

export type BucketType = typeof BUCKETS[keyof typeof BUCKETS]

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

/**
 * Sube un archivo PDF al bucket de citas
 */
export async function subirDocumentoCita(
    archivo: File,
    citaId: string
): Promise<ResultadoUpload> {
    const validacion = validarArchivoPDF(archivo)
    if (!validacion.valido) {
        return { exitoso: false, error: validacion.error }
    }

    const timestamp = Date.now()
    const path = `${citaId}-${timestamp}.pdf`

    try {
        const { data, error } = await supabase.storage
            .from(BUCKETS.CITAS_DOCUMENTOS)
            .upload(path, archivo, {
                contentType: 'application/pdf',
                upsert: true
            })

        if (error) {
            console.error('Error subiendo documento:', error)
            return { exitoso: false, error: error.message }
        }

        // Obtener URL pública (o signed URL para buckets privados)
        const { data: urlData } = supabase.storage
            .from(BUCKETS.CITAS_DOCUMENTOS)
            .getPublicUrl(data.path)

        return {
            exitoso: true,
            url: urlData.publicUrl,
            path: data.path
        }
    } catch (error) {
        console.error('Error en upload:', error)
        return {
            exitoso: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        }
    }
}

/**
 * Sube un comprobante FUAS (estudiante no postulante)
 */
export async function subirComprobanteFUAS(
    archivo: File,
    rutEstudiante: string
): Promise<ResultadoUpload> {
    const validacion = validarArchivoPDF(archivo)
    if (!validacion.valido) {
        return { exitoso: false, error: validacion.error }
    }

    const timestamp = Date.now()
    const path = `${rutEstudiante}-${timestamp}.pdf`

    try {
        const { data, error } = await supabase.storage
            .from(BUCKETS.FUAS_COMPROBANTES)
            .upload(path, archivo, {
                contentType: 'application/pdf',
                upsert: true
            })

        if (error) {
            console.error('Error subiendo comprobante:', error)
            return { exitoso: false, error: error.message }
        }

        const { data: urlData } = supabase.storage
            .from(BUCKETS.FUAS_COMPROBANTES)
            .getPublicUrl(data.path)

        return {
            exitoso: true,
            url: urlData.publicUrl,
            path: data.path
        }
    } catch (error) {
        console.error('Error en upload:', error)
        return {
            exitoso: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        }
    }
}

/**
 * Obtiene una URL firmada temporal para ver un documento
 * (Para buckets privados)
 */
export async function obtenerURLDocumento(
    bucket: BucketType,
    path: string,
    expiresIn: number = 3600
): Promise<string | null> {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, expiresIn)

        if (error) {
            console.error('Error obteniendo URL:', error)
            return null
        }

        return data.signedUrl
    } catch (error) {
        console.error('Error:', error)
        return null
    }
}

/**
 * Elimina un documento del storage
 */
export async function eliminarDocumento(
    bucket: BucketType,
    path: string
): Promise<boolean> {
    try {
        const { error } = await supabase.storage
            .from(bucket)
            .remove([path])

        if (error) {
            console.error('Error eliminando documento:', error)
            return false
        }

        return true
    } catch (error) {
        console.error('Error:', error)
        return false
    }
}

export { BUCKETS }
