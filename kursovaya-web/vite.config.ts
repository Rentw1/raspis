/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** Все файлы сборки (пути относительно каталога сборки, через «/»). */
function walk(dir: string, root = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, root));
    else out.push(relative(root, full).split(sep).join('/'));
  }
  return out.sort();
}

/**
 * Service worker без сторонних библиотек: после сборки в sw.js подставляются список файлов
 * для офлайн-кэша и версия (хэш содержимого) — при любом изменении приложения кэш обновляется.
 */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'kursovaya-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = walk(outDir).filter((f) => f !== 'sw.js' && !f.endsWith('.map') && !f.startsWith('fonts/') && f !== 'robots.txt');
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const precache = ['./', ...files.filter((f) => f !== 'index.html').map((f) => `./${f}`)];
      const sw = readFileSync('sw/sw-template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(precache));
      writeFileSync(join(outDir, 'sw.js'), sw);
      writeFileSync(join(outDir, 'version.json'), JSON.stringify({ version, built: new Date().toISOString() }));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  build: {
    target: ['es2020', 'safari14'],
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
    proxy: {
      '/api': { target: process.env.KURSOVAYA_API ?? 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 60000,
  },
});
