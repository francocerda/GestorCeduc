# Backend Dockerfile - GestorCeduc
FROM node:18-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json primero (para cache de dependencias)
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Puerto que expone el backend
EXPOSE 3001

# Comando para iniciar
CMD ["node", "server.js"]
