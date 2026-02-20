# GestorCeduc FUAS

Plataforma web para automatizar la gestión de postulaciones FUAS en CEDUC UCN.

## Documentación principal

- Guía de instalación y uso empresarial: [GUIA_ENTREGA.md](GUIA_ENTREGA.md)
- Mapa técnico por archivo: [DOCUMENTACION_ARCHIVOS.md](DOCUMENTACION_ARCHIVOS.md)
- Guía de mantenimiento para desarrolladores: [GUIA_MANTENIMIENTO_DESARROLLADOR.md](GUIA_MANTENIMIENTO_DESARROLLADOR.md)

## Arranque rápido local

1. Clonar repositorio:
    - `git clone https://github.com/francocerda/GestorCeduc.git`
    - `cd GestorCeduc`
2. Configurar variables de entorno:
    - Backend: copiar `backend/.env.example` a `backend/.env`
    - Frontend: copiar `frontend/.env.example` a `frontend/.env.local`
3. Instalar dependencias:
    - `cd ../backend && npm install`
    - `cd ../frontend && npm install`
4. Levantar servicios:
    - Backend: `cd backend && npm start`
    - Frontend: `cd frontend && npm run dev`

## Tecnologías

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express
- Base de datos: PostgreSQL
- Integraciones: SQL Server, Google Drive, Elastic Email

## Roles

| Rol | Acceso |
|-----|--------|
| Estudiante | Portal estudiante, agendamiento, carga de documentos |
| Asistente Social | Gestión FUAS, citas, validación documental |
| Jefa DAE | Acceso administrativo completo, beneficios y reportes |


