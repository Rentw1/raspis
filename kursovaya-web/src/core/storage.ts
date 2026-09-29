/**
 * Хранилище на устройстве: настройки и ключи — localStorage, курсовые — IndexedDB
 * (если IndexedDB недоступна, например в приватном режиме, — localStorage).
 * Данные никуда не отправляются; для переноса есть резервная копия в файл.
 */
import { normalizeCoursework, type Coursework } from '../models/coursework';
import { defaultSettings, normalizeSettings, type AppSettings } from '../models/settings';

export interface ProjectStore {
  all(): Promise<Coursework[]>;
  put(c: Coursework): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

const SETTINGS_KEY = 'kursovaya.settings.v1';
const SECRET_PREFIX = 'kursovaya.secret.';
const PROJECT_PREFIX = 'kursovaya.project.';

/** Память — для тестов и как последний запасной вариант. */
export class MemoryKeyValue implements KeyValue {
  private m = new Map<string, string>();
  getItem(key: string) {
    return this.m.has(key) ? (this.m.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.m.set(key, value);
  }
  removeItem(key: string) {
    this.m.delete(key);
  }
  key(index: number) {
    return [...this.m.keys()][index] ?? null;
  }
  get length() {
    return this.m.size;
  }
}

function keysWithPrefix(kv: KeyValue, prefix: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < kv.length; i++) {
    const k = kv.key(i);
    if (k && k.startsWith(prefix)) out.push(k);
  }
  return out;
}

class KeyValueProjects implements ProjectStore {
  constructor(private readonly kv: KeyValue) {}
  async all() {
    const out: Coursework[] = [];
    for (const k of keysWithPrefix(this.kv, PROJECT_PREFIX)) {
      try {
        out.push(normalizeCoursework(JSON.parse(this.kv.getItem(k) ?? 'null')));
      } catch {
        // повреждённая запись пропускается
      }
    }
    return out;
  }
  async put(c: Coursework) {
    try {
      this.kv.setItem(PROJECT_PREFIX + c.id, JSON.stringify(c));
    } catch {
      throw new Error('Недостаточно места в хранилище браузера. Удалите старые курсовые или сохраните резервную копию.');
    }
  }
  async delete(id: string) {
    this.kv.removeItem(PROJECT_PREFIX + id);
  }
}

class IdbProjects implements ProjectStore {
  private constructor(private readonly db: IDBDatabase) {}

  static open(): Promise<IdbProjects> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('kursovaya', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(new IdbProjects(req.result));
      req.onerror = () => reject(req.error ?? new Error('IndexedDB недоступна'));
      req.onblocked = () => reject(new Error('IndexedDB занята другой вкладкой'));
    });
  }

  private tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction('projects', mode);
      const r = fn(t.objectStore('projects'));
      t.oncomplete = () => resolve(r.result);
      t.onerror = () => reject(t.error ?? r.error ?? new Error('Ошибка IndexedDB'));
      t.onabort = () => reject(t.error ?? new Error('Запись в IndexedDB отменена (мало места?)'));
    });
  }

  async all() {
    const rows = await this.tx('readonly', (s) => s.getAll() as IDBRequest<unknown[]>);
    return rows.map((r) => normalizeCoursework(r));
  }
  async put(c: Coursework) {
    await this.tx('readwrite', (s) => s.put(JSON.parse(JSON.stringify(c))));
  }
  async delete(id: string) {
    await this.tx('readwrite', (s) => s.delete(id));
  }
}

export class Storage {
  private constructor(
    private readonly kv: KeyValue,
    private readonly projects: ProjectStore,
    readonly persistent: boolean,
  ) {}

  /** Хранилище браузера. */
  static async open(): Promise<Storage> {
    let kv: KeyValue;
    try {
      kv = window.localStorage;
      kv.setItem('kursovaya.probe', '1');
      kv.removeItem('kursovaya.probe');
    } catch {
      kv = new MemoryKeyValue();
    }
    let projects: ProjectStore;
    try {
      projects = await IdbProjects.open();
    } catch {
      projects = new KeyValueProjects(kv);
    }
    let persistent = false;
    try {
      persistent = (await navigator.storage?.persist?.()) ?? false;
    } catch {
      persistent = false;
    }
    return new Storage(kv, projects, persistent);
  }

  /** Хранилище в памяти (тесты). */
  static memory(): Storage {
    const kv = new MemoryKeyValue();
    return new Storage(kv, new KeyValueProjects(kv), false);
  }

  // ---------- Настройки ----------

  loadSettings(): AppSettings {
    const raw = this.kv.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    try {
      return normalizeSettings(JSON.parse(raw));
    } catch {
      return defaultSettings();
    }
  }

  saveSettings(s: AppSettings): void {
    this.kv.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  // ---------- Секреты (ключи API, сертификат) ----------

  readSecret(name: string): string {
    return this.kv.getItem(SECRET_PREFIX + name) ?? '';
  }

  writeSecret(name: string, value: string): void {
    const v = value.trim();
    if (v) this.kv.setItem(SECRET_PREFIX + name, v);
    else this.kv.removeItem(SECRET_PREFIX + name);
  }

  secretNames(): string[] {
    return keysWithPrefix(this.kv, SECRET_PREFIX).map((k) => k.slice(SECRET_PREFIX.length));
  }

  // ---------- Курсовые ----------

  async loadProjects(): Promise<Coursework[]> {
    const list = await this.projects.all();
    return list.sort((a, b) => b.updated.localeCompare(a.updated));
  }

  async saveProject(c: Coursework): Promise<void> {
    c.updated = new Date().toISOString();
    await this.projects.put(c);
  }

  async deleteProject(id: string): Promise<void> {
    await this.projects.delete(id);
  }

  // ---------- Резервная копия ----------

  backup(projects: Coursework[], settings: AppSettings, withKeys: boolean): string {
    const secrets: Record<string, string> = {};
    if (withKeys) for (const n of this.secretNames()) secrets[n] = this.readSecret(n);
    return JSON.stringify({ app: 'kursovaya-ltet', version: 1, exported: new Date().toISOString(), settings, secrets, projects }, null, 1);
  }

  /** Восстановление: возвращает список курсовых из файла (настройки и ключи применяются сразу). */
  restore(json: string): { projects: Coursework[]; settings: AppSettings | null } {
    let j: Record<string, unknown>;
    try {
      j = JSON.parse(json) as Record<string, unknown>;
    } catch {
      throw new Error('Файл не похож на резервную копию (повреждён JSON).');
    }
    if (j.app !== 'kursovaya-ltet') {
      // одиночная курсовая
      if (j.meta && j.id) return { projects: [normalizeCoursework(j)], settings: null };
      throw new Error('Это не резервная копия приложения «Курсовая ЛТЭТ».');
    }
    const projects = Array.isArray(j.projects) ? j.projects.map((p) => normalizeCoursework(p)) : [];
    const settings = j.settings ? normalizeSettings(j.settings) : null;
    if (settings) this.saveSettings(settings);
    if (j.secrets && typeof j.secrets === 'object') {
      for (const [k, v] of Object.entries(j.secrets as Record<string, unknown>)) if (typeof v === 'string') this.writeSecret(k, v);
    }
    return { projects, settings };
  }
}
