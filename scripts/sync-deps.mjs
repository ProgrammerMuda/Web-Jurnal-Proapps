// Dijalankan otomatis sebelum `npm run dev`: install ulang dependensi jika package.json / lockfile berubah.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const files = ['package.json', 'package-lock.json'].filter(existsSync);
const hash = createHash('sha1');
files.forEach((f) => hash.update(readFileSync(f)));
const current = hash.digest('hex');
const stamp = 'node_modules/.deps-hash';

const previous = existsSync(stamp) ? readFileSync(stamp, 'utf8') : '';
if (previous !== current) {
  console.log('[sync-deps] dependensi berubah, menjalankan npm install...');
  execSync('npm install --no-audit --no-fund', { stdio: 'inherit' });
  mkdirSync('node_modules', { recursive: true });
  writeFileSync(stamp, current);
} else {
  console.log('[sync-deps] dependensi sudah terbaru.');
}
