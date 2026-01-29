# 🚀 GUÍA DE DESPLIEGUE - GestorCeduc FUAS

Esta guía te llevará paso a paso para desplegar GestorCeduc en tu servidor Ubuntu con Docker.

---

## 📋 REQUISITOS PREVIOS

- ✅ Servidor Ubuntu con Docker instalado (Portainer confirma esto)
- ✅ Acceso SSH al servidor
- ✅ Acceso al router para port forwarding

---

## PASO 1: Configurar DuckDNS (5 minutos)

### 1.1 Crear cuenta en DuckDNS

1. Ve a **https://www.duckdns.org**
2. Inicia sesión con Google, GitHub o Twitter
3. En el campo de texto, escribe un subdominio (ej: `gestorceduc-franko`)
4. Haz clic en **"add domain"**
5. **IMPORTANTE:** Copia y guarda tu **TOKEN** (lo verás arriba de la página)

### 1.2 Anotar tus datos

```
Mi subdominio: _________________.duckdns.org
Mi token: _________________________________
```

---

## PASO 2: Configurar Port Forwarding en tu Router (10 minutos)

### 2.1 Obtener IP local del servidor

En tu servidor Ubuntu, ejecuta:
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
```
Anota la IP (ejemplo: `192.168.1.100`)

### 2.2 Acceder al router

1. Abre el navegador y ve a la IP de tu router (generalmente `192.168.1.1` o `192.168.0.1`)
2. Inicia sesión (usuario/contraseña suele estar en el router físico)

### 2.3 Configurar reglas de Port Forwarding

Busca la sección "Port Forwarding", "NAT", "Virtual Server" o similar.

Añade estas reglas:

| Nombre | Puerto Externo | Puerto Interno | IP Interna | Protocolo |
|--------|----------------|----------------|------------|-----------|
| GestorCeduc-Web | 80 | 80 | 192.168.1.XXX | TCP |
| GestorCeduc-API | 3001 | 3001 | 192.168.1.XXX | TCP |

> Reemplaza `192.168.1.XXX` con la IP de tu servidor

### 2.4 Guardar y aplicar cambios

---

## PASO 3: Subir proyecto al servidor (10 minutos)

### Opción A: Usando Git (Recomendado)

Si tu proyecto está en GitHub:

```bash
# En el servidor
cd ~
git clone https://github.com/francocerda/GestorCeduc.git
cd GestorCeduc
```

### Opción B: Usando SCP

Desde tu PC local:
```bash
# Comprimir el proyecto
cd /home/franko
tar -czvf GestorCeduc.tar.gz GestorCeduc/

# Subir al servidor (cambiar usuario@ip por los tuyos)
scp GestorCeduc.tar.gz usuario@IP_SERVIDOR:~

# En el servidor
cd ~
tar -xzvf GestorCeduc.tar.gz
cd GestorCeduc
```

---

## PASO 4: Configurar variables de entorno (5 minutos)

### 4.1 Crear archivo .env

```bash
cd ~/GestorCeduc
cp .env.production .env
nano .env
```

### 4.2 Editar el archivo .env

Cambia estos valores con tus datos reales:

```env
# Cambiar por tu dominio DuckDNS
DOMAIN=tu-subdominio.duckdns.org
FRONTEND_URL=http://tu-subdominio.duckdns.org
VITE_API_URL=http://tu-subdominio.duckdns.org:3001/api

# Cambiar la contraseña de PostgreSQL
PG_PASSWORD=UnaPasswordMuySegura123!

# Copiar tus credenciales de Google Drive
GOOGLE_CLIENT_ID=xxxxx
GOOGLE_CLIENT_SECRET=xxxxx
GOOGLE_REFRESH_TOKEN=xxxxx
DRIVE_FOLDER_ESTUDIANTES=xxxxx
DRIVE_FOLDER_ASISTENTES=xxxxx

