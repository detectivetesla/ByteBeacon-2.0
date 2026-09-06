/**
 * ByteBeacon Console & Payload Scrubber
 *
 * Intercepts console logging methods (log, info, warn, error, debug) and sanitizes
 * any internal upstream vendor strings (DataHouse, GMPL, GetMorePayLess, Portal-02, etc.)
 * before outputting to the browser's developer console.
 *
 * Ensures that customers and agents inspecting DevTools see ByteBeacon info and ByteBeacon only.
 */

const VENDOR_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /https?:\/\/api\.getmorepaylessdatahouse\.net(\/api\/v1)?/gi, replacement: 'https://api.bytebeacon.com/api/v1' },
  { pattern: /https?:\/\/www\.getmorepaylessdatahouse\.net(\/agent\/api)?/gi, replacement: '/agent/api' },
  { pattern: /getmorepaylessdatahouse\.net/gi, replacement: 'bytebeacon.com' },
  { pattern: /datahouse\.com\.gh/gi, replacement: 'bytebeacon.com' },
  { pattern: /gmpl\.com\.gh/gi, replacement: 'bytebeacon.com' },
  { pattern: /getmorepayless/gi, replacement: 'ByteBeacon' },
  { pattern: /DataHouse\s+Telecom\s+Gateway/gi, replacement: 'ByteBeacon Telecom Gateway' },
  { pattern: /DataHouse\s+Carrier\s+Gateway/gi, replacement: 'ByteBeacon Carrier Gateway' },
  { pattern: /DataHouse/gi, replacement: 'ByteBeacon' },
  { pattern: /GMPL/gi, replacement: 'ByteBeacon' },
  { pattern: /Portal-02/gi, replacement: 'ByteBeacon' },
];

export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') return input;
  let result = input;
  for (const { pattern, replacement } of VENDOR_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function sanitizeObject<T>(input: T, depth = 0): T {
  if (depth > 8 || input === null || input === undefined) return input;

  if (typeof input === 'string') {
    return sanitizeText(input) as unknown as T;
  }

  if (input instanceof Error) {
    const cleanError = new Error(sanitizeText(input.message));
    cleanError.name = input.name;
    if (input.stack) {
      cleanError.stack = sanitizeText(input.stack);
    }
    return cleanError as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeObject(item, depth + 1)) as unknown as T;
  }

  if (typeof input === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeText(key)] = sanitizeObject(value, depth + 1);
    }
    return sanitized as T;
  }

  return input;
}

export function initConsoleScrubber(): void {
  if (typeof window === 'undefined' || typeof console === 'undefined') return;

  // Guard against multiple initializations
  if ((window as any).__bytebeacon_console_scrubber_initialized) return;
  (window as any).__bytebeacon_console_scrubber_initialized = true;

  const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  const wrapMethod = (original: (...args: any[]) => void) => {
    return (...args: any[]) => {
      try {
        const cleanedArgs = args.map((arg) => sanitizeObject(arg));
        original(...cleanedArgs);
      } catch {
        original(...args);
      }
    };
  };

  console.log = wrapMethod(originalConsole.log);
  console.info = wrapMethod(originalConsole.info);
  console.warn = wrapMethod(originalConsole.warn);
  console.error = wrapMethod(originalConsole.error);
  console.debug = wrapMethod(originalConsole.debug);
}
