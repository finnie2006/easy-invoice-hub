export type ExcelCellType = 'string' | 'number' | 'currency' | 'date';
export type ExcelRowStyle = 'normal' | 'total';

export type ExcelColumn = {
  key: string;
  header: string;
  width?: number;
  type?: ExcelCellType;
};

export type ExcelRow = Record<string, string | number | boolean | null | undefined> & {
  __style?: ExcelRowStyle;
};

export type ExcelSheet = {
  name: string;
  title?: string;
  description?: string;
  columns: ExcelColumn[];
  rows: ExcelRow[];
};

const escapeXml = (value: string | number | boolean | null | undefined) => {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const getSheetName = (name: string) => {
  return name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || 'Sheet';
};

const getCellStyle = (type: ExcelCellType, rowStyle: ExcelRowStyle = 'normal') => {
  if (rowStyle === 'total') {
    if (type === 'currency') return 'TotalCurrency';
    if (type === 'number') return 'TotalNumber';
    return 'TotalText';
  }

  if (type === 'currency') return 'Currency';
  if (type === 'number') return 'Number';
  if (type === 'date') return 'Date';
  return 'Text';
};

const toExcelDate = (value: string | number | boolean | null | undefined) => {
  if (!value) return '';
  const dateValue = new Date(String(value));

  if (Number.isNaN(dateValue.getTime())) {
    return '';
  }

  return dateValue.toISOString().slice(0, 10) + 'T00:00:00.000';
};

const renderCell = (
  value: string | number | boolean | null | undefined,
  type: ExcelCellType = 'string',
  rowStyle: ExcelRowStyle = 'normal',
) => {
  const styleId = getCellStyle(type, rowStyle);

  if (value === null || value === undefined || value === '') {
    return `<Cell ss:StyleID="${styleId}"/>`;
  }

  if (type === 'number' || type === 'currency') {
    const numberValue = Number(value);
    return Number.isFinite(numberValue)
      ? `<Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${numberValue}</Data></Cell>`
      : `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
  }

  if (type === 'date') {
    const excelDate = toExcelDate(value);
    return excelDate
      ? `<Cell ss:StyleID="${styleId}"><Data ss:Type="DateTime">${excelDate}</Data></Cell>`
      : `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
  }

  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
};

const renderSheet = (sheet: ExcelSheet) => {
  const columns = sheet.columns
    .map((column) => `<Column ss:AutoFitWidth="0" ss:Width="${column.width || 120}"/>`)
    .join('');
  const titleMerge = Math.max(sheet.columns.length - 1, 0);
  const titleRows = [
    sheet.title
      ? `<Row ss:Height="26"><Cell ss:StyleID="Title" ss:MergeAcross="${titleMerge}"><Data ss:Type="String">${escapeXml(sheet.title)}</Data></Cell></Row>`
      : '',
    sheet.description
      ? `<Row><Cell ss:StyleID="Subtitle" ss:MergeAcross="${titleMerge}"><Data ss:Type="String">${escapeXml(sheet.description)}</Data></Cell></Row>`
      : '',
    sheet.title || sheet.description ? '<Row/>' : '',
  ].join('');
  const headerRow = `<Row>${sheet.columns
    .map((column) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(column.header)}</Data></Cell>`)
    .join('')}</Row>`;
  const dataRows = sheet.rows
    .map((row) => {
      const rowStyle = row.__style || 'normal';
      return `<Row>${sheet.columns
        .map((column) => renderCell(row[column.key], column.type, rowStyle))
        .join('')}</Row>`;
    })
    .join('');

  return `
    <Worksheet ss:Name="${escapeXml(getSheetName(sheet.name))}">
      <Table>
        ${columns}
        ${titleRows}
        ${headerRow}
        ${dataRows}
      </Table>
      <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
        <Selected/>
        <FreezePanes/>
        <FrozenNoSplit/>
        <SplitHorizontal>${sheet.title || sheet.description ? 4 : 1}</SplitHorizontal>
        <TopRowBottomPane>${sheet.title || sheet.description ? 4 : 1}</TopRowBottomPane>
        <ActivePane>2</ActivePane>
      </WorksheetOptions>
    </Worksheet>`;
};

export const toExcelWorkbook = (sheets: ExcelSheet[]) => {
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:FontName="Arial" ss:Size="16" ss:Bold="1" ss:Color="#111827"/>
      <Interior ss:Color="#EAF2FF" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Subtitle">
      <Font ss:FontName="Arial" ss:Size="10" ss:Color="#4B5563"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1F4E79" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
      </Borders>
    </Style>
    <Style ss:ID="Text">
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
    </Style>
    <Style ss:ID="Number">
      <NumberFormat ss:Format="#,##0.00"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
    </Style>
    <Style ss:ID="Currency">
      <NumberFormat ss:Format="&quot;EUR&quot; #,##0.00"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
    </Style>
    <Style ss:ID="Date">
      <NumberFormat ss:Format="dd-mm-yyyy"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
    </Style>
    <Style ss:ID="TotalText">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#9CA3AF"/>
      </Borders>
    </Style>
    <Style ss:ID="TotalNumber">
      <Font ss:Bold="1"/>
      <NumberFormat ss:Format="#,##0.00"/>
      <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#9CA3AF"/>
      </Borders>
    </Style>
    <Style ss:ID="TotalCurrency">
      <Font ss:Bold="1"/>
      <NumberFormat ss:Format="&quot;EUR&quot; #,##0.00"/>
      <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#9CA3AF"/>
      </Borders>
    </Style>
  </Styles>
  ${sheets.map(renderSheet).join('')}
</Workbook>`;
};

export const downloadExcelWorkbook = (filename: string, sheets: ExcelSheet[]) => {
  const blob = new Blob([toExcelWorkbook(sheets)], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
