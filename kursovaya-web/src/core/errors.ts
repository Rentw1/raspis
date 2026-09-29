export type AiErrorKind =
  | 'auth'
  | 'payment'
  | 'notFound'
  | 'rateLimit'
  | 'server'
  | 'network'
  | 'timeout'
  | 'badRequest'
  | 'empty'
  | 'cancelled'
  | 'format'
  | 'config'
  | 'other';

/** Ошибка обращения к ИИ (или шага генерации) с понятным пользователю сообщением. */
export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly status?: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(message: string, opts: { kind?: AiErrorKind; status?: number; retryable?: boolean; retryAfterMs?: number } = {}) {
    super(message);
    this.name = 'AiError';
    this.kind = opts.kind ?? 'other';
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

/** Ошибка сетевого запроса к базам и сайтам. */
export class NetError extends Error {
  readonly status?: number;
  readonly timeout: boolean;

  constructor(message: string, opts: { status?: number; timeout?: boolean } = {}) {
    super(message);
    this.name = 'NetError';
    this.status = opts.status;
    this.timeout = opts.timeout ?? false;
  }
}

export const cancelledError = () => new AiError('Остановлено пользователем.', { kind: 'cancelled' });

export const isCancelled = (e: unknown) => e instanceof AiError && e.kind === 'cancelled';

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Отмена долгих операций: прерывает запросы и ожидания. */
export class CancelToken {
  private readonly ac = new AbortController();

  get signal(): AbortSignal {
    return this.ac.signal;
  }

  get isCancelled(): boolean {
    return this.ac.signal.aborted;
  }

  cancel(): void {
    if (!this.ac.signal.aborted) this.ac.abort();
  }

  throwIfCancelled(): void {
    if (this.isCancelled) throw cancelledError();
  }

  /** Пауза, прерываемая отменой. */
  delay(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isCancelled) {
        reject(cancelledError());
        return;
      }
      const onAbort = () => {
        clearTimeout(t);
        reject(cancelledError());
      };
      const t = setTimeout(() => {
        this.ac.signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      this.ac.signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
