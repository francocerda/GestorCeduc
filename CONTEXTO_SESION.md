# 📚 CONTEXTO COMPLETO - Proyecto GestorCeduc FUAS (Sesión Actual)

**Fecha:** 7 de enero de 2026  
**Modalidad:** Aprendizaje paso a paso con profesor  
**Enfoque:** Enseñar conceptos antes de escribir código, usando terminal y explicaciones detalladas

---

## 🎯 OBJETIVO DEL PROYECTO

Desarrollar una plataforma web para automatizar la gestión de postulaciones al beneficio estatal FUAS (Formulario Único de Acreditación Socioeconómica) en un Instituto Técnico de Chile.

---

## 🛠 TECH STACK

- **Frontend:** React 19.2.0 + Vite 7.3.0 + TypeScript
- **Estilos:** TailwindCSS 3.4.17
- **Backend/DB:** Supabase (PostgreSQL + Auth + Row Level Security)
- **Routing:** React Router DOM 7.11.0
- **Fechas:** date-fns 4.1.0 + date-fns-tz 3.2.0
- **Cliente HTTP:** @supabase/supabase-js 2.89.0

---

## ✅ PROGRESO COMPLETADO

### 1. **Base de Datos Supabase**
- ✅ 3 tablas creadas: `students`, `social_workers`, `appointments`
- ✅ Foreign Keys configuradas con CASCADE/SET NULL
- ✅ Row Level Security (RLS) activado
- ✅ Políticas de acceso por rol

### 2. **Estructura del Proyecto**
```
GestorCeduc/
├─ frontend/
│  ├─ src/
│  │  ├─ components/
│  │  │  ├─ ui/          (componentes genéricos)
│  │  │  └─ features/    (componentes específicos FUAS)
│  │  ├─ pages/          (vistas completas)
│  │  │  ├─ LoginPage.tsx ✅ (COMPLETA + conectada a AuthContext)
│  │  │  ├─ StudentPortal.tsx (placeholder)
│  │  │  └─ SocialWorkerPortal.tsx (placeholder)
│  │  ├─ lib/            (utilidades)
│  │  │  ├─ supabase.ts ✅ (cliente configurado)
│  │  │  ├─ rutValidador.ts ✅ (Módulo 11 completo + cleanRut)
│  │  │  └─ dateUtils.ts ✅ (zona horaria Chile)
│  │  ├─ types/
│  │  │  └─ database.ts ✅ (interfaces TypeScript)
│  │  ├─ hooks/          (vacío - pendiente)
│  │  ├─ contexts/       ✅ AuthContext.tsx (COMPLETO)
│  │  └─ constants/      (vacío - pendiente)
│  └─ App.tsx ✅ (React Router + AuthProvider + Loading screen)
├─ backend/              (vacío - scripts Python pendientes)
└─ docs/                 (CSVs del gobierno)
```

### 3. **Archivos Creados y Funcionales**

**a) `lib/supabase.ts`**
- Cliente de Supabase configurado
- Credenciales del proyecto conectadas
- Listo para usar en toda la app

**b) `types/database.ts`**
- Interfaces: `Student`, `SocialWorker`, `Appointment`
- Enums: `StatusFUAS`, `EstadoCita`
- Utility types: `AppointmentInsert`, `AppointmentUpdate`

**c) `lib/rutValidador.ts`**
- Algoritmo Módulo 11 implementado
- Funciones: `cleanRut()`, `formatRut()`, `validateRut()`, `calculateDV()`
- Testeado y funcionando correctamente
- `cleanRut()` usada en LoginPage para eliminar puntos/guiones

**d) `lib/dateUtils.ts`**
- Conversión UTC ↔ America/Santiago
- Formateo en español chileno
- Funciones de utilidad para bloques horarios

**e) `contexts/AuthContext.tsx` ✅ COMPLETO**
- Context API para manejo de autenticación global
- Provider que envuelve toda la app
- Estados: `user` (User | null), `loading` (boolean)
- Funciones: `signIn(email, password)`, `signOut()`
- useEffect con `getSession()` para detectar sesión guardada
- Listener `onAuthStateChange` para sincronización en tiempo real
- Cleanup correcto con `unsubscribe()`
- Hook personalizado `useAuth()` para facilitar consumo

