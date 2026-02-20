# Documentación de Archivos - GestorCeduc FUAS

Documento de referencia rápida por archivo para traspaso técnico.

## Raíz

- `CONTEXTO_SESION.md`: contexto histórico, arquitectura, cambios y decisiones del proyecto.
- `README.md`: resumen breve de arranque del proyecto.
- `GUIA_ENTREGA.md`: guía completa de instalación, operación y entrega.
- `DOCUMENTACION_ARCHIVOS.md`: este mapa técnico por archivo.

## Backend

### backend/server.js
API principal Express. Contiene endpoints de autenticación, estudiantes, citas, gestión FUAS, beneficios, email y documentos.

### backend/db/pool.js
Pool PostgreSQL compartido. Centraliza conexión y manejo de errores del cliente idle.

### backend/db/schema.sql
Esquema SQL completo: tablas `datos_instituto`, `datos_ministerio`, `gestion_fuas`, `asistentes_sociales`, `citas` e índices.

### backend/db/migration_unificar_tablas.sql
Migración histórica para consolidar estructura FUAS.

### backend/services/emailService.js
Servicio de Elastic Email: templates HTML y envíos (citas, FUAS, beneficios, solicitud de reunión).

### backend/services/googleDriveService.js
Servicio Google Drive: creación de carpetas por jerarquía, carga de documentos y URLs públicas para visualización.

### backend/package.json
Dependencias y scripts del backend.

### backend/.env.example
Plantilla de variables de entorno backend.

## Frontend

### Entrada y layout
- `frontend/src/main.tsx`: punto de entrada React y carga de estilos globales.
- `frontend/src/App.tsx`: providers, rutas y control de carga inicial.
- `frontend/src/index.css`: sistema de diseño global (tokens, utilidades, animaciones).

### Contexto y hooks
- `frontend/src/contexts/AuthContext.tsx`: sesión, persistencia local, roles y sincronización de login con backend.
- `frontend/src/hooks/useCitas.ts`: operaciones y estado de citas.
- `frontend/src/hooks/useStudents.ts`: operaciones y estado de estudiantes.

### Librerías de integración y utilidades
- `frontend/src/lib/api.ts`: cliente HTTP central contra backend.
- `frontend/src/lib/ceducApi.ts`: integración de login con API CEDUC externa.
- `frontend/src/lib/instituteApi.ts`: capa de funciones para datos institucionales y FUAS.
- `frontend/src/lib/storageService.ts`: validaciones de archivos y helpers de documentos.
- `frontend/src/lib/dateUtils.ts`: utilidades de fecha/hora con zona Chile.
- `frontend/src/lib/rutValidador.ts`: normalización/validación de RUT.
- `frontend/src/lib/csvParserAcreditacion.ts`: parser CSV acreditación.
- `frontend/src/lib/csvParserFUAS.ts`: parser CSV FUAS nacional.
- `frontend/src/lib/csvParserPreseleccion.ts`: parser CSV de beneficios preselección.
- `frontend/src/lib/exportUtils.ts`: exportación de reportes a Excel.

### Páginas
- `frontend/src/pages/LoginPage.tsx`: acceso con credenciales institucionales.
- `frontend/src/pages/StudentPortal.tsx`: vista principal estudiante.
- `frontend/src/pages/BookAppointmentPage.tsx`: reserva de cita.
- `frontend/src/pages/SocialWorkerPortal.tsx`: portal asistente/jefatura (FUAS, beneficios, equipo).

### Componentes UI
- `frontend/src/components/ui/Button.tsx`: botón reutilizable con variantes y loading.
- `frontend/src/components/ui/Input.tsx`: input reutilizable con label/error/icono.
- `frontend/src/components/ui/Card.tsx`: contenedor de secciones con header opcional.
- `frontend/src/components/ui/Modal.tsx`: modal base con animaciones.
- `frontend/src/components/ui/Badge.tsx`: badges de estado.
- `frontend/src/components/ui/FileUpload.tsx`: zona drag and drop de archivos.
- `frontend/src/components/ui/Skeleton.tsx`: placeholders de carga.
- `frontend/src/components/ui/Toast.tsx`: notificaciones de interfaz.
- `frontend/src/components/ui/ProtectedRoute.tsx`: protección de rutas según sesión.

### Componentes funcionales
- `frontend/src/components/features/TimeSlotPicker.tsx`: selección de horario disponible.
- `frontend/src/components/features/ScheduleEditor.tsx`: edición de horario semanal de asistentes.
- `frontend/src/components/features/StudentProfileModal.tsx`: perfil completo del estudiante.
- `frontend/src/components/features/RequestMeetingModal.tsx`: envío de solicitud de reunión.

### Tipos
- `frontend/src/types/auth.ts`: tipos de autenticación/usuario.
- `frontend/src/types/database.ts`: tipos de dominio para tablas y entidades del sistema.

### Configuración frontend
- `frontend/package.json`: scripts y dependencias.
- `frontend/vite.config.ts`: configuración Vite.
- `frontend/tailwind.config.js`: configuración Tailwind.
- `frontend/postcss.config.js`: configuración PostCSS.
- `frontend/eslint.config.js`: reglas de lint.
- `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`: configuración TypeScript.
- `frontend/.env.example`: plantilla de variables frontend.

## Datos de referencia

- `docs/`: insumos CSV ministeriales históricos (sensibles).

## Estado de documentación

- Se mantuvo documentación en código existente.
- Se agregaron encabezados técnicos en archivos que no tenían comentarios explícitos.
- Se agregó guía de entrega integral para instalación y uso empresarial.
