// app/src/app/api/export/planning/route.ts
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const { title, headers, rows, month, year } = body as {
    title: string;
    headers: string[][];   // 2D array — header rows (multi-level)
    rows: (string | number)[][];
    month: number;
    year: number;
  };

  const workbook  = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`KH Thang ${month}-${year}`);

  const totalCols = headers[0].length;

  // Title row (row 1)
  worksheet.mergeCells(`A1:${columnLetter(totalCols)}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = title;
  titleCell.font  = { bold: true, size: 13 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 28;

  // Headers (multi-row, rows 2..N+1)
  const headerStartRow = 2;
  headers.forEach((headerRow, ri) => {
    const row = worksheet.getRow(headerStartRow + ri);
    headerRow.forEach((cell, ci) => {
      const c = row.getCell(ci + 1);
      c.value = cell;
      c.font  = { bold: true, size: 10 };
      c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border  = {
        top:    { style: 'thin', color: { argb: 'FFB0BEC5' } },
        bottom: { style: 'thin', color: { argb: 'FFB0BEC5' } },
        left:   { style: 'thin', color: { argb: 'FFB0BEC5' } },
        right:  { style: 'thin', color: { argb: 'FFB0BEC5' } },
      };
    });
    row.height = 22;
  });

  // Merge col 1 & 2 vertically across all header rows (Thương hiệu, Dòng xe)
  if (headers.length >= 2) {
    const lastHeaderRow = headerStartRow + headers.length - 1;
    worksheet.mergeCells(headerStartRow, 1, lastHeaderRow, 1);
    worksheet.mergeCells(headerStartRow, 2, lastHeaderRow, 2);
  }

  // Merge consecutive same-value cells in header row 1 (channel names, from col 3 onward)
  if (headers.length >= 1) {
    const row1 = headers[0];
    let ci = 3; // 1-indexed, start after col 1 & 2
    while (ci <= totalCols) {
      const cellVal = row1[ci - 1];
      if (!cellVal) { ci++; continue; }
      let span = 1;
      while (ci + span <= totalCols && row1[ci + span - 1] === cellVal) span++;
      if (span > 1) {
        worksheet.mergeCells(headerStartRow, ci, headerStartRow, ci + span - 1);
        // Re-apply style on merged cell (ExcelJS resets it after merge)
        const mc = worksheet.getRow(headerStartRow).getCell(ci);
        mc.font  = { bold: true, size: 10 };
        mc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        mc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        mc.border = {
          top:    { style: 'thin', color: { argb: 'FFB0BEC5' } },
          bottom: { style: 'thin', color: { argb: 'FFB0BEC5' } },
          left:   { style: 'thin', color: { argb: 'FFB0BEC5' } },
          right:  { style: 'thin', color: { argb: 'FFB0BEC5' } },
        };
      }
      ci += span;
    }
  }

  // Data rows
  const dataStartRow = headers.length + headerStartRow;
  rows.forEach((dataRow, ri) => {
    const row = worksheet.getRow(dataStartRow + ri);
    const firstCell = dataRow[0];
    const isBrandTotal = typeof firstCell === 'string' && firstCell.startsWith('Σ');
    const isSectionHeader = typeof firstCell === 'string' && firstCell === firstCell.toUpperCase() && firstCell.length > 3 && typeof dataRow[1] === 'string' && dataRow[1] === '';
    const isEmpty = dataRow.every(c => c === '' || c === 0 || c === null || c === undefined);

    dataRow.forEach((cell, ci) => {
      const c = row.getCell(ci + 1);
      c.value = cell === 0 && ci > 1 ? '' : cell;
      c.alignment = { vertical: 'middle' };

      if (isBrandTotal) {
        c.font = { bold: true, size: 10 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      } else if (isSectionHeader) {
        c.font = { bold: true, size: 10, color: { argb: 'FF334155' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      } else {
        c.font = { size: 10 };
      }

      if (!isEmpty) {
        c.border = {
          top:    { style: 'hair', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
          left:   { style: 'hair', color: { argb: 'FFE2E8F0' } },
          right:  { style: 'hair', color: { argb: 'FFE2E8F0' } },
        };
      }

      if (ci > 1 && typeof cell === 'number' && cell !== 0) {
        c.numFmt = '#,##0.0';
        c.alignment.horizontal = 'right';
      }
      if (ci === 0) c.alignment.horizontal = 'left';
    });
    row.height = isBrandTotal ? 20 : 18;
  });

  // Column widths
  worksheet.columns.forEach((col, i) => {
    col.width = i === 0 ? 20 : i === 1 ? 22 : 12;
  });

  // Freeze header rows
  worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: dataStartRow - 1 }];

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="KH_Thang${month}_${year}.xlsx"`,
    },
  });
  } catch (err: any) {
    console.error('[export/planning] ERROR:', err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

function columnLetter(n: number): string {
  let result = '';
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}
