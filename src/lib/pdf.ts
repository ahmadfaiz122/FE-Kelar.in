function ascii(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "-");
}

function escapePdf(value: string) {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(value: string, max = 78) {
  const words = ascii(value).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((`${line} ${word}`).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines;
}

export function generateSimulationPdf(input: {
  title: string;
  publicId: string;
  citizenName: string;
  serviceName: string;
  createdAt?: Date;
  purpose?: string;
}) {
  const date = input.createdAt ?? new Date();
  const dateLabel = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long" }).format(date);
  const contentLines = [
    "SIMULASI / BUKAN DOKUMEN RESMI",
    "",
    "KELAR.IN | CONTOH SURAT PELAYANAN DIGITAL",
    "============================================",
    "",
    input.title.toUpperCase(),
    `Nomor simulasi: ${input.publicId}`,
    `Nama pemohon: ${input.citizenName}`,
    `Jenis layanan: ${input.serviceName}`,
    `Tanggal: ${dateLabel}`,
    "",
    ...wrap(input.purpose ? `Keperluan: ${input.purpose}` : "Dokumen ini dibuat hanya untuk pratinjau alur aplikasi kelar.in."),
    "",
    "Dokumen ini merupakan data simulasi, tidak memiliki tanda tangan elektronik,",
    "dan tidak dapat digunakan sebagai dokumen administrasi resmi.",
    "",
    "Demo sistem pelayanan publik digital | kelar.in",
  ];
  const stream = [
    "BT",
    "/F1 10 Tf",
    "52 788 Td",
    "15 TL",
    ...contentLines.map((line, index) => `${index === 0 ? "/F1 12 Tf" : ""} (${escapePdf(line)}) Tj T*`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}
