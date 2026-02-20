/**
 * Tipos de dominio para autenticación y sesión de usuario.
 *
 * Se usan en `ceducApi`, `AuthContext` y componentes de login.
 */
export interface Role {
    id: string
    clave: string
    nombre:string
}

export interface LoginResponse {
    user_id: string
    user_name: string
    user_email: string
    roles: Role[]
    logged_in: string
    token: string
    perfiles: Record<string, string>
}

export interface User {
    rut: string
    nombre: string
    correo: string
    roles: Role[]
    currentRole: Role
    token: string
}

export interface RecuperacionResponse {
    success: boolean
    message: string
}