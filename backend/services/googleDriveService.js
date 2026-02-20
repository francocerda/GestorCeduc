/**
 * Servicio de Google Drive para GestorCeduc
 * Maneja la subida de documentos a Google Drive usando OAuth2
 * Con organización de carpetas por estudiante/asistente
 */

const fetch = require('node-fetch');

class GoogleDriveService {
    constructor() {
        this.clientId = process.env.GOOGLE_CLIENT_ID;
        this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        this.refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
        this.accessToken = null;
        this.tokenExpiry = null;

        // IDs de carpetas raíz
        this.folderEstudiantes = process.env.DRIVE_FOLDER_ESTUDIANTES;
        this.folderAsistentes = process.env.DRIVE_FOLDER_ASISTENTES;

        // Cache de carpetas para no crearlas múltiples veces
        this.cacheCarpteas = new Map();

        // console.log('[Drive] GoogleDriveService inicializado');
        // console.log(`   Carpeta Estudiantes: ${this.folderEstudiantes}`);
        // console.log(`   Carpeta Asistentes: ${this.folderAsistentes}`);
    }

    /**
     * Obtiene un token de acceso válido, renovándolo si es necesario
     */
    async getValidToken() {
        const ahora = Date.now();
        if (!this.accessToken || !this.tokenExpiry || ahora >= this.tokenExpiry - 300000) {
            await this.renovarToken();
        }
        return this.accessToken;
    }

