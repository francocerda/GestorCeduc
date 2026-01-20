/**
 * Parser de CSV para archivo de Resultados de Preselección de Beneficios
 * Formato esperado: rut;dv;apellido_paterno;apellido_materno;nombres;GLOSA_GRATUIDAD;GLOSA_BVP;GLOSA_BB;GLOSA_BEA;GLOSA_BDTE;GLOSA_BJGM;GLOSA_BNM;GLOSA_BHPE;GLOSA_FSCU;...
 */

export interface BeneficioEstudiante {
    rut: string
    dv: string
    rutCompleto: string  // RUT-DV formateado
    apellidoPaterno: string
    apellidoMaterno: string
    nombres: string
    nombreCompleto: string  // Nombres + Apellidos concatenados
    // Beneficios - null si no tiene, string con descripción si tiene
    gratuidad: string | null
    bvp: string | null       // Beca Vocación de Profesor
    bb: string | null        // Beca Bicentenario
    bea: string | null       // Beca de Excelencia Académica
    bdte: string | null      // Beca Discapacidad Técnica
    bjgm: string | null      // Beca Juan Gómez Millas
    bnm: string | null       // Beca Nuevo Milenio
    bhpe: string | null      // Beca Hijos Prof. de la Educación
    fscu: string | null      // Fondo Solidario Crédito Universitario
    // Datos adicionales
    nacionalidad: string | null
    nem: string | null
    tipoTitulo: string | null
    descripcionTitulo: string | null
    nivelEstudio: string | null
    nroAsignacionBecas: string | null
    licenciaEM: string | null
    estudiantePace: string | null
}

export interface ResultadoParsePreseleccion {
    exitoso: boolean
    datos: BeneficioEstudiante[]
    errores: string[]
    totalFilas: number
    filasValidas: number
    resumen: {
        conGratuidad: number
        conBVP: number
        conBB: number
        conBEA: number
        conBDTE: number
        conBJGM: number
        conBNM: number
        conBHPE: number
        conFSCU: number
        sinBeneficios: number
    }
}

/**
 * Limpia el valor de una celda (quita comillas, espacios, etc.)
 */
