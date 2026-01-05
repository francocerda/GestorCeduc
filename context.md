# Contexto del Proyecto: Plataforma de Gestión FUAS (Instituto Técnico Chile)

Actúa como un Arquitecto de Software Senior y Desarrollador Full Stack experto en el ecosistema React/Supabase. Estamos construyendo una plataforma para automatizar la gestión de postulaciones al beneficio estatal FUAS en Chile.

## 🛠 Tech Stack & Arquitectura
- **Frontend:** React (Vite) + TypeScript.
- **Estilos:** TailwindCSS (para UI rápida y responsive).
- **Backend/DB:** Supabase (PostgreSQL, Auth, Row Level Security).
- **Data Processing:** Scripts de Python (Pandas) para ETL de Excels (Gobierno vs Instituto).
- **Cliente HTTP:** @supabase/supabase-js.
- **Routing:** React Router DOM.
- **Fechas:** date-fns (Manejo crítico de Zona Horaria Chile `America/Santiago`).

## 🗄 Modelo de Datos (Supabase PostgreSQL)
Usa este esquema mental para generar queries y tipos:

1. **students**
   - `id` (uuid, PK)
   - `rut` (text, unique, formato limpio sin puntos ni guion: '12345678K')
   - `nombre_completo` (text)
   - `email_institucional` (text)
   - `status_fuas` (enum: 'PENDIENTE', 'POSTULADO', 'ADJUDICADO')
   - `created_at` (timestamptz)

2. **social_workers**
   - `id` (uuid, PK, linkeado a auth.users)
   - `nombre_visible` (text)
   - `email` (text)

3. **appointments**
   - `id` (uuid, PK)
   - `student_id` (FK -> students.id)
   - `social_worker_id` (FK -> social_workers.id)
   - `inicio` (timestamptz)
   - `fin` (timestamptz)
   - `estado` (enum: 'AGENDADA', 'REALIZADA', 'CANCELADA', 'NO_SHOW')

## Reglas de Negocio y Contexto Local
1. **Validación de RUT:** Todo input de RUT debe validarse con el algoritmo "Módulo 11". Se almacena sin puntos ni guion.
2. **Zona Horaria:** El servidor está en UTC, pero la UI debe mostrar y operar en `America/Santiago` (Chile Continental).
3. **Agendamiento:**
   - Bloques de atención de 15 minutos.
   - Un alumno no puede tener más de una cita activa (estado 'AGENDADA') a la vez.
   - La disponibilidad se calcula restando `appointments` a los bloques base definidos.
4. **Privacidad:** Los alumnos solo pueden ver sus propios datos (RLS). Las Asistentes pueden ver todos los alumnos asignados.

## Estándares de Código (TypeScript)
1. **Tipado Estricto:** No usar `any`. Usar interfaces generadas desde la DB de Supabase.
2. **Componentes:** Funcionales con Hooks.
3. **Manejo de Errores:** Siempre envolver las llamadas a Supabase (`.select`, `.insert`) verificando `if (error) throw error`.
4. **UI:** Mobile-first. La mayoría de los alumnos entrará desde el celular.
