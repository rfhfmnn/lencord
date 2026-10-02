import { NextRequest, NextResponse } from 'next/server';

function createMockPdfBuffer(filename: string): Buffer {
  const cleanName = filename.replace(/[^\w\s.-]/g, '');
  const content = `BT /F1 14 Tf 70 700 Td (Lencord - Documento de Respaldo: ${cleanName}) Tj ET`;
  const streamLength = Buffer.byteLength(content, 'utf-8');

  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${content}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000216 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
330
%%EOF`;

  return Buffer.from(pdfString);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await context.params;
  const fileName = path && path.length > 0 ? path[path.length - 1] : 'documento.pdf';
  const pdfBuffer = createMockPdfBuffer(fileName);

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
