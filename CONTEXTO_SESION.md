# 📚 CONTEXTO COMPLETO - Proyecto GestorCeduc FUAS

**Fecha:** 12 de enero de 2026  
**Modalidad:** Desarrollo de plataforma FUAS  
**Estado:** 100% Completo  
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
| Almacenamiento | Supabase Storage | - |
| Autenticación | API CEDUC Externa | - |
| Routing | React Router DOM | 7.11.0 |
| Fechas | date-fns + date-fns-tz | 4.1.0 / 3.2.0 |
| Cliente DB | @supabase/supabase-js | 2.89.0 |
| Emails | Elastic Email API | v2 |

---

## 🗄️ ESQUEMA DE BASE DE DATOS (Actualizado)

### Tablas Activas

| Tabla | Propósito |
|-------|-----------|
| `estudiantes` | Login, datos personales |
| `asistentes_sociales` | Asistentes del sistema |
| `citas` | Reservas de reuniones + documentos |
| `datos_instituto` | Matriculados sincronizados desde SQL Server |
| `gestion_fuas` | **NUEVA** - Tabla unificada para gestión FUAS |

### Tabla Principal: `gestion_fuas`

```sql
CREATE TABLE gestion_fuas (
    rut TEXT PRIMARY KEY,
    nombre TEXT,
    correo TEXT,
    carrera TEXT,
    sede TEXT,
    origen TEXT CHECK (origen IN ('acreditacion', 'fuas_nacional')),
    estado TEXT NOT NULL CHECK (estado IN (
        'debe_acreditar',       -- Postuló pero con inconsistencias → Cita
        'no_postulo',           -- No apareció en CSV → Subir doc
        'documento_pendiente',  -- Subió doc, esperando revisión
        'documento_validado',   -- Doc aprobado
        'documento_rechazado',  -- Doc rechazado
        'acreditado'            -- Ya acreditó
    )),
    tipo_beneficio TEXT,
    documento_url TEXT,
    fecha_documento TIMESTAMPTZ,
    validado_por TEXT,
    comentario_rechazo TEXT,
    notificacion_enviada BOOLEAN DEFAULT false,
    fecha_notificacion TIMESTAMPTZ,
    fecha_cruce TIMESTAMPTZ DEFAULT now()
);
```

### Buckets Supabase Storage

| Bucket | Contenido |
|--------|-----------|
| `fuas-comprobantes` | PDFs de estudiantes no postulantes |
| `citas-documentos` | PDFs adjuntos al completar citas |

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
backend/
├── server.js              (API Express + SQL Sync + Cruce)
├── test-connection.js     (Script prueba SQL Server)
└── .env                   (Credenciales)

frontend/src/
├── components/ui/         (Button, Input, Card, Badge, Modal, Toast...)
├── pages/
│   ├── LoginPage.tsx      (role-based redirect)
│   ├── StudentPortal.tsx  (alertas FUAS + upload documentos)
│   ├── SocialWorkerPortal.tsx (tabs + validación docs)
│   └── BookAppointmentPage.tsx (3-step booking)
├── hooks/
│   ├── useCitas.ts        (CRUD citas)
│   └── useStudents.ts     (filtros, búsqueda)
├── lib/
│   ├── supabase.ts
│   ├── storageService.ts  (upload PDFs)
│   ├── instituteApi.ts    (API backend)
│   ├── csvParser.ts       (parseo CSV)
│   └── emailService.ts    (Elastic Email)
└── types/
    └── database.ts        (GestionFUAS, interfaces)
```

---

## 🔄 FLUJOS DEL SISTEMA

### Flujo 1: Acreditación (Tab Acreditación)
```
CSV Inconsistencias → gestion_fuas (origen='acreditacion', estado='debe_acreditar')
    ↓
Estudiante ve alerta amarilla: "Agenda cita para acreditar"
    ↓
Estudiante agenda cita → Asistente completa cita con documento
```

### Flujo 2: No Postulantes (Tab FUAS)
```
CSV Nacional FUAS → Cruce con datos_instituto
    ↓
Matriculados que NO aparecen → gestion_fuas (origen='fuas_nacional', estado='no_postulo')
    ↓
Estudiante ve alerta naranja: "Sube comprobante"
    ↓
Estudiante sube PDF → estado='documento_pendiente'
    ↓
Asistente valida/rechaza → estado='documento_validado' o 'documento_rechazado'
```

### Vista del Estudiante según Estado

| Estado | Color Alerta | Mensaje |
|--------|--------------|---------|
| `debe_acreditar` | Amarillo | "Agenda cita para acreditar" |
| `no_postulo` | Naranja | "Sube comprobante de postulación" |
| `documento_pendiente` | Naranja | "En revisión" |
| `documento_validado` | Verde | "Validado ✓" |
| `documento_rechazado` | Rojo | Motivo + "Sube nuevo documento" |

---

## 🔐 SISTEMA DE AUTENTICACIÓN

### Roles
| Rol | Descripción | Portal |
|-----|-------------|--------|
| Estudiante | Estudiantes matriculados | `/estudiante` |
| `jef_dae` | Jefa de Asuntos Estudiantiles | `/asistente` |
| `enc_aes` | Encargada de Asuntos Estudiantiles | `/asistente` |

### Flujo de Login
1. POST a API CEDUC con RUT sin DV
2. Si tiene rol asistente → sync con `asistentes_sociales`
3. Si es estudiante → sync con `estudiantes`
4. Guardar en localStorage (7 días TTL)

---

## 🗓 REGLAS DE AGENDAMIENTO

- **Límite:** 1 cita por semana por estudiante
- **Horario:** Lunes a Viernes, 9:00 - 18:00
- **Duración:** 15 minutos
- **Anticipación:** Mínimo 1 día, máximo 30 días

---

## 📧 SISTEMA DE EMAILS

- **API:** Elastic Email
- **Funciones:** Notificaciones FUAS, recordatorios masivos
- **Rate Limiting:** 200ms entre envíos

---

## 🚀 COMANDOS

```bash
# Backend
cd backend && npm start

# Frontend
cd frontend && npm run dev

# Build
cd frontend && npm run build
```

---

## 📊 ESTADO: 100% ✅

| Módulo | Estado |
|--------|--------|
| Autenticación | ✅ |
| Sistema de Citas | ✅ |
| Cruce de Datos FUAS | ✅ |
| Detección No Postulantes | ✅ |
| Sistema Documentos (Upload/Validación) | ✅ |
| UI/UX Tab FUAS (Filtros, Modal) | ✅ |
| Dashboard con Métricas | ✅ |

---

**Última actualización:** 12 de enero de 2026, 16:44 hrs
