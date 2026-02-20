# Guía de Mantenimiento para Desarrolladores

Este documento está orientado a la persona que toma continuidad técnica del proyecto.

## 1. Mapa rápido del sistema

- Backend API: backend/server.js
- Servicios backend:
  - backend/services/emailService.js
  - backend/services/googleDriveService.js
- Conexión PostgreSQL: backend/db/pool.js
- Frontend rutas y providers: frontend/src/App.tsx
- Cliente API frontend: frontend/src/lib/api.ts

## 2. Flujo recomendado para cambios

1. Identificar capa afectada (UI, hook, lib, backend endpoint).
2. Revisar tipos en frontend/src/types.
3. Ajustar endpoint/backend si cambia contrato.
4. Actualizar cliente frontend en frontend/src/lib/api.ts.
5. Actualizar hook o página que consume los datos.
6. Validar errores de TypeScript y flujo funcional completo.

## 3. Dónde tocar según necesidad

### Autenticación y roles
- Frontend: frontend/src/contexts/AuthContext.tsx
- API externa login: frontend/src/lib/ceducApi.ts
- Sync login backend: endpoints /api/auth/* en backend/server.js

### Citas
- Frontend hook: frontend/src/hooks/useCitas.ts
- Agendamiento estudiante: frontend/src/pages/BookAppointmentPage.tsx
- Portal estudiante: frontend/src/pages/StudentPortal.tsx
- Backend endpoints: /api/citas/* en backend/server.js

### FUAS y CSV
- Parser acreditación: frontend/src/lib/csvParserAcreditacion.ts
- Parser FUAS: frontend/src/lib/csvParserFUAS.ts
- Parser preselección: frontend/src/lib/csvParserPreseleccion.ts
- Cruces backend: endpoints /api/cruzar-datos, /api/detectar-no-postulantes, /api/beneficios/*

### Documentos
- Validación frontend: frontend/src/lib/storageService.ts
- Drive backend: backend/services/googleDriveService.js
- Endpoints: /api/documentos/estudiante/:rut y /api/citas/:id/documento

### Notificaciones
- Frontend consumo: frontend/src/lib/api.ts
- Backend servicio: backend/services/emailService.js
- Endpoints: /api/email/* y /api/beneficios/notificar

## 4. Convenciones internas recomendadas

- Mantener comentarios de cabecera por archivo explicando responsabilidad.
- Preferir nombres de funciones explícitos en español en hooks y páginas.
- Mantener logs con prefijo de módulo: [Auth], [useCitas], [ceducApi], etc.
- Persistir fechas en UTC en backend y convertir a hora local en frontend.

## 5. Lista de verificación antes de cerrar cambios

- Compila frontend sin errores de tipos.
- Endpoints modificados responden con contratos esperados por frontend.
- No se exponen llaves sensibles en cliente.
- Se validó al menos un flujo completo afectado (login, agendar, FUAS, beneficios, etc.).
- Se actualizó documentación cuando cambió comportamiento funcional.

## 6. Riesgos conocidos

- Regla temporal de roles en AuthContext para acceso jefatura debe revisarse antes de producción final.
- Integraciones externas dependen de credenciales vigentes (SQL Server, Google Drive, Elastic Email).
- Los CSV ministeriales pueden variar columnas; mantener parsers defensivos.
