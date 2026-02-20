/**
 * Pool de conexiones PostgreSQL compartido por todo el backend.
 *
 * Configuración:
 * - Lee variables de entorno `PG_*`.
 * - Define límites de conexiones y timeouts para evitar bloqueos.
 * - Cierra el proceso ante errores en clientes inactivos para forzar reinicio limpio.
 */
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    database: process.env.PG_DATABASE || 'gestor_ceduc',
    user: process.env.PG_USER || 'gestor_user',
    password: process.env.PG_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err, client) => {
    // console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = pool;