**f) `App.tsx` ✅ COMPLETO**
- Envuelto con `<AuthProvider>`
- Componente `AppRoutes` separado para usar `useAuth()`
- Pantalla de carga mientras verifica sesión (`loading === true`)
- Spinner animado con TailwindCSS
- React Router configurado
- Rutas: `/`, `/login`, `/estudiante`, `/asistente`
- Página 404 implementada

**g) `pages/LoginPage.tsx` ✅ COMPLETA Y CONECTADA**
- UI profesional con gradiente de fondo
- Tarjeta con sombra centrada
- Inputs controlados (React state)
- Validación de formulario completa:
  - Campos vacíos
  - RUT válido (Módulo 11)
  - Contraseña mínima (6 caracteres)
- **Integración con AuthContext:**
  - Usa `const { signIn } = useAuth()`
  - Llama a `signIn(email, password)` en lugar de Supabase directo
  - Limpia el RUT con `cleanRut()` antes de generar email
- Manejo de errores con mensaje visual
- Estado de loading
- **Login funcional 100%** ✅

---

## 📚 CONCEPTOS ENSEÑADOS Y APRENDIDOS

### **1. Estructura de Carpetas**
- Separación de responsabilidades
- `ui/` vs `features/`
- Single Source of Truth
- Carpeta `contexts/` para estado global

### **2. TypeScript**
- Interfaces vs Types
- Union types (`'A' | 'B' | 'C'`)
- Optional properties (`field?: string`)
- Nullable properties (`field: string | null`)
- Utility types: `Omit<>`, `Partial<>`
- **Generics:** `<T>` para tipos flexibles
- **import type vs import:** Diferencia entre importar tipos y código
- `verbatimModuleSyntax` y por qué usar `import type { User }`

### **3. Git y GitHub**
- `git init`, `git add`, `git commit`
- `.gitignore` para excluir `node_modules/`
- Problema de repositorios anidados (solucionado)
- Personal Access Tokens para autenticación

### **4. Validación de RUT Chileno**
- Algoritmo Módulo 11 paso a paso
- Inversión de dígitos y multiplicación por secuencia 2-7
- Reglas especiales (11 → 0, 10 → K)
- **Limpieza con `cleanRut()`:** eliminar puntos, guiones y espacios
- **Formateo con `formatRut()`:** agregar puntos y guión
- **Uso práctico:** limpiar RUT antes de generar email

### **5. Zona Horaria**
- UTC vs America/Santiago
- `toZonedTime` y `fromZonedTime`
- Por qué guardar UTC en BD
- Horario de verano automático (date-fns-tz)

### **6. React Fundamentals**
- JSX: HTML dentro de JavaScript
- Componentes funcionales
- Props y retorno de JSX
- Componentes anidados y children

### **7. React State (useState)**
- Controlled components
- `value` + `onChange` para inputs
- Re-renderizado cuando cambia el estado
- Por qué no usar variables normales

### **8. React Context API** ⭐ NUEVO
- **Problema que resuelve:** compartir datos sin prop drilling
- **createContext:** crear el contenedor de datos
- **Provider:** componente que provee los datos
- **Consumer:** componentes que consumen los datos (con useContext)
- **Provider pattern:** envolver la app con `<AuthProvider>`
- **Hook personalizado:** `useAuth()` para facilitar consumo
- **Regla importante:** no usar useContext en el mismo componente que tiene el Provider
- **Analogía:** WiFi que transmite datos a toda la app

### **9. React useEffect** ⭐ NUEVO
- Se ejecuta después del render
- Array de dependencias `[]` = solo al montar
- `return` = cleanup function (al desmontar)
- **Uso en AuthContext:**
  - `getSession()` para detectar sesión guardada
  - `onAuthStateChange()` para escuchar cambios en tiempo real
  - `subscription.unsubscribe()` para cleanup

### **10. Event Listeners** ⭐ NUEVO
- Escuchan eventos en tiempo real
- `onAuthStateChange` escucha: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED
- Importante hacer cleanup con `unsubscribe()`
- Sincronización automática entre pestañas del navegador

### **11. Async/Await y Promises** ⭐ PROFUNDIZADO
- Operaciones asíncronas (que tardan tiempo)
- `async` marca una función como asíncrona
- `await` pausa la ejecución hasta que la Promise se resuelva
- `try/catch/finally` para manejo de errores
- **Regla:** no puedes usar `await` sin `async`

