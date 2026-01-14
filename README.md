# 🎓 GestorCeduc FUAS

> Plataforma web para automatizar la gestión de postulaciones FUAS en instituciones educativas chilenas.

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/francocerda/GestorCeduc.git
cd GestorCeduc

# Backend
cd backend
npm install
cp .env.example .env  # Configurar variables
npm start

# Frontend (nueva terminal)
cd frontend
npm install
npm run dev
```

### Variables de Entorno

**Backend (`.env`)**
```env
SUPABASE_URL=tu_url
SUPABASE_KEY=tu_key
SQL_SERVER_HOST=host
SQL_SERVER_USER=user
SQL_SERVER_PASSWORD=pass
```

**Frontend (`.env`)**
```env
VITE_SUPABASE_URL=tu_url
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

---

## 📁 Estructura

```
├── backend/
│   ├── server.js          # API Express + sincronización
│   └── .env
│
└── frontend/src/
    ├── components/ui/     # Componentes reutilizables
    ├── pages/             # Vistas principales
    ├── hooks/             # Custom hooks
    ├── lib/               # Servicios y utilidades
    └── types/             # TypeScript definitions
```

---

## 👥 Roles

| Rol | Acceso |
|-----|--------|
| Estudiante | Portal estudiante, subir documentos, agendar citas |
| Asistente Social | Validar documentos, gestionar citas, ver métricas |


