/**
 * Script para probar la conexión a SQL Server
 * Ejecutar: node test-connection.js
 */

require('dotenv').config()

const sql = require('mssql')

const sqlConfig = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: false, 
        trustServerCertificate: false,
        enableArithAbort: true    
    },
    connectionTimeout: 30000,
    requestTimeout: 60000
}

async function testConnection() {
    let pool = null

    try {
        console.log(' Intentando conectar a SQL Server...')
        console.log(`   Servidor: ${process.env.SQL_SERVER}`)
        console.log(`   Usuario: ${process.env.SQL_USER}`)
        console.log(`   Base de datos: ${process.env.SQL_DATABASE || 'master'}`)
        console.log('')

        pool = await sql.connect(sqlConfig)
        console.log(' Conexión exitosa!')

        console.log('\nEjecutando consulta: exec [ESTUDIANTES_MAT] 2026')
        const result = await pool.request().query('exec [ESTUDIANTES_MAT] 2026')

        console.log('\nConsulta exitosa!')
        console.log(`   Total de registros: ${result.recordset.length}`)

        if (result.recordset.length > 0) {
            console.log('\n Primeros 3 registros (ejemplo):')
            result.recordset.slice(0, 3).forEach((row, i) => {
                Object.keys(row).forEach(key => {
                    console.log(`     ${key}: ${row[key]}`)
                })
            })

            console.log('\n Columnas disponibles:')
            console.log(`   ${Object.keys(result.recordset[0]).join(', ')}`)
        }

    } catch (error) {
        console.error('\n Error de conexión:', error.message)

        if (error.code === 'ELOGIN') {
            console.error('   → Verifica usuario y contraseña')
        } else if (error.code === 'ETIMEOUT') {
            console.error('   → El servidor no responde. Verifica la URL y firewall')
        } else if (error.code === 'ESOCKET') {
            console.error('   → No se puede conectar al servidor. Verifica la red')
        }

        process.exit(1)

    } finally {
        if (pool) {
            await pool.close()
            console.log('\nConexión cerrada')
        }
    }
}

testConnection()