# Copiar tu API Key de Elastic Email
ELASTIC_EMAIL_API_KEY=xxxxx
```

Guardar: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## PASO 5: Desplegar con Docker (5 minutos)

### 5.1 Dar permisos al script

```bash
chmod +x deploy.sh
chmod +x scripts/duckdns-update.sh
```

### 5.2 Iniciar el despliegue

```bash
./deploy.sh start
```

Esto descargará las imágenes, construirá los contenedores y los iniciará.

### 5.3 Verificar que todo está corriendo

```bash
./deploy.sh status
```

Deberías ver algo como:
```
NAME                    STATUS
gestorceduc-db          running (healthy)
gestorceduc-backend     running
gestorceduc-frontend    running
```

### 5.4 Ver logs (para debug)

```bash
./deploy.sh logs
```

---

## PASO 6: Configurar DuckDNS en el servidor (3 minutos)

### 6.1 Editar el script de actualización

```bash
nano scripts/duckdns-update.sh
```

Cambia:
- `DUCKDNS_DOMAIN="tu-subdominio"` → Tu subdominio sin .duckdns.org
- `DUCKDNS_TOKEN="tu-token"` → Tu token de DuckDNS

### 6.2 Probar el script

```bash
./scripts/duckdns-update.sh
```

Debería responder: `OK`

### 6.3 Configurar actualización automática (cron)

```bash
crontab -e
```

Añade esta línea al final:
```
*/5 * * * * /home/TU_USUARIO/GestorCeduc/scripts/duckdns-update.sh >> /var/log/duckdns.log 2>&1
```

Esto actualiza tu IP cada 5 minutos.

---

## PASO 7: Probar la aplicación 🎉

### 7.1 Probar acceso local (desde el servidor)

```bash
curl http://localhost
curl http://localhost:3001/health
```

### 7.2 Probar acceso desde tu red local

Desde otro dispositivo en tu casa, abre:
- Frontend: `http://192.168.1.XXX` (IP del servidor)
- API Health: `http://192.168.1.XXX:3001/health`

### 7.3 Probar acceso externo

Desde tu celular (con datos móviles, NO WiFi de casa):
- Frontend: `http://tu-subdominio.duckdns.org`
- API: `http://tu-subdominio.duckdns.org:3001/health`

---

## 🔧 COMANDOS ÚTILES

| Comando | Descripción |
|---------|-------------|
| `./deploy.sh start` | Iniciar servicios |
| `./deploy.sh stop` | Detener servicios |
| `./deploy.sh restart` | Reiniciar servicios |
| `./deploy.sh logs` | Ver logs en tiempo real |
| `./deploy.sh status` | Ver estado de contenedores |
| `./deploy.sh rebuild` | Reconstruir imágenes |
| `./deploy.sh db-shell` | Abrir consola PostgreSQL |

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### El frontend no carga
```bash
docker logs gestorceduc-frontend
```

### El backend da error
```bash
docker logs gestorceduc-backend
```

### La base de datos no conecta
```bash
docker logs gestorceduc-db
./deploy.sh db-shell  # Para verificar manualmente
```

### No puedo acceder desde internet
1. Verifica port forwarding en el router
2. Verifica que DuckDNS tiene tu IP: `ping tu-subdominio.duckdns.org`
3. Prueba desde datos móviles (no WiFi de casa)

### Reiniciar todo desde cero
```bash
./deploy.sh clean  # ¡BORRA TODOS LOS DATOS!
./deploy.sh start
```

---

## 📊 ACCESOS FINALES

| Servicio | URL |
|----------|-----|
| **Frontend** | http://tu-subdominio.duckdns.org |
| **API** | http://tu-subdominio.duckdns.org:3001/api |
| **Health Check** | http://tu-subdominio.duckdns.org:3001/health |
| **Portainer** | http://IP_SERVIDOR:9000 (si lo tienes) |

---

## 🔒 PRÓXIMOS PASOS (Opcional)

1. **HTTPS con Let's Encrypt** - Para conexiones seguras
2. **Backups automáticos** - De la base de datos
3. **Monitoreo** - Con Uptime Kuma o similar
4. **CI/CD** - Despliegue automático desde GitHub

---

¡Listo! Tu aplicación GestorCeduc ahora está accesible desde internet. 🎉
