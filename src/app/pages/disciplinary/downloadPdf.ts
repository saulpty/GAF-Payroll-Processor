// Saves a base64 PDF as a file in the browser. Accepts bare base64 or a
// 'data:application/pdf;base64,...' string.
export function downloadBase64Pdf(base64: string, filename: string): void {
  const clean = base64.includes(',') ? base64.slice(base64.lastIndexOf(',') + 1) : base64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
