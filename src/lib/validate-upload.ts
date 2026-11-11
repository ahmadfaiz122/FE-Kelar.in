export const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
};

export function validateUpload(file: File, maxFileSizeMB: number) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extensions = ALLOWED_FILE_TYPES[file.type];
  if (!extensions || !extensions.includes(extension)) {
    return "Format file harus PDF, JPG, JPEG, atau PNG.";
  }
  if (file.size <= 0) return "File kosong tidak dapat diunggah.";
  if (file.size > maxFileSizeMB * 1024 * 1024) return `Ukuran file maksimal ${maxFileSizeMB} MB.`;
  return null;
}

export function safeFileName(name: string) {
  return name.replace(/[\\/\\0-\\x1f\\x7f]/g, "_").slice(0, 180) || "lampiran";
}
