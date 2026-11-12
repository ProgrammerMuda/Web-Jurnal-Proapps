// Prototype: isi berkas yang diunggah disimpan di IndexedDB browser (data lain tetap di localStorage hanya berupa nama).
// Ini membuat tombol Lihat dan Unduh tetap bekerja setelah halaman dimuat ulang.
const DB = 'proapps-pembelian-files';
const STORE = 'files';
const memory = new Map();

// Berkas contoh pada data awal: dibuatkan PDF kecil supaya pratinjau dan unduhan bisa didemokan.
const SAMPLE = ['iom-meja-lipat.pdf', 'iom-atk-lt3.pdf', 'iom-lemari.pdf', 'iom-atk.pdf', 'iom-kursi.pdf'];

function makeSamplePdf(name) {
  const text = `Contoh berkas prototype: ${name}`.replace(/[()\\]/g, '');
  const stream = `BT /F1 16 Tf 40 120 Td (${text}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 240] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { pdf += `${String(o).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new File([pdf], name, { type: 'application/pdf' });
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no idb'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'name' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    return undefined;
  });
}

const tx = async (mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r?.result ?? null);
    t.onerror = () => reject(t.error);
  });
};

export function registerFiles(files) {
  files.forEach((f) => {
    memory.set(f.name, f);
    tx('readwrite', (s) => s.put({ name: f.name, blob: f, type: f.type })).catch(() => {});
  });
}

// Muat berkas (memori → IndexedDB → contoh bawaan). Mengembalikan null bila tidak ada.
export async function loadFile(name) {
  if (memory.has(name)) return memory.get(name);
  try {
    const rec = await tx('readonly', (s) => s.get(name));
    if (rec) {
      const file = new File([rec.blob], name, { type: rec.type });
      memory.set(name, file);
      return file;
    }
  } catch {
    // IndexedDB tidak tersedia: lanjut ke contoh bawaan.
  }
  if (SAMPLE.includes(name)) {
    const file = makeSamplePdf(name);
    memory.set(name, file);
    return file;
  }
  return null;
}

export const fmtMB = (b) => (b < 1_000_000 ? `${Math.max(1, Math.round(b / 1000))} KB` : `${(b / 1_000_000).toFixed(1).replace('.', ',')} MB`);
export const extOf = (name) => (name.includes('.') ? name.split('.').pop().toUpperCase() : 'BERKAS');

export async function downloadFile(name) {
  const file = await loadFile(name);
  const blob = file ?? new Blob([`Prototype Dashboard Jurnal.\nIsi berkas "${name}" tidak ditemukan di browser ini.\n`], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file ? name : `${name}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
