# 📚 CONTEXTO COMPLETO - Proyecto GestorCeduc FUAS

**Fecha:** 8 de enero de 2026  
**Modalidad:** Desarrollo de plataforma FUAS  
**Estado:** 95% Completo

---

## 🎯 OBJETIVO DEL PROYECTO

Plataforma web para automatizar la gestión de postulaciones al beneficio FUAS (Formulario Único de Acreditación Socioeconómica) en un Instituto Técnico de Chile, integrándose con la API externa de CEDUC para autenticación y sincronizando datos con Supabase.

---

## 🛠 TECH STACK

| Categoría | Tecnología | Versión |
|-----------|------------|---------|
| Frontend | React + Vite + TypeScript | 19.2.0 / 7.3.0 |
| Estilos | TailwindCSS | 3.4.17 |
| Base de Datos | Supabase (PostgreSQL + RLS) | - |
| Autenticación | API CEDUC Externa | - |
| Routing | React Router DOM | 7.11.0 |
| Fechas | date-fns + date-fns-tz | 4.1.0 / 3.2.0 |
| Cliente DB | @supabase/supabase-js | 2.89.0 |
| Persistencia | localStorage | - |

---

## ✅ PROGRESO COMPLETADO

### 1. Base de Datos Supabase
- ✅ Tablas: `estudiantes`, `asistentes_sociales`, `citas`, `datos_ministerio`, `datos_instituto`, `estudiantes_fuas`
- ✅ RUT como Primary Key (formato chileno)
- ✅ Foreign Keys con CASCADE/RESTRICT
- ✅ Row Level Security (RLS) activado
- ✅ Índices en columnas de búsqueda frecuente
- ✅ Timestamps automáticos

### 2. Estructura de Carpetas
```
frontend/src/
├── components/
│   ├── ui/                 ✅ COMPLETO
│   │   ├── Button.tsx      (variantes: primary, secondary, danger, ghost)
│   │   ├── Input.tsx       (con label, error, icon)
│   │   ├── Card.tsx        (con header, subtitle, actions)
│   │   ├── Badge.tsx       (status con colores + helpers)
│   │   ├── Modal.tsx       (portal, blur, keyboard support)
│   │   └── ProtectedRoute.tsx
│   └── features/
│       └── TimeSlotPicker.tsx ✅ (slots de 15 min)
├── pages/
│   ├── LoginPage.tsx       ✅ (role-based redirect + password recovery)
│   ├── StudentPortal.tsx   ✅ (citas display + cancel button)
│   ├── SocialWorkerPortal.tsx ✅ (dashboard completo)
│   └── BookAppointmentPage.tsx ✅ (3-step booking)
├── hooks/
│   ├── useCitas.ts         ✅ (CRUD citas completo)
│   └── useStudents.ts      ✅ (filtros, búsqueda, conteo)
├── contexts/
│   └── AuthContext.tsx     ✅ (API CEDUC + sync Supabase)
├── lib/
│   ├── supabase.ts         ✅
│   ├── ceducApi.ts         ✅ (login + recuperar contraseña)
│   ├── rutValidador.ts     ✅ (Módulo 11 + prepareRutForAPI)
│   └── dateUtils.ts        ✅ (zona horaria Chile)
├── types/
│   ├── database.ts         ✅ (interfaces + utility types)
│   └── auth.ts             ✅ (LoginResponse, User, Role)
└── App.tsx                 ✅ (rutas: /, /login, /estudiante, /agendar, /asistente)
```

---

## 🔐 SISTEMA DE AUTENTICACIÓN

### Arquitectura Híbrida
| Componente | Responsabilidad |
|------------|-----------------|
| API CEDUC | Autenticación (login, tokens, roles) |
| Supabase | Almacenamiento de datos (PostgreSQL) |
| localStorage | Persistencia de sesión (7 días TTL) |

### Roles de Asistente Social
```typescript
const ROLES_ASISTENTE_SOCIAL = ['jef_dae', 'enc_aes']
```

- `jef_dae` → Jefa de Asuntos Estudiantiles
- `enc_aes` → Encargada de Asuntos Estudiantiles

### Flujo de Login
1. POST a API CEDUC con username (RUT sin DV) y password
2. API responde con token + roles del usuario
3. `tieneRolAsistente()` verifica si tiene rol `jef_dae` o `enc_aes`
4. Si es asistente → sync con tabla `asistentes_sociales`
5. Si es estudiante → sync con tabla `estudiantes`
6. Guardar en localStorage
7. Redirigir según rol:
   - Asistente → `/asistente`
   - Estudiante → `/estudiante`

---

## 📱 PÁGINAS IMPLEMENTADAS

### LoginPage.tsx
- ✅ UI con gradiente azul/púrpura
- ✅ Input: Username (RUT sin DV, 7-9 dígitos)
- ✅ Validación de campos
- ✅ Integración con API CEDUC
- ✅ Modal de recuperación de contraseña
- ✅ Redirección por rol (`isAsistenteSocial`)

### StudentPortal.tsx
- ✅ Header con info del usuario y logout
- ✅ Alert FUAS si `debe_postular === true`
- ✅ Card de información personal (RUT, nombre, correo, carrera, sede)
- ✅ Card de estado FUAS
- ✅ Sección "Próximas Citas" con lista de citas pendientes/confirmadas
- ✅ **Botón "Cancelar"** en cada cita con confirmación
- ✅ Sección "Historial de Citas"
- ✅ Botón "Agendar" que navega a `/agendar`

