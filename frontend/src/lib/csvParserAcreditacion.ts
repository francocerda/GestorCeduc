/**
 * Utilidad para parsear archivos CSV del Ministerio
 * Acepta formato flexible: RUT;DV;[columnas adicionales...]
 */

// Interfaz para los datos del CSV del Ministerio
export interface DatoMinisterioCSV {
    rut: string
    dv: string
    tipo: string        
    observacion: string 
}

export interface ResultadoParseCSV {
    exitoso: boolean
    datos: DatoMinisterioCSV[]
    errores: string[]
    totalFilas: number
    filasValidas: number
    columnasDetectadas: string[]
}

/**
 * Parsea un archivo CSV del Ministerio
 * Formato mínimo requerido: RUT;DV;[cualquier columna adicional]
 */
export function parsearCSVMinisterio(contenido: string): ResultadoParseCSV {
    const errores: string[] = []
    const datos: DatoMinisterioCSV[] = []

    // Normalizar saltos de línea y dividir en filas
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
            filasValidas: 0,
            columnasDetectadas: []
        }
    }

    // Detectar separador (puede ser ; o , o tab)
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

    // Verificar columnas mínimas requeridas: RUT y DV
    const indiceRut = cabecera.findIndex(c => c === 'RUT' || c.includes('RUT'))
    const indiceDv = cabecera.findIndex(c => c === 'DV' || c.includes('VERIFICADOR'))

    if (indiceRut === -1) {
        errores.push('No se encontró columna RUT')
        return {
            exitoso: false,
            datos: [],
            errores,
            totalFilas: lineas.length - 1,
            filasValidas: 0,
            columnasDetectadas: cabecera
        }
    }

    // Índices de columnas adicionales (flexibles)
    const indiceTipo = cabecera.findIndex((c, i) =>
        i !== indiceRut && i !== indiceDv &&
        (c.includes('FORMULARIO') || c.includes('POSTULACION') || c.includes('TIPO') || c.includes('BENEFICIO'))
    )
    const indiceObs = cabecera.findIndex((c, i) =>
        i !== indiceRut && i !== indiceDv && i !== indiceTipo &&
        (c.includes('OBSERVACION') || c.includes('OBS') || c.includes('NOTA'))
    )

    console.log('📊 Columnas detectadas:', cabecera)
    console.log('📊 Índices: RUT=', indiceRut, 'DV=', indiceDv, 'Tipo=', indiceTipo, 'Obs=', indiceObs)

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
            const partes = rut.split('-')
            rut = partes[0]
        }

        // Validar RUT (solo números, 7-9 dígitos)
        if (!rut || !/^\d{6,9}$/.test(rut)) {
            // Omitir filas con RUT inválido sin reportar como error (pueden ser filas vacías)
            if (rut && rut.length > 0) {
                errores.push(`Fila ${i + 1}: RUT inválido (${rut})`)
            }
            continue
        }

        // Obtener DV si existe
        let dv = indiceDv !== -1 ? (columnas[indiceDv] || '') : ''
        dv = dv.replace(/[.\-\s]/g, '').toUpperCase()


        // Obtener tipo/formulario (tercera columna o la que corresponda)
        const tipo = indiceTipo !== -1 ? (columnas[indiceTipo] || '') :
            (columnas[2] || '')

        // Obtener observación (cuarta columna si existe)
        const observacion = indiceObs !== -1 ? (columnas[indiceObs] || '') :
            (columnas[3] || '')

        datos.push({
            rut,
            dv,
            tipo,
            observacion
        })
    }

    return {
        exitoso: datos.length > 0,
        datos,
        errores,
        totalFilas: lineas.length - 1,
        filasValidas: datos.length,
        columnasDetectadas: cabecera
    }
}

/**
 * Lee un archivo File y retorna su contenido como string
 */
export function leerArchivoComoTexto(archivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (evento) => {
            const contenido = evento.target?.result as string
            resolve(contenido)
        }

        reader.onerror = () => {
            reject(new Error('Error al leer el archivo'))
        }

        // Leer como UTF-8
        reader.readAsText(archivo, 'UTF-8')
    })
}

/**
 * Valida que el archivo sea un CSV válido
 */
export function validarArchivoCSV(archivo: File): { valido: boolean; error?: string } {
    // Verificar extensión
    if (!archivo.name.toLowerCase().endsWith('.csv')) {
        return { valido: false, error: 'El archivo debe ser .csv' }
    }

    // Verificar tamaño (máx 50MB para archivos grandes del Ministerio)
    const maxSize = 50 * 1024 * 1024
    if (archivo.size > maxSize) {
        return { valido: false, error: 'El archivo no puede superar 50MB' }
    }

    return { valido: true }
}