function limpiarValor(valor: string | undefined): string {
    if (!valor) return ''
    return valor.trim().replace(/^["']|["']$/g, '')
}

/**
 * Verifica si un valor de beneficio indica que SÍ tiene el beneficio
 */
function tieneBeneficio(valor: string | undefined): string | null {
    const limpio = limpiarValor(valor)
    // Si está vacío, es "SIN BENEFICIO", "NO", "N/A" etc., retorna null
    if (!limpio || 
        limpio.toUpperCase() === 'SIN BENEFICIO' || 
        limpio.toUpperCase() === 'NO' ||
        limpio.toUpperCase() === 'N/A' ||
        limpio === '-' ||
        limpio === '0') {
        return null
    }
    return limpio
}

/**
 * Parsea un archivo CSV de resultados de preselección de beneficios
 * @param contenido Contenido del archivo CSV como string
 */
export function parsearCSVPreseleccion(contenido: string): ResultadoParsePreseleccion {
    const errores: string[] = []
    const datos: BeneficioEstudiante[] = []
    const resumen = {
        conGratuidad: 0,
        conBVP: 0,
        conBB: 0,
        conBEA: 0,
        conBDTE: 0,
        conBJGM: 0,
        conBNM: 0,
        conBHPE: 0,
        conFSCU: 0,
        sinBeneficios: 0
    }

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
            filasValidas: 0,
            resumen
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

    // Mapear índices de columnas
    const indiceRut = cabecera.findIndex(c => c === 'RUT')
    const indiceDv = cabecera.findIndex(c => c === 'DV')
    const indiceApPaterno = cabecera.findIndex(c => c === 'APELLIDO_PATERNO' || c === 'APELLIDOPATERNO')
    const indiceApMaterno = cabecera.findIndex(c => c === 'APELLIDO_MATERNO' || c === 'APELLIDOMATERNO')
    const indiceNombres = cabecera.findIndex(c => c === 'NOMBRES')
    
    // Beneficios
    const indiceGratuidad = cabecera.findIndex(c => c.includes('GRATUIDAD'))
    const indiceBVP = cabecera.findIndex(c => c.includes('BVP'))
    const indiceBB = cabecera.findIndex(c => c.includes('GLOSA_BB') || c === 'BB')
    const indiceBEA = cabecera.findIndex(c => c.includes('BEA'))
    const indiceBDTE = cabecera.findIndex(c => c.includes('BDTE'))
    const indiceBJGM = cabecera.findIndex(c => c.includes('BJGM'))
    const indiceBNM = cabecera.findIndex(c => c.includes('BNM'))
    const indiceBHPE = cabecera.findIndex(c => c.includes('BHPE'))
    const indiceFSCU = cabecera.findIndex(c => c.includes('FSCU'))
    
    // Datos adicionales
    const indiceNacionalidad = cabecera.findIndex(c => c === 'NACIONALIDAD')
    const indiceNem = cabecera.findIndex(c => c === 'NEM')
    const indiceTipoTitulo = cabecera.findIndex(c => c === 'TIPO_TITULO' || c === 'TIPOTITULO')
    const indiceDescTitulo = cabecera.findIndex(c => c === 'DESCRIPCION_TITULO' || c === 'DESCRIPCIONTITULO')
    const indiceNivelEstudio = cabecera.findIndex(c => c.includes('NIVEL_ESTUDIO'))
    const indiceNroAsignacion = cabecera.findIndex(c => c.includes('NRO_ASIGNACION'))
    const indiceLicencia = cabecera.findIndex(c => c.includes('LICENCIA'))
    const indicePace = cabecera.findIndex(c => c.includes('PACE'))

    // Validar columnas obligatorias
    if (indiceRut === -1) {
        errores.push('No se encontró la columna RUT')
    }
    if (indiceDv === -1) {
        errores.push('No se encontró la columna DV (dígito verificador)')
    }
    if (indiceNombres === -1 && indiceApPaterno === -1) {
        errores.push('No se encontraron columnas de nombre')
    }

    if (errores.length > 0) {
        return {
            exitoso: false,
            datos: [],
            errores,
            totalFilas: lineas.length - 1,
            filasValidas: 0,
            resumen
        }
    }

    console.log('📊 CSV Preselección - Columnas detectadas:', cabecera.slice(0, 15))
    console.log('📊 Índices principales: RUT=', indiceRut, 'DV=', indiceDv, 'GRATUIDAD=', indiceGratuidad)

    // Procesar filas de datos
    for (let i = 1; i < lineas.length; i++) {
        const linea = lineas[i]
        if (!linea.trim()) continue

        const columnas = linea.split(separador).map(c => limpiarValor(c))

        const rut = columnas[indiceRut]
        const dv = columnas[indiceDv]

        if (!rut) {
            errores.push(`Fila ${i + 1}: RUT vacío`)
            continue
        }

        // Construir nombre completo
        const nombres = columnas[indiceNombres] || ''
        const apPaterno = indiceApPaterno >= 0 ? (columnas[indiceApPaterno] || '') : ''
        const apMaterno = indiceApMaterno >= 0 ? (columnas[indiceApMaterno] || '') : ''
        const nombreCompleto = [nombres, apPaterno, apMaterno].filter(Boolean).join(' ')

        // Extraer beneficios
        const gratuidad = indiceGratuidad >= 0 ? tieneBeneficio(columnas[indiceGratuidad]) : null
        const bvp = indiceBVP >= 0 ? tieneBeneficio(columnas[indiceBVP]) : null
        const bb = indiceBB >= 0 ? tieneBeneficio(columnas[indiceBB]) : null
        const bea = indiceBEA >= 0 ? tieneBeneficio(columnas[indiceBEA]) : null
        const bdte = indiceBDTE >= 0 ? tieneBeneficio(columnas[indiceBDTE]) : null
        const bjgm = indiceBJGM >= 0 ? tieneBeneficio(columnas[indiceBJGM]) : null
        const bnm = indiceBNM >= 0 ? tieneBeneficio(columnas[indiceBNM]) : null
        const bhpe = indiceBHPE >= 0 ? tieneBeneficio(columnas[indiceBHPE]) : null
        const fscu = indiceFSCU >= 0 ? tieneBeneficio(columnas[indiceFSCU]) : null

        // Contar beneficios
        if (gratuidad) resumen.conGratuidad++
        if (bvp) resumen.conBVP++
        if (bb) resumen.conBB++
        if (bea) resumen.conBEA++
        if (bdte) resumen.conBDTE++
        if (bjgm) resumen.conBJGM++
        if (bnm) resumen.conBNM++
        if (bhpe) resumen.conBHPE++
        if (fscu) resumen.conFSCU++

        // Verificar si tiene al menos un beneficio
        const tienAlgunBeneficio = gratuidad || bvp || bb || bea || bdte || bjgm || bnm || bhpe || fscu
        if (!tienAlgunBeneficio) {
            resumen.sinBeneficios++
        }

        datos.push({
            rut,
            dv,
            rutCompleto: `${rut}-${dv}`,
            apellidoPaterno: apPaterno,
            apellidoMaterno: apMaterno,
            nombres,
            nombreCompleto,
            gratuidad,
            bvp,
            bb,
            bea,
            bdte,
            bjgm,
            bnm,
            bhpe,
            fscu,
            nacionalidad: indiceNacionalidad >= 0 ? limpiarValor(columnas[indiceNacionalidad]) : null,
            nem: indiceNem >= 0 ? limpiarValor(columnas[indiceNem]) : null,
            tipoTitulo: indiceTipoTitulo >= 0 ? limpiarValor(columnas[indiceTipoTitulo]) : null,
            descripcionTitulo: indiceDescTitulo >= 0 ? limpiarValor(columnas[indiceDescTitulo]) : null,
            nivelEstudio: indiceNivelEstudio >= 0 ? limpiarValor(columnas[indiceNivelEstudio]) : null,
            nroAsignacionBecas: indiceNroAsignacion >= 0 ? limpiarValor(columnas[indiceNroAsignacion]) : null,
            licenciaEM: indiceLicencia >= 0 ? limpiarValor(columnas[indiceLicencia]) : null,
            estudiantePace: indicePace >= 0 ? limpiarValor(columnas[indicePace]) : null
        })
    }

    console.log(`✅ CSV Preselección parseado: ${datos.length} registros válidos`)
    console.log('📊 Resumen de beneficios:', resumen)

    return {
        exitoso: true,
        datos,
        errores,
        totalFilas: lineas.length - 1,
        filasValidas: datos.length,
        resumen
    }
}

/**
 * Valida que un archivo sea CSV válido para preselección
 */
export function validarArchivoCSVPreseleccion(archivo: File): { valido: boolean; error?: string } {
    if (!archivo) {
        return { valido: false, error: 'No se proporcionó archivo' }
    }

    const extension = archivo.name.split('.').pop()?.toLowerCase()
    if (extension !== 'csv') {
        return { valido: false, error: 'El archivo debe ser CSV' }
    }

    // Límite de 50MB para archivos grandes
    if (archivo.size > 50 * 1024 * 1024) {
        return { valido: false, error: 'El archivo es demasiado grande (máximo 50MB)' }
    }

    return { valido: true }
}

/**
 * Genera un resumen legible de los beneficios de un estudiante
 */
export function obtenerResumenBeneficios(estudiante: BeneficioEstudiante): string[] {
    const beneficios: string[] = []
    
    if (estudiante.gratuidad) beneficios.push(`Gratuidad: ${estudiante.gratuidad}`)
    if (estudiante.bvp) beneficios.push(`Beca Vocación de Profesor: ${estudiante.bvp}`)
    if (estudiante.bb) beneficios.push(`Beca Bicentenario: ${estudiante.bb}`)
    if (estudiante.bea) beneficios.push(`Beca Excelencia Académica: ${estudiante.bea}`)
    if (estudiante.bdte) beneficios.push(`Beca Discapacidad Técnica: ${estudiante.bdte}`)
    if (estudiante.bjgm) beneficios.push(`Beca Juan Gómez Millas: ${estudiante.bjgm}`)
    if (estudiante.bnm) beneficios.push(`Beca Nuevo Milenio: ${estudiante.bnm}`)
    if (estudiante.bhpe) beneficios.push(`Beca Hijos Prof. Educación: ${estudiante.bhpe}`)
    if (estudiante.fscu) beneficios.push(`FSCU: ${estudiante.fscu}`)
    
    return beneficios
}

/**
 * Obtiene el nombre corto de los beneficios para mostrar en badges
 */
export function obtenerBadgesBeneficios(estudiante: BeneficioEstudiante): { nombre: string; color: string }[] {
    const badges: { nombre: string; color: string }[] = []
    
    if (estudiante.gratuidad) badges.push({ nombre: 'Gratuidad', color: 'emerald' })
    if (estudiante.bvp) badges.push({ nombre: 'BVP', color: 'purple' })
    if (estudiante.bb) badges.push({ nombre: 'Bicentenario', color: 'blue' })
    if (estudiante.bea) badges.push({ nombre: 'BEA', color: 'amber' })
    if (estudiante.bdte) badges.push({ nombre: 'BDTE', color: 'teal' })
    if (estudiante.bjgm) badges.push({ nombre: 'BJGM', color: 'indigo' })
    if (estudiante.bnm) badges.push({ nombre: 'BNM', color: 'cyan' })
    if (estudiante.bhpe) badges.push({ nombre: 'BHPE', color: 'pink' })
    if (estudiante.fscu) badges.push({ nombre: 'FSCU', color: 'orange' })
    
    return badges
}