### BookAppointmentPage.tsx
- ✅ Flujo de 3 pasos con barra de progreso
- ✅ **Paso 1:** Seleccionar asistente social
- ✅ **Paso 2:** Seleccionar fecha y hora
  - DatePicker con min/max (mañana a 30 días)
  - Validación de fines de semana
  - **Validación: 1 cita por semana** (muestra error si ya tiene)
  - TimeSlotPicker con slots de 15 minutos
- ✅ **Paso 3:** Confirmar cita con selección de motivo
- ✅ Pantalla de éxito con redirección
- ✅ **Fix del desfase de fecha** con `parseDateString()`

### SocialWorkerPortal.tsx
- ✅ Header con info del asistente y logout
- ✅ Dashboard de estadísticas:
  - Estudiantes pendientes FUAS
  - Citas de hoy
  - Citas completadas
- ✅ **Tab "Estudiantes":**
  - Tabla con RUT, nombre, correo, estado FUAS, cita
  - Búsqueda por RUT o nombre
  - Filtro: todos / pendientes FUAS
- ✅ **Tab "Citas":**
  - Citas de hoy con acciones
  - Lista de todas las citas
- ✅ Modal de detalle de cita con acciones:
  - Confirmar
  - Marcar completada
  - Cancelar

---

## 🧩 COMPONENTES UI

| Componente | Archivo | Características |
|------------|---------|-----------------|
| Button | `Button.tsx` | variants: primary/secondary/danger/ghost, sizes: sm/md/lg, loading state |
| Badge | `Badge.tsx` | variants: success/warning/danger/info/default + helpers para estados |
| Input | `Input.tsx` | label, error state, icon opcional |
| Card | `Card.tsx` | title, subtitle, actions slot |
| Modal | `Modal.tsx` | portal, backdrop blur, Escape key, sizes: sm/md/lg |
| TimeSlotPicker | `TimeSlotPicker.tsx` | slots 15min, 9:00-18:00, availability check |

---

## 🪝 CUSTOM HOOKS

### useCitas.ts
```typescript
const {
  fetchCitasByEstudiante,   // Citas de un estudiante
  fetchCitasByAsistente,    // Citas de un asistente
  fetchCitasHoy,            // Citas de hoy
  fetchCitasEnRango,        // Citas en rango de fechas
  crearCita,                // Crear nueva cita
  cambiarEstadoCita,        // Cambiar estado
  cancelarCita,             // Cancelar cita
  loading
} = useCitas()
```

### useStudents.ts
```typescript
const {
  fetchEstudiantes,           // Lista con filtros
  fetchEstudianteByRut,       // Por RUT
  actualizarEstudiante,       // Update
  contarEstudiantesPendientes, // Count pendientes FUAS
  loading
} = useStudents()
```

---

## 🗓 REGLAS DE AGENDAMIENTO

1. **Límite semanal:** 1 cita por semana por estudiante
2. **Horario:** Lunes a Viernes, 9:00 - 18:00
3. **Duración:** 15 minutos por cita
4. **Anticipación:** Mínimo 1 día, máximo 30 días
5. **Cancelación:** Estudiante puede cancelar con confirmación

---

## 🐛 PROBLEMAS RESUELTOS

### Desfase de 1 día en fechas
**Problema:** `new Date("2026-01-20")` se interpretaba como UTC, mostrando "19 de enero" en Chile (UTC-3)

**Solución:** Función `parseDateString()`:
```typescript
const parseDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)  // Hora local, no UTC
}
```

### Otros errores corregidos
- `verbatimModuleSyntax` → usar `import type` para tipos
- URL duplicada `/Login/Login` → Base URL sin endpoint
- Typo `corre` vs `correo` en columnas
- `throw Error` vs `throw error` (case-sensitive)

---

## 📊 ESTADO ACTUAL: 95% Completo

| Módulo | Progreso |
|--------|----------|
| Setup e infraestructura | 100% ✅ |
| Utilidades base | 100% ✅ |
| Autenticación híbrida | 100% ✅ |
| LoginPage | 100% ✅ |
| StudentPortal | 100% ✅ |
| BookAppointmentPage | 100% ✅ |
| SocialWorkerPortal | 100% ✅ |
| Componentes UI | 100% ✅ |
| Custom Hooks | 100% ✅ |
| ETL Python | 0% ⏳ |
| Dashboard Métricas | 0% ⏳ |
| Notificaciones Email | 0% ⏳ |

---

## 🎯 PENDIENTE

### Prioridad Alta
- [ ] Probar flujo completo en producción

### Prioridad Media
- [ ] Scripts Python (ETL) para CSVs del gobierno
- [ ] Dashboard con métricas y gráficos
- [ ] Sistema de notificaciones (email recordatorio 24h)
- [ ] Export de reportes a Excel

### Prioridad Baja
- [ ] Selector de rol para usuarios con múltiples roles
- [ ] Confirmar cita desde email
- [ ] Historial de cambios de estado

---

## 🚀 COMANDOS ÚTILES

```bash
# Desarrollo
cd frontend && npm run dev

# Build producción
cd frontend && npm run build

# Verificar tipos
cd frontend && npx tsc --noEmit
```

---

**Última actualización:** 8 de enero de 2026, 09:07 hrs
