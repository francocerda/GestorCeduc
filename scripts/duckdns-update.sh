#!/bin/bash

# =====================================================
# Script de actualización de IP para DuckDNS
# =====================================================
# Este script actualiza tu IP en DuckDNS
# Configúralo en cron para ejecutarse cada 5 minutos
# =====================================================

# CONFIGURACIÓN - Cambiar estos valores
DUCKDNS_DOMAIN="tu-subdominio"  # Sin .duckdns.org
DUCKDNS_TOKEN="tu-token-de-duckdns"

# Actualizar IP
RESPONSE=$(curl -s "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=")

if [ "$RESPONSE" == "OK" ]; then
    echo "$(date): IP actualizada correctamente"
else
    echo "$(date): Error actualizando IP - Respuesta: $RESPONSE"
fi