### **12. Operadores de JavaScript Modernos** ⭐ NUEVO
- **Optional Chaining (`?.`):** acceso seguro a propiedades
  - `session?.user` → no crashea si session es null
- **Nullish Coalescing (`??`):** valor por defecto
  - `session?.user ?? null` → usa null si user es undefined
- **Destructuring anidado:** 
  - `{ data: { session } }` → sacar session de dentro de data
- **Shorthand properties:**
  - `{ user }` equivale a `{ user: user }`

### **13. React Router**
- `BrowserRouter`, `Routes`, `Route`
- Navegación sin recargar página (SPA)
- Ruta catch-all (`path="*"`)
- `Navigate` para redirecciones

### **14. CSS con TailwindCSS**
- Box Model: margin, border, padding, content
- Flexbox: `flex`, `items-center`, `justify-center`
- Estados: `hover:`, `focus:`, `active:`, `disabled:`
- Responsive: mobile-first
- Utility classes vs CSS tradicional
- Gradientes: `bg-gradient-to-br`
- Sombras: `shadow-2xl`
- Transiciones: `transition-colors`, `duration-200`
- **Animaciones:** `animate-spin` para spinners

### **15. HTML Semántico**
- Jerarquía padre-hijo (divs anidados)
- `<button>` vs `<a>` (acción vs navegación)
- `<label>` + `<input>` asociados
- Atributos: `placeholder`, `type`, `disabled`

### **16. Formularios en React**
- `e.preventDefault()` para evitar recarga
- Validación antes de enviar
- Manejo de errores con estado
- Conditional rendering (`{error && ...}`)
- Loading states

### **17. Supabase Authentication** ⭐ NUEVO
- **ANON KEY vs SERVICE_ROLE KEY:**
  - Anon: segura para frontend, respeta RLS
  - Service Role: solo backend, ignora RLS
- **signInWithPassword:** autenticación con email/password
- **signOut:** cerrar sesión
- **getSession:** obtener sesión guardada en localStorage
- **onAuthStateChange:** listener de eventos de auth
- **JWT tokens:** guardados automáticamente en localStorage
- **Email format:** convertir RUT a email (`11381569-8@ceduc.cl`)

### **18. Debugging y Resolución de Errores** ⭐ NUEVO
- Usar `console.log` para debug
- Leer errores de la consola del navegador
- Entender errores de TypeScript
- `verbatimModuleSyntax` error y cómo solucionarlo
- "Invalid login credentials" → usuario no existe o password incorrecta
- Verificar formato de datos enviados (RUT con/sin puntos)

### **19. Terminal y Comandos**
- `pwd`, `cd`, `ls`, `mkdir`, `touch`, `cat`, `rm`
- `npm run dev`, `npx tsx`
- `git status`, `git add`, `git commit`, `git push`
- Flags: `-p`, `-rf`, `-la`, `-u`

---

## 🔧 CONFIGURACIONES IMPORTANTES

### **Supabase**
- URL: Configurada en `lib/supabase.ts`
- API Key (anon): Configurada
- ⚠️ Nunca subir service_role key al repo

### **TailwindCSS**
- Versión 3.4.17 (estable)
- Content: `["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]`
- PostCSS configurado

### **Vite**
- Puerto: 5173
- HMR activado
- TypeScript mode: strict

---

## 🚧 PENDIENTE POR IMPLEMENTAR

### **PRIORIDAD ALTA (Siguiente sesión)**

#### **1. Redirigir después del Login** ⭐
**Ubicación:** `pages/LoginPage.tsx`

**Problema actual:**
- Login exitoso solo muestra un `alert()`
- Usuario se queda en LoginPage

**Solución:**
```typescript
import { useNavigate } from 'react-router-dom'

const navigate = useNavigate()

// Después del login exitoso:
navigate('/estudiante')  // O según el rol del usuario
```

**Conceptos a enseñar:**
- `useNavigate()` hook de React Router
- Navegación programática
- Redirección condicional según rol

---

#### **2. Rutas Protegidas** ⭐
**Ubicación:** Crear `components/ProtectedRoute.tsx`

**Propósito:**
- Si NO hay usuario → redirigir a `/login`
- Si hay usuario → mostrar la página

