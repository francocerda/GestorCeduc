#!/bin/bash

# =====================================================
# Script de Despliegue - GestorCeduc FUAS
# =====================================================
# Uso: ./deploy.sh [comando]
# Comandos:
#   start    - Inicia todos los servicios
#   stop     - Detiene todos los servicios
#   restart  - Reinicia todos los servicios
#   logs     - Muestra logs en tiempo real
#   status   - Muestra estado de los contenedores
#   rebuild  - Reconstruye las imágenes y reinicia
#   clean    - Limpia todo (CUIDADO: borra datos)
# =====================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Sin color

# Verificar que .env existe
check_env() {
    if [ ! -f .env ]; then
        echo -e "${RED}❌ Error: No se encontró el archivo .env${NC}"
        echo -e "${YELLOW}   Copia .env.production a .env y configúralo:${NC}"
        echo -e "${BLUE}   cp .env.production .env${NC}"
        echo -e "${BLUE}   nano .env${NC}"
        exit 1
    fi
}

# Función para mostrar uso
show_usage() {
    echo -e "${BLUE}=======================================${NC}"
    echo -e "${BLUE}   GestorCeduc - Script de Despliegue ${NC}"
    echo -e "${BLUE}=======================================${NC}"
    echo ""
    echo "Uso: ./deploy.sh [comando]"
    echo ""
    echo "Comandos disponibles:"
    echo "  start    - Inicia todos los servicios"
    echo "  stop     - Detiene todos los servicios"
    echo "  restart  - Reinicia todos los servicios"
    echo "  logs     - Muestra logs en tiempo real"
    echo "  status   - Muestra estado de los contenedores"
    echo "  rebuild  - Reconstruye las imágenes y reinicia"
    echo "  clean    - Limpia todo (¡BORRA DATOS!)"
    echo "  db-shell - Abre shell de PostgreSQL"
    echo ""
}

case "$1" in
    start)
        check_env
        echo -e "${GREEN}🚀 Iniciando GestorCeduc...${NC}"
        docker-compose up -d
        echo -e "${GREEN}✅ Servicios iniciados${NC}"
        echo ""
        docker-compose ps
        ;;
    
    stop)
        echo -e "${YELLOW}⏹️  Deteniendo servicios...${NC}"
        docker-compose down
        echo -e "${GREEN}✅ Servicios detenidos${NC}"
        ;;
    
    restart)
        check_env
        echo -e "${YELLOW}🔄 Reiniciando servicios...${NC}"
        docker-compose restart
        echo -e "${GREEN}✅ Servicios reiniciados${NC}"
        ;;
    
    logs)
        echo -e "${BLUE}📋 Mostrando logs (Ctrl+C para salir)...${NC}"
        docker-compose logs -f
        ;;
    
    status)
        echo -e "${BLUE}📊 Estado de los servicios:${NC}"
        echo ""
        docker-compose ps
        ;;
    
    rebuild)
        check_env
        echo -e "${YELLOW}🔨 Reconstruyendo imágenes...${NC}"
        docker-compose down
        docker-compose build --no-cache
        docker-compose up -d
        echo -e "${GREEN}✅ Reconstrucción completada${NC}"
        ;;
    
    clean)
        echo -e "${RED}⚠️  ADVERTENCIA: Esto borrará TODOS los datos incluyendo la base de datos${NC}"
        read -p "¿Estás seguro? (escribe 'SI' para confirmar): " confirm
        if [ "$confirm" == "SI" ]; then
            echo -e "${RED}🗑️  Limpiando todo...${NC}"
            docker-compose down -v --rmi all
            echo -e "${GREEN}✅ Limpieza completada${NC}"
        else
            echo -e "${YELLOW}Operación cancelada${NC}"
        fi
        ;;
    
    db-shell)
        echo -e "${BLUE}🐘 Abriendo shell de PostgreSQL...${NC}"
        docker-compose exec postgres psql -U gestor_user -d gestor_ceduc
        ;;
    
    *)
        show_usage
        ;;
esac
