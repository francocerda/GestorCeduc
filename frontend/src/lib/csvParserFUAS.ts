/**
 * Parser de CSV para archivo de Postulantes FUAS
 * Formato esperado: RUT;DV;POSTULACION
 */

export interface DatoPostulanteFUAS {
    rut: string
    dv: string
    postulacion: string
}

export interface ResultadoParseFUAS {
    exitoso: boolean
    datos: DatoPostulanteFUAS[]
    errores: string[]
    totalFilas: number
    filasValidas: number
}

/**
 * Parsea un archivo CSV de postulantes FUAS
 * @param contenido Contenido del archivo CSV como string
 */
export function parsearCSVPostulantesFUAS(contenido: string): ResultadoParseFUAS {
    const errores: string[] = []
    const datos: DatoPostulanteFUAS[] = []

    // Normalizar saltos de línea
    const lineas = contenido
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter(linea => linea.trim() !== '')

    if (lineas.length === 0) {
        return {
            exitoso: false,
            datos: [],
            errores: ['Archivo vacío'],
            totalFilas: 0,
            filasValidas: 0
        }
    }

    // Detectar separador
    const primeraLinea = lineas[0]
    let separador = ';'
    if (!primeraLinea.includes(';') && primeraLinea.includes(',')) {
        separador = ','
    } else if (!primeraLinea.includes(';') && !primeraLinea.includes(',') && primeraLinea.includes('\t')) {
        separador = '\t'
    }

    // Obtener cabecera
    const cabecera = lineas[0].split(separador).map(col =>
        col.trim().replace(/^["']|["']$/g, '').toUpperCase()
    )

    // Buscar índices de columnas
    const indiceRut = cabecera.findIndex(c => c === 'RUT' || c.includes('RUT'))
    const indiceDv = cabecera.findIndex(c => c === 'DV' || c.includes('VERIFICADOR') || c.includes('DV'))
    const indicePostulacion = cabecera.findIndex(c =>
        c.includes('POSTULACION') || c.includes('POSTULACIÓN') || c.includes('TIPO')
    )

    if (indiceRut === -1) {
        errores.push('No se encontró columna RUT')
        return {
            exitoso: false,
            datos: [],
            errores,
            totalFilas: lineas.length - 1,
            filasValidas: 0
        }
    }

    // console.log('[csvParserFUAS] Columnas:', cabecera)
    // console.log('[csvParserFUAS] Índices: RUT=', indiceRut, 'DV=', indiceDv, 'POSTULACION=', indicePostulacion)

    // Procesar filas de datos
    for (let i = 1; i < lineas.length; i++) {
        const linea = lineas[i]
        const columnas = linea.split(separador).map(col =>
            col.trim().replace(/^["']|["']$/g, '')
        )

        // Obtener RUT
        let rut = columnas[indiceRut] || ''

        // Limpiar RUT (quitar puntos, guiones, espacios)
        rut = rut.replace(/[.\-\s]/g, '')

        // Si el RUT incluye el DV (formato 12345678-9), separarlo
        if (rut.includes('-')) {
            rut = rut.split('-')[0]
        }

        // Validar RUT (solo números, 7-9 dígitos)
        if (!rut || !/^\d{6,9}$/.test(rut)) {
            if (rut && rut.length > 0) {
                // Solo reportar si realmente hay algo pero es inválido
                errores.push(`Fila ${i + 1}: RUT inválido (${rut})`)
            }
            continue
        }

        // Obtener DV
        let dv = indiceDv !== -1 ? (columnas[indiceDv] || '') : ''
        dv = dv.replace(/[.\-\s]/g, '').toUpperCase()

        // Obtener tipo postulación
        const postulacion = indicePostulacion !== -1 ? (columnas[indicePostulacion] || '') : (columnas[2] || '')

        datos.push({
            rut,
            dv,
            postulacion
        })
    }

    return {
        exitoso: datos.length > 0,
        datos,
        errores,
        totalFilas: lineas.length - 1,
        filasValidas: datos.length
    }
}

/**
 * Valida que el archivo sea un CSV válido para FUAS
 */
export function validarArchivoCSVFUAS(archivo: File): { valido: boolean; error?: string } {
    // Verificar extensión
    if (!archivo.name.toLowerCase().endsWith('.csv')) {
        return { valido: false, error: 'El archivo debe ser .csv' }
    }

    // Verificar tamaño (máx 50MB)
    const maxSize = 50 * 1024 * 1024
    if (archivo.size > maxSize) {
        return { valido: false, error: 'El archivo no puede superar 50MB' }
    }

    return { valido: true }
}
