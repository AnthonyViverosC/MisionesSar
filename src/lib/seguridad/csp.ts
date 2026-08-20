/**
 * Content-Security-Policy por petición.
 *
 * Se genera un nonce distinto en cada respuesta: es lo que permite prohibir
 * `unsafe-inline` sin romper los scripts que Next.js inserta para hidratar la
 * página. En desarrollo se admite `unsafe-eval` porque el recargado en caliente
 * lo necesita; en producción no.
 */
export function construirCsp(nonce: string, esProduccion: boolean): string {
  const directivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      // Permite ejecutar los scripts que el nonce ya autorizó en navegadores
      // que aún no implementan 'strict-dynamic' de forma completa.
      "'strict-dynamic'",
      ...(esProduccion ? [] : ["'unsafe-eval'"]),
    ],
    // Las hojas de estilo de Tailwind se sirven como archivo; los estilos en
    // línea que inyecta Next durante la carga van con el mismo nonce.
    "style-src": ["'self'", `'nonce-${nonce}'`, "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:"],
    "media-src": ["'self'", "blob:"],
    "font-src": ["'self'", "data:"],
    // El navegador habla con Supabase para autenticarse y para subir archivos.
    "connect-src": ["'self'", process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", "blob:"],
    "frame-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "worker-src": ["'self'", "blob:"],
  };

  if (esProduccion) {
    directivas["upgrade-insecure-requests"] = [];
  }

  return Object.entries(directivas)
    .map(([directiva, valores]) =>
      valores.length ? `${directiva} ${valores.filter(Boolean).join(" ")}` : directiva,
    )
    .join("; ");
}

/** Genera un nonce aleatorio en base64, apto para el Edge Runtime. */
export function generarNonce(): string {
  const aleatorio = new Uint8Array(16);
  crypto.getRandomValues(aleatorio);
  return btoa(String.fromCharCode(...aleatorio));
}
