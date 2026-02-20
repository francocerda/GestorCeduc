# Guía de Entrega Empresarial - GestorCeduc FUAS

## 1) Resumen del sistema

GestorCeduc FUAS es una plataforma web para gestión de postulaciones y acreditación FUAS en CEDUC UCN.

Arquitectura:
- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express
- Base de datos principal: PostgreSQL
- Integraciones: SQL Server institucional, Google Drive, Elastic Email

Puertos de desarrollo:
- Frontend: 5173
- Backend: 3001

---

## 2) Requisitos para instalar en un computador nuevo

Instalar previamente:
- Git
- Node.js 18+ (recomendado 20 LTS)
- npm 9+
- PostgreSQL 14+ (recomendado 16)

Accesos y credenciales necesarias:
- Credenciales PostgreSQL local
- API Keys de Elastic Email
- OAuth Google Drive (client id/secret/refresh token)
- Credenciales SQL Server institucional

---

## 3) Clonado del proyecto

1. Clonar repositorio:
   - `git clone https://github.com/francocerda/GestorCeduc.git`
2. Entrar al proyecto:
   - `cd GestorCeduc`

---

## 4) Configuración de variables de entorno

### Backend
1. Ir a carpeta backend.
2. Crear archivo `.env` copiando `.env.example`.
3. Completar variables:

- PostgreSQL:
  - `PG_USER`
  - `PG_PASSWORD`
  - `PG_HOST`
  - `PG_PORT`
  - `PG_DATABASE`

- Google Drive:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REFRESH_TOKEN`
  - `DRIVE_FOLDER_ESTUDIANTES`
  - `DRIVE_FOLDER_ASISTENTES`

- Elastic Email:
  - `ELASTIC_EMAIL_API_KEY`
  - `EMAIL_REMITENTE`

- SQL Server:
  - `SQL_SERVER`
  - `SQL_USER`
  - `SQL_PASSWORD`
  - `SQL_DATABASE`

- Servidor:
  - `PORT` (3001)
  - `NODE_ENV`
  - `FRONTEND_URL` (http://localhost:5173)

### Frontend
1. Ir a carpeta frontend.
2. Crear archivo `.env.local` o `.env` copiando `.env.example`.
3. Configurar:
- `VITE_API_URL=http://localhost:3001/api`
- `VITE_PLATFORM_URL=https://www.ceduc.cl/`

Nota: las claves sensibles solo van en backend.

---

## 5) Configuración de base de datos

1. Crear base de datos y usuario en PostgreSQL si no existen.
2. Ejecutar esquema:
   - archivo: `backend/db/schema.sql`
3. Verificar que se creen tablas:
   - `datos_instituto`
   - `datos_ministerio`
   - `gestion_fuas`
   - `asistentes_sociales`
   - `citas`

Si `gen_random_uuid()` falla, habilitar extensión `pgcrypto` en PostgreSQL.

---

## 6) Instalación de dependencias

Backend:
1. `cd backend`
2. `npm install`

Frontend:
1. `cd frontend`
2. `npm install`

---

## 7) Ejecución en desarrollo

1. Terminal 1 (backend):
   - `cd backend`
   - `npm start`
2. Terminal 2 (frontend):
   - `cd frontend`
   - `npm run dev`

Verificación:
- Backend responde en `http://localhost:3001`
- Frontend abre en `http://localhost:5173`

---

## 8) Pruebas funcionales mínimas antes de uso interno

1. Login con usuario estudiante.
2. Login con usuario asistente social.
3. Carga de CSV FUAS/acreditación en portal asistente.
4. Cruce de beneficios (tab Beneficios).
5. Agendamiento de cita desde estudiante.
6. Cancelación de cita y verificación de email.
7. Subida de documento PDF y validación en Drive.

---

## 9) Operación diaria

Flujo recomendado:
1. Sincronizar datos institucionales.
2. Cargar CSV ministeriales vigentes.
3. Revisar estudiantes con estado `debe_acreditar` y `no_postulo`.
4. Gestionar citas y validación documental.
5. Ejecutar notificaciones masivas cuando corresponda.
6. Exportar reportes a Excel para respaldo operativo.

---

## 10) Seguridad y buenas prácticas

- No subir `.env` al repositorio.
- Rotar periódicamente API keys (Elastic/Google).
- Restringir permisos de carpetas raíz en Google Drive.
- Respaldar PostgreSQL de forma programada.
- Mantener `NODE_ENV=production` fuera de desarrollo.

---

## 11) Despliegue recomendado (resumen)

Para producción empresarial:
- Backend detrás de proxy reverso (Nginx).
- Frontend compilado con `npm run build` y servido en hosting estático.
- PostgreSQL en servidor dedicado con backup diario.
- Variables sensibles gestionadas por secret manager.
- Monitoreo de logs y uptime.

---

## 12) Mantenimiento y soporte

Checklist mensual:
- Validar conexión SQL Server y sincronización.
- Validar expiración/estado de refresh token Google.
- Verificar entregabilidad de Elastic Email.
- Revisar crecimiento de tablas y limpieza de históricos.
- Confirmar que roles de acceso estén correctos.

---

## 13) Contacto técnico de continuidad

Se recomienda definir formalmente:
- Responsable funcional (DAE)
- Responsable técnico (backend/frontend)
- Responsable de infraestructura (BD y credenciales)

Esto asegura operación estable y trazabilidad en incidentes.