**Implementación:**
```typescript
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  
  if (loading) return <div>Cargando...</div>
  
  if (!user) return <Navigate to="/login" replace />
  
  return children
}
```

**Uso:**
```typescript
<Route 
  path="/estudiante" 
  element={
    <ProtectedRoute>
      <StudentPortal />
    </ProtectedRoute>
  } 
/>
```

---

#### **3. Botón de Logout** ⭐
**Ubicación:** Agregar en `StudentPortal.tsx` y `SocialWorkerPortal.tsx`

**Implementación:**
```typescript
const { signOut } = useAuth()
const navigate = useNavigate()

const handleLogout = async () => {
  await signOut()
  navigate('/login')
}

return (
  <button onClick={handleLogout}>Cerrar Sesión</button>
)
```

---

#### **4. Completar StudentPortal**
**Ubicación:** `pages/StudentPortal.tsx`

**Mostrar:**
- Datos del estudiante (RUT, nombre, email)
- Estado FUAS actual
- Citas agendadas (tabla o cards)
- Botón "Agendar nueva cita"
- Botón "Cerrar Sesión"

**Obtener datos:**
```typescript
const { user } = useAuth()

const { data: student } = await supabase
  .from('students')
  .select('*')
  .eq('id', user.id)
  .single()

const { data: appointments } = await supabase
  .from('appointments')
  .select('*, social_workers(*)')
  .eq('student_id', user.id)
  .order('inicio', { ascending: true })
```

**Conceptos a enseñar:**
- Consultas a Supabase desde React
- `useEffect` para cargar datos al montar
- Renderizado condicional (si hay datos, mostrar tabla)
- Loading states mientras carga

---

#### **5. Obtener rol del usuario**
**Ubicación:** `AuthContext.tsx` o consulta a BD

**Problema:**
- Necesitamos saber si el usuario es estudiante o asistente social
- Para redirigir a la página correcta después del login

**Opciones:**

**Opción A: Metadata en Supabase Auth**
```typescript
// Al crear usuario, agregar metadata:
user_metadata: { role: 'student' }

// En AuthContext:
const role = user?.user_metadata?.role
```

**Opción B: Consultar tabla students o social_workers**
```typescript
// Verificar en qué tabla existe el usuario
const { data: student } = await supabase
  .from('students')
  .select('id')
  .eq('id', user.id)
  .single()

if (student) return 'student'
else return 'social_worker'
```

---

### **PRIORIDAD MEDIA**

#### **6. Sistema de Agendamiento**
**Ubicación:** `pages/BookAppointmentPage.tsx`

**Flujo:**
1. Mostrar calendario mensual
2. Usuario selecciona día
3. Mostrar bloques disponibles (15 minutos)
4. Usuario selecciona hora
5. Confirmar y crear cita

**Componentes necesarios:**
- `components/features/Calendar.tsx`
- `components/features/TimeSlotPicker.tsx`

**Lógica:**
- Generar bloques de 9:00 a 18:00 cada 15 min
- Restar citas ya agendadas
- Solo mostrar días laborales (L-V)

---

#### **7. Portal Asistente Social**
**Ubicación:** `pages/SocialWorkerPortal.tsx`

**Secciones:**
- Lista de todos los estudiantes (tabla paginada)
- Filtros: por estado FUAS, por nombre/RUT
- Vista de calendario con todas las citas
- Gestión de citas (cambiar estado, reasignar)

---

#### **8. Componentes UI Reutilizables**
**Ubicación:** `components/ui/`

**Crear:**
- `Button.tsx` (variantes: primary, secondary, danger)
- `Input.tsx` (con error state)
- `Card.tsx`
- `Badge.tsx` (para estados: pendiente, adjudicado)
- `Modal.tsx`
- `Table.tsx`

---

#### **9. Custom Hooks**
**Ubicación:** `hooks/`

**Crear:**
- `useStudents.ts` → Obtener datos de estudiantes
- `useAppointments.ts` → CRUD de citas
- `useForm.ts` → Validación genérica de forms

---

### **PRIORIDAD BAJA**

#### **10. Scripts Python (ETL)**
**Ubicación:** `backend/scripts/`

