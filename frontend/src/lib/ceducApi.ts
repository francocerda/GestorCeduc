/**
 * Cliente de integración con API externa CEDUC.
 *
 * Expone autenticación y recuperación de contraseña para el flujo de acceso.
 */
import type { LoginResponse, RecuperacionResponse } from "../types/auth"

const API_BASE_URL = 'https://academico.ceduc.cl/AcompanamientoAPISegura/api'

export const ceducApi = {
    /**
     * Iniciar sesión con RUT (sin DV) y contraseña
     * 
     * @param username - RUT sin puntos, sin guión, SIN dígito verificador (ej: "11381569")
     * @param password - Contraseña del usuario
     * @returns Datos del usuario y token de autenticación
     * @throws Error si las credenciales son inválidas o hay problemas de red
     */
    async login(username: string, password: string): Promise<LoginResponse> {
        try {
            // console.log('[ceducApi] Iniciando login con:', username)
            const response = await fetch(`${API_BASE_URL}/Login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                }),
            })
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`)
            }

            const data: LoginResponse = await response.json()

            // console.log('[ceducApi] Respuesta de la API recibida')

            if (data.logged_in !== 'true') {
                throw new Error('Credenciales inválidas')
            }
            
            return data
        } catch (error) {
            // console.error('[ceducApi] Error en login:', error)
            if (error instanceof Error) {
                throw error
            } else {
                throw new Error('Error desconocido al iniciar sesión')
            }
        }
    },

    /**
     * Recuperar contraseña enviando email al RUT proporcionado
     * 
     * @param rut - RUT sin puntos, sin guión, SIN dígito verificador (ej: "11381569")
     * @returns Respuesta indicando si se envió el correo
     * @throws Error si hay problemas de red o el RUT no existe
     */
    async recuperarContrasena(rut: string): Promise<RecuperacionResponse> {
        try {
            // console.log('[ceducApi] Solicitando recuperación de contraseña para:', rut)

            const response = await fetch(`${API_BASE_URL}/RecuperacionContrasena`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(rut),
            })

            if (!response.ok) { 
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`)
            }

            const data: RecuperacionResponse = await response.json()

            // console.log('[ceducApi] Respuesta de recuperación recibida')

            return data

        } catch (error) {
            // console.error('[ceducApi] Error en recuperación:', error)

            if (error instanceof Error) {
                throw error
            } else {
                throw new Error('Error desconocido al recuperar contraseña')
            }
        }
    },
}
