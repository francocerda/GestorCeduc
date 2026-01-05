export function cleanRut(rut: string): string {
    return rut.replace(/[.\-\s]/g,'').toUpperCase()
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
    const cleaned = cleanRut(rut)
    if (cleaned.length < 2) return false
    const body = cleaned.slice(0,-1)
    const dv = cleaned.slice(-1)
    if (!/^\d+$/.test(body)) return false
    if (!/^[0-9K]$/.test(dv)) return false
    const expectedDV = calculateDV(body)
    return dv === expectedDV
}

export function isValidRut(rut:string): boolean {
    return validateRut(rut)
}