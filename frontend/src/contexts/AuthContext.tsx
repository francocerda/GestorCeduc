import React, { createContext, useContext, useEffect, useState } from 'react'
import { ceducApi } from '../lib/ceducApi'
import { supabase } from '../lib/supabase'
import type { User, Role } from '../types/auth'
import type { EstudianteInsert } from '../types/database'

// Roles que corresponden a Asistente Social
const ROLES_ASISTENTE_SOCIAL = ['jef_dae', 'enc_aes']

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => void
  isAsistenteSocial: boolean
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

  useEffect(() => {
    const verificarSesionGuardada = () => {
      try {
        const savedUser = localStorage.getItem('ceduc_user')
        const savedToken = localStorage.getItem('ceduc_token')

        if (savedUser && savedToken) {
          const userData: User = JSON.parse(savedUser)
          setUser(userData)
          console.log('✅ Sesión restaurada desde localStorage')
        }
      } catch (error) {
        console.error('❌ Error al restaurar sesión:', error)
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
      console.log('🔐 Iniciando proceso de login...')

      const apiResponse = await ceducApi.login(username, password)

      console.log('✅ API CEDUC respondió:', apiResponse)

      // Verificar si tiene rol de asistente social
      const esAsistente = tieneRolAsistente(apiResponse.roles)
      const rolAsistente = obtenerRolAsistente(apiResponse.roles)

      console.log('🔍 ¿Es Asistente Social?:', esAsistente)
      console.log('🔍 Roles del usuario:', apiResponse.roles.map(r => r.clave))

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

      console.log('👤 Usuario creado:', userData)

      // Sincronizar según el tipo de usuario
      if (esAsistente) {
        await sincronizarAsistenteSocial(userData)
      } else {
        await sincronizarEstudiante(userData)
      }

      localStorage.setItem('ceduc_user', JSON.stringify(userData))
      localStorage.setItem('ceduc_token', apiResponse.token)

      setUser(userData)

      console.log('✅ Login completado exitosamente')

    } catch (error) {
      console.log('❌ Error en signIn:', error)
      throw error
    }
  }

  const signOut = async () => {
    console.log('🚪 Cerrando sesión...')
    setUser(null)
    localStorage.removeItem('ceduc_user')
    localStorage.removeItem('ceduc_token')

    console.log('✅ Sesión cerrada')
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, isAsistenteSocial }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Sincroniza un Asistente Social con Supabase
 */
async function sincronizarAsistenteSocial(userData: User) {
  try {
    console.log('🔄 Sincronizando Asistente Social con Supabase...')

    const { data: asistenteExistente, error: errorBusqueda } = await supabase
      .from('asistentes_sociales')
      .select('*')
      .eq('rut', userData.rut)
      .single()

    if (errorBusqueda && errorBusqueda.code !== 'PGRST116') {
      throw errorBusqueda
    }

    if (asistenteExistente) {
      console.log('📝 Asistente existe, actualizando...')

      const { error: errorUpdate } = await supabase
        .from('asistentes_sociales')
        .update({
          correo: userData.correo,
          nombre: userData.nombre,
          roles: userData.roles,
          actualizado_en: new Date().toISOString()
        })
        .eq('rut', userData.rut)

      if (errorUpdate) throw errorUpdate

      console.log('✅ Asistente Social actualizado')

    } else {
      console.log('➕ Creando nuevo Asistente Social...')

      const nuevoAsistente = {
        rut: userData.rut,
        correo: userData.correo,
        nombre: userData.nombre,
        roles: userData.roles,
        horario_atencion: {
          lunes: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
          martes: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
          miercoles: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
          jueves: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '18:00' }],
          viernes: [{ inicio: '09:00', fin: '13:00' }, { inicio: '14:00', fin: '17:00' }]
        },
        sede: null,
        activo: true
      }

      const { error: errorInsert } = await supabase
        .from('asistentes_sociales')
        .insert(nuevoAsistente)

      if (errorInsert) throw errorInsert

      console.log('✅ Asistente Social creado')
    }

  } catch (error) {
    console.error('❌ Error en sincronización de Asistente Social:', error)
  }
}

/**
 * Sincroniza un Estudiante con Supabase
 */
async function sincronizarEstudiante(userData: User) {
  try {
    console.log('🔄 Sincronizando Estudiante con Supabase...')

    const { data: estudianteExistente, error: errorBusqueda } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('rut', userData.rut)
      .single()

    if (errorBusqueda && errorBusqueda.code !== 'PGRST116') {
      throw errorBusqueda
    }

    if (estudianteExistente) {
      console.log('📝 Estudiante existe, actualizando...')

      const { error: errorUpdate } = await supabase
        .from('estudiantes')
        .update({
          correo: userData.correo,
          nombre: userData.nombre,
          roles: userData.roles,
          ultimo_ingreso: new Date().toISOString()
        })
        .eq('rut', userData.rut)

      if (errorUpdate) throw errorUpdate

      console.log('✅ Estudiante actualizado')

    } else {
      console.log('➕ Creando nuevo estudiante...')

      const nuevoEstudiante: EstudianteInsert = {
        rut: userData.rut,
        correo: userData.correo,
        nombre: userData.nombre,
        roles: userData.roles,
        primer_ingreso: new Date().toISOString(),
        ultimo_ingreso: new Date().toISOString(),
        debe_postular: false,
        es_postulante: false,
        es_renovante: false,
        ha_agendado_cita: false,
        carrera: null,
        sede: null,
        anio_ingreso: null,
        tipo_beneficio: null,
        estado_fuas: null,
        fecha_ultima_cita: null,
        notificacion_enviada: false,
        fecha_notificacion: null
      }

      const { error: errorInsert } = await supabase
        .from('estudiantes')
        .insert(nuevoEstudiante)

      if (errorInsert) throw errorInsert

      console.log('✅ Estudiante creado')
    }

    await verificarEstadoFUAS(userData.rut)

  } catch (error) {
    console.error('❌ Error en sincronización de Estudiante:', error)
  }
}

async function verificarEstadoFUAS(rut: string) {
  try {
    console.log('🔍 Verificando estado FUAS...')

    const { data: fuas, error } = await supabase
      .from('estudiantes_fuas')
      .select('*')
      .eq('rut', rut)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    if (fuas) {
      console.log('📋 Estudiante debe postular a FUAS')

      const { error: errorUpdate } = await supabase
        .from('estudiantes')
        .update({
          debe_postular: true,
          tipo_beneficio: fuas.tipo_beneficio,
          estado_fuas: 'pendiente_cita',
          carrera: fuas.carrera
        })
        .eq('rut', rut)

      if (errorUpdate) throw errorUpdate
      console.log('✅ Estado FUAS actualizado')

    } else {
      console.log('ℹ️ Estudiante no debe postular a FUAS')
    }

  } catch (error) {
    console.error('❌ Error al verificar FUAS:', error)
  }
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}