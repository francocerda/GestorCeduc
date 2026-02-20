/**
 * Utilidades para normalizar, formatear y validar RUT chileno.
 */
export function cleanRut(rut: string): string {
    return rut.replace(/[.\-\s]/g,'').toUpperCase()
}

/**
 * Prepara el RUT para la API de CEDUC (sin puntos, sin guión, sin DV)
 * Ejemplo: "11.381.569-8" → "11381569"
 */
export function prepareRutForAPI(rut: string): string {
    const cleaned = cleanRut(rut)
    // Remover el último carácter (dígito verificador)
    return cleaned.slice(0, -1)
}

export function formatRut(rut: string): string {
    const cleaned = cleanRut(rut)
    const body = cleaned.slice(0,-1)
    const dv = cleaned.slice(-1)
    const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `${formatted}-${dv}`
}

export function calculateDV(rut:string): string {
    const reversed = rut.split('').reverse()
    let sum = 0
    let multiplier = 2
    for(const digit of reversed) {
        sum += parseInt(digit) * multiplier
        multiplier = multiplier == 7 ? 2 : multiplier + 1
    }
    const mod = 11 - (sum % 11)
    if (mod == 11) return '0'
    if (mod == 10) return 'k'
    return mod.toString()

}

export function validateRut(rut: string): boolean {
    if (rut.length < 2) return false
    const body = rut.slice(0,-1)
    const dv = rut.slice(-1)
    if (!/^\d+$/.test(body)) return false
    if (!/^[0-9K]$/.test(dv)) return false
    const expectedDV = calculateDV(body)
    return dv === expectedDV
}

export function isValidRut(rut:string): boolean {
    return validateRut(rut)
}