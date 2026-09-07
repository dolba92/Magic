import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vercel = process.argv[2] === 'vercel';
const target = resolve(root, vercel ? 'dist-vercel/assets/files' : 'dist/client/_next/static/css/files');
await mkdir(target, { recursive: true });
for (const family of ['literata','pt-serif','merriweather','source-serif-4','bitter','lora','noto-serif','manrope','open-sans']) {
  await cp(resolve(root, 'node_modules/@fontsource', family, 'files'), target, { recursive: true });
}
