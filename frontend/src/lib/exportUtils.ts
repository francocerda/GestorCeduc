/**
 * Utilidades para exportar datos a Excel/CSV
 * Genera archivos Excel (.xlsx) sin dependencias externas usando formato XML
 */

interface ColumnConfig {
  key: string;
  header: string;
  width?: number;
  formatter?: (value: any, item?: any) => string;
}

/**
 * Escapa caracteres especiales XML
 */
function escapeXml(str: string | null | undefined): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formatea fecha para Excel
 */
function formatearFechaExcel(fecha: string | null | undefined): string {
  if (!fecha) return '';
  try {
    const date = new Date(fecha);
    return date.toLocaleString('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(fecha);
  }
}

/**
 * Genera un archivo Excel (formato SpreadsheetML XML)
 * Compatible con Excel, LibreOffice y Google Sheets
 */
function generarExcelXML(datos: any[], columnas: ColumnConfig[], titulo: string): string {
  // Estilos para el Excel
  const styles = `
    <Styles>
      <Style ss:ID="Default" ss:Name="Normal">
        <Font ss:FontName="Arial" ss:Size="11"/>
      </Style>
      <Style ss:ID="Header">
        <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
        <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>
        <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        </Borders>
      </Style>
      <Style ss:ID="Cell">
        <Font ss:FontName="Arial" ss:Size="10"/>
        <Alignment ss:Vertical="Center"/>
        <Borders>
          <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        </Borders>
      </Style>
      <Style ss:ID="DateCell">
        <Font ss:FontName="Arial" ss:Size="10"/>
        <Alignment ss:Vertical="Center"/>
        <NumberFormat ss:Format="dd/mm/yyyy hh:mm"/>
      </Style>
      <Style ss:ID="Title">
        <Font ss:FontName="Arial" ss:Size="14" ss:Bold="1" ss:Color="#1F2937"/>
        <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      </Style>
      <Style ss:ID="Subtitle">
        <Font ss:FontName="Arial" ss:Size="10" ss:Color="#6B7280"/>
        <Alignment ss:Horizontal="Left"/>
      </Style>
    </Styles>
  `;

  // Generar columnas
  const columnDefs = columnas.map(col => 
    `<Column ss:AutoFitWidth="1" ss:Width="${col.width || 120}"/>`
  ).join('\n');

  // Fila de título
  const fechaGeneracion = new Date().toLocaleString('es-CL');
  const titleRow = `
    <Row ss:Height="25">
      <Cell ss:StyleID="Title" ss:MergeAcross="${columnas.length - 1}"><Data ss:Type="String">${escapeXml(titulo)}</Data></Cell>
    </Row>
    <Row ss:Height="18">
      <Cell ss:StyleID="Subtitle" ss:MergeAcross="${columnas.length - 1}"><Data ss:Type="String">Generado el ${fechaGeneracion} | Total: ${datos.length} registros</Data></Cell>
    </Row>
    <Row></Row>
  `;

  // Fila de encabezados
  const headerRow = `
    <Row ss:Height="22">
      ${columnas.map(col => 
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col.header)}</Data></Cell>`
      ).join('\n')}
    </Row>
  `;

  // Filas de datos
  const dataRows = datos.map(item => {
    const cells = columnas.map(col => {
      let value = item[col.key];
      
      // Aplicar formateador personalizado si existe (pasando value e item)
      if (col.formatter) {
        value = col.formatter(value, item);
      }
      
      // Determinar tipo de dato
      const isNumber = typeof value === 'number' && !isNaN(value);
      const dataType = isNumber ? 'Number' : 'String';
      const displayValue = value != null ? escapeXml(String(value)) : '';
      
      return `<Cell ss:StyleID="Cell"><Data ss:Type="${dataType}">${displayValue}</Data></Cell>`;
    }).join('\n');
    
    return `<Row ss:Height="20">${cells}</Row>`;
  }).join('\n');

  // Documento XML completo
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${escapeXml(titulo)}</Title>
    <Author>GestorCeduc</Author>
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  ${styles}
  <Worksheet ss:Name="Datos">
    <Table>
      ${columnDefs}
      ${titleRow}
      ${headerRow}
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;
}

/**
 * Descarga el archivo Excel generado
 */
function descargarArchivo(contenido: string, nombreArchivo: string, mimeType: string) {
  const blob = new Blob([contenido], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================
// FUNCIONES DE EXPORTACIÓN ESPECÍFICAS
// ============================================

/**
 * Exportar directorio de estudiantes
 */
export function exportarDirectorioEstudiantes(estudiantes: any[]) {
  const columnas: ColumnConfig[] = [
    { key: 'rut', header: 'RUT', width: 100 },
    { key: 'nombre', header: 'Nombre Completo', width: 200 },
    { key: 'correo', header: 'Correo Electrónico', width: 200 },
    { key: 'carrera', header: 'Carrera', width: 180 },
    { key: 'cod_carrera', header: 'Cód. Carrera', width: 80 },
    { key: 'sede', header: 'Sede', width: 80 },
    { key: 'jornada', header: 'Jornada', width: 80, formatter: formatearJornada },
    { key: 'anio_ingreso', header: 'Año Ingreso', width: 90 },
    { key: 'nivel', header: 'Nivel', width: 60 },
    { key: 'estado_academico', header: 'Estado Matrícula', width: 110 },
    { key: 'estado_fuas', header: 'Estado FUAS', width: 130, formatter: formatearEstadoFUAS },
    { key: 'tipo_beneficio', header: 'Tipo Beneficio', width: 120 },
    { key: 'total_citas', header: 'Total Citas', width: 80 },
    { key: 'ultima_cita', header: 'Última Cita', width: 140, formatter: formatearFechaExcel }
  ];

  const xml = generarExcelXML(estudiantes, columnas, 'Directorio de Estudiantes - GestorCeduc');
  const fecha = new Date().toISOString().split('T')[0];
  descargarArchivo(xml, `directorio_estudiantes_${fecha}.xls`, 'application/vnd.ms-excel');
}

/**
 * Exportar citas del asistente
 */
export function exportarCitas(citas: any[], nombreAsistente?: string) {
  const columnas: ColumnConfig[] = [
    { key: 'fecha', header: 'Fecha', width: 140, formatter: (_, item) => formatearFechaExcel(item?.inicio) },
    { key: 'estudiante_nombre', header: 'Estudiante', width: 200, formatter: (_, item) => item?.estudiantes?.nombre || item?.nombre_estudiante || '' },
    { key: 'estudiante_rut', header: 'RUT Estudiante', width: 100, formatter: (_, item) => item?.estudiantes?.rut || item?.rut_estudiante || '' },
    { key: 'estado', header: 'Estado', width: 100, formatter: formatearEstadoCita },
    { key: 'motivo', header: 'Motivo', width: 200 },
    { key: 'observaciones', header: 'Observaciones', width: 200 }
  ];

  // Transformar datos para que funcione con el formateador
  const datosTransformados = citas.map(cita => ({
    ...cita,
    fecha: cita.inicio,
    estudiante_nombre: cita.estudiantes?.nombre || cita.nombre_estudiante || '',
    estudiante_rut: cita.estudiantes?.rut || cita.rut_estudiante || ''
  }));

  const titulo = nombreAsistente 
    ? `Citas de ${nombreAsistente} - GestorCeduc`
    : 'Listado de Citas - GestorCeduc';
  
  const xml = generarExcelXML(datosTransformados, columnas, titulo);
  const fecha = new Date().toISOString().split('T')[0];
  descargarArchivo(xml, `citas_${fecha}.xls`, 'application/vnd.ms-excel');
}

/**
 * Exportar estudiantes pendientes FUAS (acreditación, postulantes, no_postulantes)
 */
export function exportarEstudiantesFUAS(estudiantes: any[], tipo: 'acreditacion' | 'no_postulantes' | 'postulantes_fuas' | 'estudiantes_fuas') {
  const columnas: ColumnConfig[] = [
    { key: 'rut', header: 'RUT', width: 100 },
    { key: 'nombre', header: 'Nombre Completo', width: 200 },
    { key: 'correo', header: 'Correo Electrónico', width: 200 },
    { key: 'carrera', header: 'Carrera', width: 180 },
    { key: 'cod_carrera', header: 'Cód. Carrera', width: 80 },
    { key: 'sede', header: 'Sede', width: 80 },
    { key: 'jornada', header: 'Jornada', width: 80, formatter: formatearJornada },
    { key: 'anio_ingreso', header: 'Año Ingreso', width: 90 },
    { key: 'nivel', header: 'Nivel', width: 60 },
    { key: 'estado_academico', header: 'Estado Matrícula', width: 110 },
    { key: 'estado', header: 'Estado FUAS', width: 130, formatter: formatearEstadoFUAS },
    { key: 'postulo_fuas', header: 'Postuló FUAS', width: 90, formatter: (_, item) => item?.estado === 'postulo' ? 'Sí' : 'No' },
    { key: 'notificacion_enviada', header: 'Notificado', width: 90, formatter: (v) => v ? 'Sí' : 'No' }
  ];

  // Agregar columna de documento solo para no_postulantes
  if (tipo === 'no_postulantes' || tipo === 'estudiantes_fuas') {
    columnas.push({ key: 'documento_url', header: 'Documento', width: 100, formatter: (v) => v ? 'Sí' : 'No' });
  }

  // Determinar título según tipo
  const titulos: Record<string, string> = {
    'acreditacion': 'Estudiantes Pendientes de Acreditación - GestorCeduc',
    'no_postulantes': 'Estudiantes No Postulantes FUAS - GestorCeduc',
    'postulantes_fuas': 'Estudiantes que Postularon FUAS - GestorCeduc',
    'estudiantes_fuas': 'Estudiantes FUAS (Todos) - GestorCeduc'
  };
  const titulo = titulos[tipo] || 'Estudiantes FUAS - GestorCeduc';
  
  const xml = generarExcelXML(estudiantes, columnas, titulo);
  const fecha = new Date().toISOString().split('T')[0];
  
  // Determinar nombre de archivo según tipo
  const archivos: Record<string, string> = {
    'acreditacion': `pendientes_acreditacion_${fecha}.xls`,
    'no_postulantes': `no_postulantes_fuas_${fecha}.xls`,
    'postulantes_fuas': `postulantes_fuas_${fecha}.xls`,
    'estudiantes_fuas': `estudiantes_fuas_todos_${fecha}.xls`
  };
  const nombreArchivo = archivos[tipo] || `estudiantes_fuas_${fecha}.xls`;
  
  descargarArchivo(xml, nombreArchivo, 'application/vnd.ms-excel');
}

/**
 * Exportar estudiantes con beneficios
 */
export function exportarEstudiantesConBeneficios(estudiantes: any[]) {
  const columnas: ColumnConfig[] = [
    { key: 'rut', header: 'RUT', width: 100 },
    { key: 'nombre', header: 'Nombre Completo', width: 200 },
    { key: 'correo', header: 'Correo Electrónico', width: 200 },
    { key: 'carrera', header: 'Carrera', width: 180 },
    { key: 'cod_carrera', header: 'Cód. Carrera', width: 80 },
    { key: 'sede', header: 'Sede', width: 80 },
    { key: 'jornada', header: 'Jornada', width: 80, formatter: formatearJornada },
    { key: 'anio_ingreso', header: 'Año Ingreso', width: 90 },
    { key: 'nivel', header: 'Nivel', width: 60 },
    { key: 'estado_academico', header: 'Estado Matrícula', width: 110 },
    { key: 'beneficios_texto', header: 'Beneficios Obtenidos', width: 250, formatter: (_, item) => {
      if (!item?.beneficios || !Array.isArray(item.beneficios)) return '';
      return item.beneficios.map((b: any) => `${b.tipo}: ${b.nombre}`).join(', ');
    }},
    { key: 'notificacion_enviada', header: 'Notificado', width: 90, formatter: (v) => v ? 'Sí' : 'No' }
  ];

  const xml = generarExcelXML(estudiantes, columnas, 'Estudiantes con Beneficios - GestorCeduc');
  const fecha = new Date().toISOString().split('T')[0];
  descargarArchivo(xml, `estudiantes_beneficios_${fecha}.xls`, 'application/vnd.ms-excel');
}

// ============================================
// FORMATEADORES
// ============================================

function formatearJornada(jornada: string | null | undefined): string {
  if (!jornada) return '';
  if (jornada === 'D') return 'Diurno';
  if (jornada === 'V') return 'Vespertino';
  return jornada;
}

function formatearEstadoFUAS(estado: string | null | undefined): string {
  const estados: Record<string, string> = {
    'sin_pendientes': 'Sin pendientes',
    'debe_acreditar': 'Debe acreditar',
    'no_postulo': 'No postuló',
    'postulo': 'Postuló',
    'documento_pendiente': 'Doc. pendiente',
    'documento_validado': 'Doc. validado',
    'documento_rechazado': 'Doc. rechazado',
    'acreditado': 'Acreditado'
  };
  return estado ? (estados[estado] || estado) : '';
}

function formatearEstadoCita(estado: string | null | undefined): string {
  const estados: Record<string, string> = {
    'pendiente': 'Pendiente',
    'confirmada': 'Confirmada',
    'completada': 'Completada',
    'cancelada': 'Cancelada'
  };
  return estado ? (estados[estado] || estado) : '';
}

// Exportación por defecto para uso general
export default {
  exportarDirectorioEstudiantes,
  exportarCitas,
  exportarEstudiantesFUAS,
  exportarEstudiantesConBeneficios
};
