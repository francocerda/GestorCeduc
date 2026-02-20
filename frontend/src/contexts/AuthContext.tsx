/**
 * Contexto de autenticación de la aplicación.
 *
 * Maneja sesión local, login/logout y determinación de permisos por rol.
 */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { ceducApi } from '../lib/ceducApi'
import { api } from '../lib/api'
import type { User, Role } from '../types/auth'

// Roles que corresponden a Asistente Social
const ROLES_ASISTENTE_SOCIAL = ['jef_dae', 'enc_aes', 'asis_ae']

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => void
  isAsistenteSocial: boolean
  isJefaDAE: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

/**
 * Verifica si el usuario tiene algún rol de asistente social
 */
function tieneRolAsistente(roles: Role[]): boolean {
  return roles.some(rol =>
    ROLES_ASISTENTE_SOCIAL.includes(rol.clave.toLowerCase())
  )
}

/**
 * Obtiene el rol de asistente social si existe
 */
function obtenerRolAsistente(roles: Role[]): Role | null {
  return roles.find(rol =>
    ROLES_ASISTENTE_SOCIAL.includes(rol.clave.toLowerCase())
  ) || null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Determinar si el usuario actual es asistente social
  const isAsistenteSocial = user ? tieneRolAsistente(user.roles) : false
  // Determinar si es Jefa DAE (acceso completo administrativo)
  // TODO: TEMPORAL - asis_ae incluido para testing, quitar después
  const isJefaDAE = user ? user.roles.some(r => ['jef_dae', 'asis_ae'].includes(r.clave.toLowerCase())) : false

  useEffect(() => {
    const verificarSesionGuardada = () => {
      try {
        const savedUser = localStorage.getItem('ceduc_user')
        const savedToken = localStorage.getItem('ceduc_token')

        if (savedUser && savedToken) {
          const userData: User = JSON.parse(savedUser)
          setUser(userData)
          // console.log('[Auth] Sesión restaurada desde localStorage')
        }
      } catch (error) {
        // console.error('[Auth] Error al restaurar sesión:', error)
        localStorage.removeItem('ceduc_user')
        localStorage.removeItem('ceduc_token')
      } finally {
        setLoading(false)
      }
    }

    verificarSesionGuardada()
  }, [])

  const signIn = async (username: string, password: string) => {
    try {
      // console.log('[Auth] Iniciando proceso de login...')

      const apiResponse = await ceducApi.login(username, password)

      // console.log('[Auth] API CEDUC respondió')

      // Verificar si tiene rol de asistente social
      const esAsistente = tieneRolAsistente(apiResponse.roles)
      const rolAsistente = obtenerRolAsistente(apiResponse.roles)

      // console.log('[Auth] ¿Es Asistente Social?:', esAsistente)
      // console.log('[Auth] Roles del usuario:', apiResponse.roles.map(r => r.clave))

      // Si es asistente, usar ese rol como currentRole, sino usar el primero
      const currentRole = rolAsistente || apiResponse.roles[0]

      const userData: User = {
        rut: apiResponse.user_id,
        nombre: apiResponse.user_name,
        correo: apiResponse.user_email,
        roles: apiResponse.roles,
        currentRole: currentRole,
        token: apiResponse.token
      }

      // console.log('[Auth] Usuario creado:', userData)

      // Sincronizar según el tipo de usuario
      if (esAsistente) {
        await sincronizarAsistenteSocial(userData)
      } else {
        await sincronizarEstudiante(userData)
      }

      localStorage.setItem('ceduc_user', JSON.stringify(userData))
      localStorage.setItem('ceduc_token', apiResponse.token)

      setUser(userData)

      // console.log('[Auth] Login completado exitosamente')

    } catch (error) {
      // console.log('[Auth] Error en signIn:', error)
      throw error
    }
  }

  const signOut = async () => {
    // console.log('[Auth] Cerrando sesión...')
    setUser(null)
    localStorage.removeItem('ceduc_user')
    localStorage.removeItem('ceduc_token')

    // console.log('[Auth] Sesión cerrada')
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, isAsistenteSocial, isJefaDAE }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Sincroniza un Asistente Social con PostgreSQL via API
 */
async function sincronizarAsistenteSocial(userData: User) {
  try {
    // console.log('[Auth] Sincronizando Asistente Social con PostgreSQL...')

    await api.syncAsistenteSocial({
      rut: userData.rut,
      correo: userData.correo,
      nombre: userData.nombre,
      roles: userData.roles
    })

    // console.log('[Auth] Asistente Social sincronizado')
  } catch (error) {
    // console.error('[Auth] Error en sincronización de Asistente Social:', error)
  }
}

/**
 * Sincroniza un Estudiante con PostgreSQL via API
 */
async function sincronizarEstudiante(userData: User) {
  try {
    // console.log('[Auth] Sincronizando Estudiante con PostgreSQL...')

    const resultado = await api.syncEstudiante({
      rut: userData.rut,
      correo: userData.correo,
      nombre: userData.nombre,
      roles: userData.roles
    })

    // console.log('[Auth] Estudiante sincronizado')

    if (resultado.estadoFuas) {
      // console.log('[Auth] Estado FUAS encontrado:', resultado.estadoFuas.estado)
    } else {
      // console.log('[Auth] Estudiante no tiene estado FUAS asignado')
    }
  } catch (error) {
    // console.error('[Auth] Error en sincronización de Estudiante:', error)
  }
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}