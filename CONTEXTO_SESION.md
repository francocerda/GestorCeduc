# 📚 CONTEXTO COMPLETO - Proyecto GestorCeduc FUAS

**Fecha:** 12 de enero de 2026  
**Modalidad:** Desarrollo de plataforma FUAS  
**Estado:** 99% Completo  
**Repositorio:** [github.com/francocerda/GestorCeduc](https://github.com/francocerda/GestorCeduc)

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
| Emails | Elastic Email API | v2 |
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

#### Esquema tabla `estudiantes_fuas` (IMPORTANTE)
```sql
-- Esquema real verificado el 9 de enero 2026
CREATE TABLE estudiantes_fuas (
  rut TEXT PRIMARY KEY,
  correo TEXT NOT NULL,
  nombre TEXT,
  debe_postular BOOLEAN DEFAULT true,
  tipo_beneficio TEXT,      -- antes: formulario_ministerio
  carrera TEXT,
  origen TEXT,              -- antes: sede
  fecha_cruce TIMESTAMPTZ DEFAULT now()
);
```
> ⚠️ **Nota:** NO existen las columnas `formulario_ministerio`, `observacion_ministerio`, `sede`, `notificacion_enviada`

### 3. Backend e Integración (Nuevo)
- ✅ Servidor Node.js + Express
- ✅ Conexión a SQL Server (mssql) con soporte para TLS legacy
- ✅ Endpoints API: Sync Instituto, Cruzar Datos, Estudiantes Pendientes
- ✅ Cliente Supabase (service role) para operaciones administrativas
- ✅ Manejo de grandes volúmenes de datos (50MB payload limit)

### 2. Estructura de Carpetas
```
backend/                   ✅ NUEVO
├── server.js              ✅ (API Express + SQL Sync + Cruce)
├── test-connection.js     ✅ (Script prueba SQL Server)
├── package.json           ✅
└── .env                   ✅ (Credenciales SQL + Supabase Service Key)

frontend/src/
├── components/
│   ├── ui/                    ✅ COMPLETO
│   │   ├── Button.tsx         (variantes: primary, secondary, danger, ghost)
│   │   ├── Input.tsx          (con label, error, icon)
│   │   ├── Card.tsx           (con header, subtitle, actions)
│   │   ├── Badge.tsx          (status con colores + helpers)
│   │   ├── Modal.tsx          (portal, blur, keyboard support)
│   │   ├── FileUpload.tsx     ✅ (drag & drop, validación)
│   │   ├── Skeleton.tsx       ✅ (loading states)
│   │   ├── Toast.tsx          ✅ (notificaciones)
│   │   └── ProtectedRoute.tsx
│   └── features/
│       └── TimeSlotPicker.tsx ✅ (slots de 15 min)
├── pages/
│   ├── LoginPage.tsx          ✅ (role-based redirect + password recovery)
│   ├── StudentPortal.tsx      ✅ (citas display + cancel button)
│   ├── SocialWorkerPortal.tsx ✅ (dashboard + tabs + carga CSV)
│   └── BookAppointmentPage.tsx ✅ (3-step booking)
├── hooks/
│   ├── useCitas.ts            ✅ (CRUD citas completo)
│   └── useStudents.ts         ✅ (filtros, búsqueda, conteo)
├── contexts/
│   └── AuthContext.tsx        ✅ (API CEDUC + sync Supabase)
├── lib/
│   ├── supabase.ts            ✅
│   ├── ceducApi.ts            ✅ (login + recuperar contraseña)
│   ├── rutValidador.ts        ✅ (Módulo 11 + prepareRutForAPI)
│   ├── dateUtils.ts           ✅ (zona horaria Chile)
│   ├── csvParser.ts           ✅ (parseo archivos Ministerio)
│   └── emailService.ts        ✅ (Elastic Email API)
├── types/
│   ├── database.ts            ✅ (interfaces + utility types)
│   └── auth.ts                ✅ (LoginResponse, User, Role)
└── App.tsx                    ✅ (rutas: /, /login, /estudiante, /agendar, /asistente)
```

---

## 📤 SISTEMA DE GESTIÓN FUAS (Sync + Cukce)

### Arquitectura de Integración
| Componente | Descripción |
|------------|-------------|
| `Sync Instituto` | Backend se conecta a SQL Server y sincroniza matriculados a Supabase (tabla `datos_instituto`) |
| `Carga Ministerio` | Frontend sube CSV gigantey backend procesa cruce de datos (RUTs) |
| `Paginación` | Tabla optimizada con paginación (30 items) para visualizar resultados del cruce |

### Flujo de Datos
1. **Sincronización:** SQL Server -> Backend -> Supabase (`datos_instituto`)
2. **Carga CSV:** Archivo local -> Frontend -> Backend (`datos_ministerio` en memoria)
3. **Cruce:** `datos_ministerio` ∩ `datos_instituto` -> `estudiantes_fuas`
4. **Visualización:** Frontend lee `estudiantes_fuas` (estudiantes matriculados que deben postular)

### Funcionalidades del Parser
```typescript
parsearCSVMinisterio(contenido: string): ResultadoParseCSV
// - Detecta automáticamente separador (;, ,, tab)
// - Busca columnas: RUT, DV, TIPO, OBSERVACION
// - Limpia y valida RUTs (7-9 dígitos)
// - Reporta errores por fila
// - Retorna: datos válidos, errores, estadísticas

validarArchivoCSV(archivo: File): { valido: boolean; error?: string }
// - Verifica extensión .csv
// - Límite 50MB

leerArchivoComoTexto(archivo: File): Promise<string>
// - Lee archivo como UTF-8
```

### Formato CSV Aceptado
```csv
RUT;DV;TIPO_FORMULARIO;OBSERVACION
12345678;9;FUAS_2026;pendiente
```

---

## 📧 SISTEMA DE NOTIFICACIONES EMAIL

### Configuración (Elastic Email API)
```typescript
// Variables de entorno
VITE_ELASTIC_EMAIL_API_KEY
VITE_PLATFORM_URL
VITE_SENDER_EMAIL
```

### Funciones Disponibles
```typescript
enviarNotificacionFUAS(estudiante: DatosEstudiante): Promise<ResultadoEnvio>
// - Envía email con template HTML profesional
// - Incluye botón de acceso a la plataforma
// - Instrucciones paso a paso

enviarNotificacionesMasivas(estudiantes: DatosEstudiante[]): Promise<Resumen>
// - Envío secuencial con rate limiting (200ms entre emails)
// - Retorna conteo exitosos/fallidos

verificarConexionEmail(): Promise<boolean>
// - Verifica conexión con API
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
- ✅ **Tab "Carga de Datos":**
  - Upload de CSV del Ministerio
  - Modal con resultados del procesamiento
  - Contador de registros válidos/errores
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
| FileUpload | `FileUpload.tsx` | drag & drop, validación tipo/tamaño, preview |
| Skeleton | `Skeleton.tsx` | loading placeholders animados |
| Toast | `Toast.tsx` | notificaciones: success/error/warning/info, auto-dismiss |
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

### Integración Backend
- **Error 413 (Payload Too Large):** Aumentado límite de `express.json` a **50MB** para soportar CSVs del Ministerio (140k+ registros).
- **Error Sync (`fecha_sync`):** Corregido nombre de columna a `fecha_carga` para coincidir con esquema de Supabase.
- **Conexión SQL Server Legacy:** Configurado `encrypt: false` y `trustServerCertificate: true` para compatibilidad.
- **Optimización Cruce de Datos (CRÍTICO):** 
  - Problema: Error 500 al enviar 144k RUTs en consulta SQL `IN`.
  - Solución: Procesamiento **In-Memory**. Se carga la tabla instituto (~2200 registros) a RAM y se cruza localmente.
- **Batch Upsert:** Implementada inserción por lotes de 500 registros para evitar timeouts en Supabase al guardar resultados masivos.
- **Normalización de RUTs:** Corrección crítica en `limpiarRut` para eliminar Dígito Verificador antes de comparar, resolviendo el problema de "cero coincidencias".
- **Desincronización de Columnas Supabase (9 enero 2026 - CRÍTICO):**
  - **Problema:** El cruce encontraba 285 estudiantes pero la tabla `estudiantes_fuas` quedaba vacía. El backend intentaba insertar columnas que no existían en la tabla.
  - **Columnas incorrectas:** `formulario_ministerio`, `observacion_ministerio`, `sede`, `notificacion_enviada`
  - **Columnas reales:** `rut`, `correo`, `nombre`, `debe_postular`, `tipo_beneficio`, `carrera`, `origen`, `fecha_cruce`
  - **Solución:** Corregido mapeo en `server.js` (líneas 217-230): `sede` → `origen`, `formulario_ministerio` → `tipo_beneficio`. Actualizado tipo `EstudianteFUASCruce` en `instituteApi.ts`. Removidas referencias a `notificacion_enviada` en `SocialWorkerPortal.tsx`.
- **FileUpload se quedaba "procesando":** El componente no reseteaba el estado `procesandoCSV` cuando el CSV no tenía registros válidos. Corregido agregando `setProcesandoCSV(false)` antes del `return` temprano.
---

## 📤 SISTEMA DE DOCUMENTOS (NUEVO - 12 Enero 2026)

### Feature A: Estudiantes No Postulantes suben Comprobante

**Flujo:**
1. Sistema detecta estudiantes que no aparecen en CSV del Ministerio → `no_postularon_fuas`
2. Asistente envía recordatorio por email
3. Estudiante entra a su portal → ve alerta naranja "Debes subir comprobante"
4. Estudiante sube PDF → se guarda en Supabase Storage bucket `fuas-comprobantes`
5. Asistente revisa documento en Tab FUAS → Valida ✓ o Rechaza ✗
6. Si rechazado: estudiante puede re-subir con nuevo documento

**Estados de documento:**
| Estado | Vista Estudiante | Vista Asistente |
|--------|------------------|-----------------|
| `null` (sin doc) | Alerta naranja + botón subir | `-` |
| `pendiente` | "Tu documento está en revisión" | Botón "Revisar" |
| `validado` | Alerta verde "Validado" | Badge verde |
| `rechazado` | Alerta roja + comentario + re-subir | Badge rojo |

### Feature B: Documento obligatorio al Completar Cita

**Flujo:**
1. Asistente abre cita confirmada → click "Completar"
2. Se abre modal con campos obligatorios:
   - Descripción de la sesión (textarea)
   - Comprobante PDF (FileUpload)
3. Documento se guarda en bucket `citas-documentos`
4. Cita se marca como completada con URL del documento

### Archivos Nuevos/Modificados

| Archivo | Cambio |
|---------|--------|
| `storageService.ts` | **NUEVO** - Funciones: `subirDocumentoCita()`, `subirComprobanteFUAS()`, `validarArchivoPDF()` |
| `StudentPortal.tsx` | Alerta dinámica según estado documento + upload de comprobante FUAS |
| `SocialWorkerPortal.tsx` | Modal completar cita con PDF + Modal validación documento |
| `useCitas.ts` | Función `completarCitaConDocumento()` |
| `instituteApi.ts` | Interface `NoPostulanteResult` con campos documento |

### Columnas agregadas en Supabase

```sql
-- Tabla no_postularon_fuas
ALTER TABLE no_postularon_fuas ADD COLUMN
    documento_url TEXT,
    documento_estado TEXT DEFAULT 'pendiente',
    fecha_documento TIMESTAMPTZ,
    validado_por TEXT,
    comentario_rechazo TEXT;

-- Tabla citas
ALTER TABLE citas ADD COLUMN
    descripcion_sesion TEXT,
    documento_url TEXT,
    fecha_documento TIMESTAMPTZ;
```

### Buckets Supabase Storage

| Bucket | Contenido | Privacidad |
|--------|-----------|------------|
| `fuas-comprobantes` | PDFs de estudiantes no postulantes | Privado |
| `citas-documentos` | PDFs adjuntos al completar citas | Privado |

---

## 🎨 MEJORAS UI/UX TAB FUAS (12 Enero 2026)

### Dashboard
- 4 cards (antes 3): Pendientes, Citas Hoy, Completadas, **Docs por Validar**
- Card Docs se resalta en ámbar si hay documentos pendientes

### Filtros de Estado Documento
```
[Todos (623)] [Sin documento (620)] [Por validar (2)] [Validados (1)] [Rechazados (0)]
```
- Botones pill con colores distintivos
- Conteo en tiempo real
- Resetea paginación al cambiar filtro

### Modal de Validación
- Info del estudiante (nombre, RUT, correo)
- Preview del PDF en iframe embebido
- Link "Abrir en nueva pestaña"
- Botones grandes: [Rechazar] rojo + [Validar ✓] verde

---

## 📊 ESTADO ACTUAL: 100% Completo

| Módulo | Progreso |
|--------|----------|
| Setup e infraestructura | 100% ✅ |
| Autenticación híbrida | 100% ✅ |
| Cruce de Datos FUAS | 100% ✅ |
| Detección No Postulantes | 100% ✅ |
| **Sistema Documentos (Feature A/B)** | 100% ✅ |
| **UI/UX Tab FUAS** | 100% ✅ |
| Dashboard Métricas | 100% ✅ |

---

## 🗺 ARQUITECTURA DE TABLAS

```
┌──────────────────────┐
│   datos_instituto    │  ← SQL Server sync
│   2254 matriculados  │
└──────────┬───────────┘
           │ Cruce con CSV Ministerio
           ▼
┌──────────────────────┐     ┌──────────────────────┐
│   estudiantes_fuas   │     │  no_postularon_fuas  │
│  Deben postular (290)│     │ No aparecen en CSV   │
│                      │     │   (623 registros)    │
└──────────────────────┘     └──────────┬───────────┘
                                        │
                              ┌─────────┴─────────┐
                              ▼                   ▼
                       documento_estado     documento_estado
                        = 'validado'         = 'rechazado'
                              │                   │
                              ▼                   ▼
                       Caso resuelto         Puede re-subir
```

### Relación con Citas (Independiente)
- Tabla `citas` usa `rut_estudiante` FK a `estudiantes`
- Las citas funcionan independiente del estado FUAS
- Un estudiante en `no_postularon_fuas` puede agendar citas normalmente

---

## 🎯 PENDIENTE

### Prioridad Alta
- [ ] Configurar RLS policies para buckets Storage
- [ ] Probar flujo completo en producción
- [ ] Variables de entorno en servidor

### Prioridad Media
- [ ] Limpiar automáticamente `no_postularon_fuas` cuando aparezcan en nuevo CSV
- [ ] Export de reportes a Excel
- [ ] Logs de auditoría

### Prioridad Baja
- [ ] Dark mode
- [ ] Confirmar cita desde email

---

## 🚀 COMANDOS ÚTILES

```bash
# Desarrollo Frontend
cd frontend && npm run dev

# Desarrollo Backend
cd backend && npm start

# Build producción
cd frontend && npm run build
```

---

## 📁 ARCHIVOS IMPORTANTES

| Archivo | Descripción |
|---------|-------------|
| `CONTEXTO_SESION.md` | Este documento |
| `frontend/src/lib/storageService.ts` | Subida de PDFs a Storage |
| `backend/server.js` | API + Sync SQL Server |
| `frontend/.env` | Variables Supabase/APIs |

---

**Última actualización:** 12 de enero de 2026, 15:20 hrs