    async fetchWithRetry(url, options, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                return response;
            } catch (error) {
                if (i === retries - 1) throw error;
                // console.warn(`[Drive] Error de red (${error.code}), reintentando (${i + 1}/${retries})...`);
                await new Promise(res => setTimeout(res, 1000 * (i + 1))); // Espera exponencial
            }
        }
    }

    /**
     * Renueva el access_token usando el refresh_token
     */
    async renovarToken() {
        try {
            // console.log('[Drive] Renovando access_token de Google Drive...');

            const response = await this.fetchWithRetry('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    refresh_token: this.refreshToken,
                    grant_type: 'refresh_token'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Error renovando token: ${error.error_description || error.error}`);
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000);

            // console.log('[Drive] Token renovado exitosamente');
        } catch (error) {
            // console.error('[Drive] Error renovando token:', error.message);
            throw error;
        }
    }

    /**
     * Busca una carpeta por nombre dentro de una carpeta padre.
     * Si no existe, la crea.
     * @param {string} nombreCarpeta - Nombre de la carpeta a buscar/crear
     * @param {string} carpetaPadreId - ID de la carpeta padre
     * @returns {string} - ID de la carpeta encontrada o creada
     */
    async buscarOCrearCarpeta(nombreCarpeta, carpetaPadreId) {
        const cacheKey = `${carpetaPadreId}/${nombreCarpeta}`;

        // Revisar cache primero
        if (this.cacheCarpteas.has(cacheKey)) {
            return this.cacheCarpteas.get(cacheKey);
        }

        try {
            const token = await this.getValidToken();

            // Buscar carpeta existente
            const queryBusqueda = encodeURIComponent(
                `name='${nombreCarpeta}' and '${carpetaPadreId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
            );

            const busquedaResponse = await this.fetchWithRetry(
                `https://www.googleapis.com/drive/v3/files?q=${queryBusqueda}&fields=files(id,name)`,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            if (busquedaResponse.ok) {
                const busqueda = await busquedaResponse.json();
                if (busqueda.files && busqueda.files.length > 0) {
                    // console.log(`[Drive] Carpeta encontrada: ${nombreCarpeta}`);
                    this.cacheCarpteas.set(cacheKey, busqueda.files[0].id);
                    return busqueda.files[0].id;
                }
            }

            // Si no existe, crear la carpeta
            // console.log(`[Drive] Creando carpeta: ${nombreCarpeta}`);

            const crearResponse = await this.fetchWithRetry(
                'https://www.googleapis.com/drive/v3/files',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: nombreCarpeta,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [carpetaPadreId]
                    })
                }
            );

            if (!crearResponse.ok) {
                const error = await crearResponse.json();
                throw new Error(`Error creando carpeta: ${error.error?.message || 'Unknown'}`);
            }

            const nuevaCarpeta = await crearResponse.json();
            // console.log(`[Drive] Carpeta creada: ${nombreCarpeta} (${nuevaCarpeta.id})`);

            this.cacheCarpteas.set(cacheKey, nuevaCarpeta.id);
            return nuevaCarpeta.id;
        } catch (error) {
            // console.error('[Drive] Error buscando/creando carpeta:', error.message);
            throw error;
        }
    }

    /**
     * Sube un archivo a Google Drive
     */
    async subirArchivo(fileBuffer, fileName, folderId, mimeType = 'application/pdf') {
        try {
            const token = await this.getValidToken();

            const metadata = {
                name: fileName,
                parents: [folderId]
            };

            const boundary = '-------314159265358979323846';
            const delimiter = `\r\n--${boundary}\r\n`;
            const closeDelimiter = `\r\n--${boundary}--`;

            let multipartBody = delimiter;
            multipartBody += 'Content-Type: application/json; charset=UTF-8\r\n\r\n';
            multipartBody += JSON.stringify(metadata);
            multipartBody += delimiter;
            multipartBody += `Content-Type: ${mimeType}\r\n`;
            multipartBody += 'Content-Transfer-Encoding: base64\r\n\r\n';

            const base64Data = fileBuffer.toString('base64');

            const response = await this.fetchWithRetry(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': `multipart/related; boundary=${boundary}`
                    },
                    body: multipartBody + base64Data + closeDelimiter
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Error subiendo archivo: ${error.error?.message || 'Unknown error'}`);
            }

            const file = await response.json();
            // console.log(`[Drive] Archivo subido: ${file.name} (${file.id})`);

            // Hacer el archivo público
            await this.hacerPublico(file.id);

            return {
                id: file.id,
                nombre: file.name,
                // Usar /preview en lugar de /view para embeds
                url: `https://drive.google.com/file/d/${file.id}/preview`,
                urlVer: `https://drive.google.com/file/d/${file.id}/view`
            };
        } catch (error) {
            // console.error('[Drive] Error subiendo archivo:', error.message);
            throw error;
        }
    }

    /**
     * Hace un archivo accesible públicamente
     */
    async hacerPublico(fileId) {
        try {
            const token = await this.getValidToken();

            const response = await this.fetchWithRetry(
                `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: 'anyone',
                        role: 'reader'
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                // console.warn(`[Drive] No se pudo hacer público: ${error.error?.message}`);
            } else {
                // console.log(`[Drive] Archivo ${fileId} ahora es público`);
            }
        } catch (error) {
            // console.warn('[Drive] Error configurando permisos:', error.message);
        }
    }

    /**
     * Sube un documento de estudiante FUAS
     * Estructura: FUAS_Estudiantes / [Nombre Estudiante] / archivo.pdf
     * @param {Buffer} fileBuffer - Contenido del archivo
     * @param {string} rut - RUT del estudiante
     * @param {string} nombreEstudiante - Nombre completo del estudiante
     */
    async subirDocumentoEstudiante(fileBuffer, rut, nombreEstudiante) {
        const nombreLimpio = (nombreEstudiante || `Estudiante_${rut}`).trim();

        // Crear/buscar carpeta del estudiante
        const carpetaEstudiante = await this.buscarOCrearCarpeta(
            nombreLimpio,
            this.folderEstudiantes
        );

        // Nombre del archivo con fecha
        const fecha = new Date().toISOString().split('T')[0];
        const fileName = `Comprobante_FUAS_${fecha}.pdf`;

        return this.subirArchivo(fileBuffer, fileName, carpetaEstudiante);
    }

    /**
     * Sube un documento de cita (asistente social)
     * Estructura: FUAS_Asistentes / [Nombre Asistente] / [Nombre Estudiante] / archivo.pdf
     * @param {Buffer} fileBuffer - Contenido del archivo
     * @param {string} citaId - ID de la cita
     * @param {string} nombreAsistente - Nombre del asistente social
     * @param {string} nombreEstudiante - Nombre del estudiante
     */
    async subirDocumentoCita(fileBuffer, citaId, nombreAsistente, nombreEstudiante) {
        const nombreAsistenteLimpio = (nombreAsistente || 'Asistente_Desconocido').trim();
        const nombreEstudianteLimpio = (nombreEstudiante || 'Estudiante_Desconocido').trim();

        // console.log(`[Drive] Procesando subida cita para: "${nombreAsistenteLimpio}" / "${nombreEstudianteLimpio}"`);
        // console.log(`   ID Carpeta Raíz Asistentes: ${this.folderAsistentes}`);

        // Crear/buscar carpeta del asistente
        const carpetaAsistente = await this.buscarOCrearCarpeta(
            nombreAsistenteLimpio,
            this.folderAsistentes
        );
        // console.log(`   -> ID Carpeta Asistente "${nombreAsistenteLimpio}": ${carpetaAsistente}`);

        // Crear/buscar subcarpeta del estudiante dentro de la del asistente
        const carpetaEstudiante = await this.buscarOCrearCarpeta(
            nombreEstudianteLimpio,
            carpetaAsistente
        );
        // console.log(`   -> ID Carpeta Estudiante "${nombreEstudianteLimpio}": ${carpetaEstudiante}`);

        // Nombre del archivo con fecha
        const fecha = new Date().toISOString().split('T')[0];
        const fileName = `Sesion_${fecha}_${citaId.slice(0, 8)}.pdf`;

        return this.subirArchivo(fileBuffer, fileName, carpetaEstudiante);
    }
}

// Singleton
const driveService = new GoogleDriveService();

module.exports = driveService;
