/**
 * Identidad de la unidad propietaria del sistema.
 *
 * Punto único de reemplazo: para adoptar el escudo y el nombre reales basta
 * cambiar estos valores y sustituir el archivo `public/escudo.svg`. Ningún
 * componente debe escribir el nombre de la unidad directamente.
 */
export const INSTITUCION = {
  /** Nombre corto que se muestra en la barra lateral y en el login. */
  nombre: "MISIONES SAR",
  /** Descriptor bajo el nombre, tal como aparece en la referencia visual. */
  descriptor: "Sistema de carga documental",
  /** Nombre completo de la unidad, usado en exportaciones y avisos legales. */
  unidadPropietaria: "Unidad Aérea de Búsqueda y Rescate",
  /** Ruta del escudo dentro de `public`. Reemplazable por el escudo oficial. */
  escudo: "/escudo.svg",
  /** Correo de contacto para soporte y para el aviso de privacidad. */
  correoContacto: "soporte@misiones-sar.local",
} as const;