**Propósito:**
- Leer CSVs del gobierno (en `docs/`)
- Cruzar con base de datos del instituto
- Detectar nuevos postulantes
- Actualizar estados FUAS
- Cargar en Supabase

**Librerías:** pandas, psycopg2, python-dotenv

---

#### **11. Dashboard con Métricas**
- Gráficos de postulantes por mes
- Estados FUAS (torta)
- Tasa de asistencia a citas
- Librería: recharts o chart.js

---

#### **12. Sistema de Notificaciones**
- Email recordatorio 24h antes de cita
- Usar Supabase Edge Functions
- O servicio externo (SendGrid, Resend)

---

#### **13. Export de Reportes**
- Generar Excel con lista de estudiantes
- Filtros personalizados
- Librería: xlsx o exceljs

---

## 📝 NOTAS IMPORTANTES PARA EL PRÓXIMO CHAT

### **Enfoque Pedagógico:**
- ✅ **SIEMPRE explicar conceptos ANTES de escribir código**
- ✅ Usar analogías del mundo real
- ✅ Mostrar errores comunes y cómo solucionarlos
- ✅ Enseñar a través de la terminal (comandos paso a paso)
- ✅ Validar que el alumno entienda antes de continuar
- ✅ Hacer preguntas de reflexión
- ✅ Explicar el "por qué", no solo el "cómo"

### **Metodología:**
1. Explicar el concepto teórico
2. Mostrar la sintaxis
3. Crear el código juntos
4. Probar que funciona
5. Reflexionar sobre lo aprendido

### **Lo que el alumno necesita:**
- Explicaciones de CSS/HTML (le cuesta la estructura)
- Entender el flujo de datos en React
- Práctica con async/await y Promises
- Conceptos de autenticación y sesiones

---

## 🐛 ERRORES SOLUCIONADOS EN ESTA SESIÓN

1. **Repositorios Git anidados:** Se eliminó `.git` de `frontend/` (sesión anterior)
2. **TailwindCSS `timeZone` error:** Eliminada propiedad no válida en `format()` (sesión anterior)
3. **Focus states en inputs:** Agregadas clases `focus:outline-none` y `focus:ring-2` (sesión anterior)
4. **❌ Página en blanco al cargar:** Error de import type
   - **Problema:** `import { User }` intentaba importar User como código
   - **Solución:** Cambiar a `import type { User }` para importar solo el tipo
   - **Causa:** `verbatimModuleSyntax` activado en tsconfig.json
5. **❌ "Invalid login credentials":** Email mal formado
   - **Problema:** Usuario escribía `11.381.569-8`, se generaba email con puntos
   - **Pero en Supabase:** usuario estaba sin puntos `11381569-8@ceduc.cl`
   - **Solución:** Usar `cleanRut()` antes de generar el email
   - **Aprendizaje:** Siempre normalizar datos antes de compararlos

---

## 🔗 RECURSOS ÚTILES

- **Supabase Docs:** https://supabase.com/docs
- **React Router Docs:** https://reactrouter.com/en/main
- **TailwindCSS Docs:** https://tailwindcss.com/docs
- **date-fns Docs:** https://date-fns.org/docs
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/

---

## 🎯 OBJETIVO DE LA PRÓXIMA SESIÓN

**Implementar navegación post-login y rutas protegidas**

**Tareas específicas:**
1. Agregar redirección después del login exitoso (con `useNavigate`)
2. Crear componente `ProtectedRoute` para proteger rutas privadas
3. Implementar botón de logout funcional
4. Comenzar a diseñar StudentPortal básico (mostrar datos del usuario)

**Conceptos a enseñar:**
- Navegación programática con React Router
- Rutas protegidas (conditional rendering)
- Consultas a Supabase desde componentes React
- useEffect para cargar datos

---

## 📊 ESTADO ACTUAL: 55% Completo

- ✅ Setup e infraestructura: 100%
- ✅ Utilidades base: 100%
- ✅ LoginPage UI: 100%
- ✅ **Autenticación: 100%** ⭐ (AuthContext + Login funcional)
- ⏳ Rutas protegidas: 0%
- ⏳ Portal estudiante: 10%
- ⏳ Portal asistente: 0%
- ⏳ Agendamiento: 0%
- ⏳ ETL Python: 0%

---

**Última actualización:** 7 de enero de 2026, 01:30 hrs
