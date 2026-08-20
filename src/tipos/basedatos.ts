/**
 * Tipos del esquema de la base de datos.
 *
 * Sigue la forma que espera `@supabase/supabase-js`: cada tabla con Row,
 * Insert, Update y Relationships, y las funciones con Args y Returns. Las
 * relaciones declaradas son las que permiten tipar los `select` con joins.
 *
 * Se mantiene alineado a mano con `supabase/migrations`. Una vez enlazado el
 * proyecto puede regenerarse con:
 *
 *   pnpm db:types
 *
 * Si el archivo generado difiere de este, manda el generado.
 */

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type RolUsuario = "admin" | "operador" | "supervisor" | "consulta";

export type EstadoMision =
  | "borrador"
  | "enviada"
  | "en_revision"
  | "observada"
  | "aprobada"
  | "anulada";

export type TipoDocumento =
  | "orden_vuelo"
  | "orden_fragmentaria"
  | "requerimiento_mision"
  | "formulario_mision_cumplida"
  | "certificado_consumo"
  | "foto"
  | "video";

export type AccionAuditoria =
  | "crear"
  | "actualizar"
  | "cambiar_estado"
  | "subir_documento"
  | "reemplazar_documento"
  | "descargar_documento"
  | "observar"
  | "anular"
  | "ingreso_exitoso"
  | "ingreso_fallido"
  | "cerrar_sesion"
  | "invitar_usuario"
  | "cambiar_rol"
  | "desactivar_usuario";

export type TipoNotificacion =
  | "mision_enviada"
  | "mision_observada"
  | "mision_aprobada"
  | "mision_anulada";

type Marca = string; // timestamptz en ISO 8601
type Fecha = string; // date en formato AAAA-MM-DD

export type FilaUnidad = {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
  creado_en: Marca;
  actualizado_en: Marca;
};

export type FilaAeronave = {
  id: string;
  matricula: string;
  tipo: string;
  unidad_id: string;
  activa: boolean;
  creado_en: Marca;
  actualizado_en: Marca;
};

export type FilaTipoMision = {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  orden: number;
  creado_en: Marca;
  actualizado_en: Marca;
};

export type FilaPerfil = {
  id: string;
  nombre_completo: string;
  documento_identidad: string;
  grado: string | null;
  unidad_id: string | null;
  rol: RolUsuario;
  telefono: string | null;
  activo: boolean;
  debe_cambiar_clave: boolean;
  aviso_aceptado_en: Marca | null;
  ultimo_acceso: Marca | null;
  creado_en: Marca;
  actualizado_en: Marca;
};

export type FilaMision = {
  id: string;
  numero_mision: string;
  anio: number;
  fecha_inicio: Fecha;
  fecha_fin: Fecha | null;
  tipo_mision_id: string;
  tipo_mision: string;
  aeronave_id: string;
  aeronave_matricula: string;
  unidad_id: string;
  comandante_aeronave: string;
  zona_operacion: string;
  latitud: number | null;
  longitud: number | null;
  horas_vuelo: number | null;
  resumen: string | null;
  estado: EstadoMision;
  creada_por: string;
  enviada_en: Marca | null;
  revisada_por: string | null;
  revisada_en: Marca | null;
  aprobada_en: Marca | null;
  motivo_anulacion: string | null;
  anulada_por: string | null;
  anulada_en: Marca | null;
  creado_en: Marca;
  actualizado_en: Marca;
};

export type FilaDocumento = {
  id: string;
  mision_id: string;
  tipo: TipoDocumento;
  nombre_original: string;
  ruta_almacenamiento: string;
  bucket: string;
  mime_type: string;
  tamano_bytes: number;
  hash_sha256: string;
  version: number;
  vigente: boolean;
  subido_por: string;
  reemplazado_en: Marca | null;
  creado_en: Marca;
};

export type FilaObservacion = {
  id: string;
  mision_id: string;
  autor_id: string;
  texto: string;
  resuelta: boolean;
  resuelta_en: Marca | null;
  resuelta_por: string | null;
  creado_en: Marca;
};

export type FilaAuditoria = {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  accion: AccionAuditoria;
  entidad: string;
  entidad_id: string | null;
  datos_antes: Json | null;
  datos_despues: Json | null;
  ip: string | null;
  user_agent: string | null;
  creado_en: Marca;
};

export type FilaNotificacion = {
  id: string;
  destinatario_id: string;
  mision_id: string;
  tipo: TipoNotificacion;
  leida: boolean;
  leida_en: Marca | null;
  creado_en: Marca;
};

export type FilaIntentoIngreso = {
  id: number;
  correo: string | null;
  ip: string | null;
  exitoso: boolean;
  creado_en: Marca;
};

// Las relaciones se declaran como tipos literales: es lo que permite a
// supabase-js inferir los `select` que traen tablas asociadas.
type RelacionesPerfiles = [
  {
    foreignKeyName: "perfiles_unidad_id_fkey";
    columns: ["unidad_id"];
    isOneToOne: false;
    referencedRelation: "unidades";
    referencedColumns: ["id"];
  },
];

type RelacionesAeronaves = [
  {
    foreignKeyName: "aeronaves_unidad_id_fkey";
    columns: ["unidad_id"];
    isOneToOne: false;
    referencedRelation: "unidades";
    referencedColumns: ["id"];
  },
];

type RelacionesMisiones = [
  {
    foreignKeyName: "misiones_tipo_mision_id_fkey";
    columns: ["tipo_mision_id"];
    isOneToOne: false;
    referencedRelation: "tipos_mision";
    referencedColumns: ["id"];
  },
  {
    foreignKeyName: "misiones_aeronave_id_fkey";
    columns: ["aeronave_id"];
    isOneToOne: false;
    referencedRelation: "aeronaves";
    referencedColumns: ["id"];
  },
  {
    foreignKeyName: "misiones_unidad_id_fkey";
    columns: ["unidad_id"];
    isOneToOne: false;
    referencedRelation: "unidades";
    referencedColumns: ["id"];
  },
  {
    foreignKeyName: "misiones_creada_por_fkey";
    columns: ["creada_por"];
    isOneToOne: false;
    referencedRelation: "perfiles";
    referencedColumns: ["id"];
  },
  {
    foreignKeyName: "misiones_revisada_por_fkey";
    columns: ["revisada_por"];
    isOneToOne: false;
    referencedRelation: "perfiles";
    referencedColumns: ["id"];
  },
];

type RelacionesDocumentos = [
  {
    foreignKeyName: "documentos_mision_id_fkey";
    columns: ["mision_id"];
    isOneToOne: false;
    referencedRelation: "misiones";
    referencedColumns: ["id"];
  },
  {
    foreignKeyName: "documentos_subido_por_fkey";
    columns: ["subido_por"];
    isOneToOne: false;
    referencedRelation: "perfiles";
    referencedColumns: ["id"];
  },
];

type RelacionesObservaciones = [
  {
    foreignKeyName: "observaciones_mision_id_fkey";
    columns: ["mision_id"];
    isOneToOne: false;
    referencedRelation: "misiones";
    referencedColumns: ["id"];
  },
  {
    foreignKeyName: "observaciones_autor_id_fkey";
    columns: ["autor_id"];
    isOneToOne: false;
    referencedRelation: "perfiles";
    referencedColumns: ["id"];
  },
];

type RelacionesNotificaciones = [
  {
    foreignKeyName: "notificaciones_mision_id_fkey";
    columns: ["mision_id"];
    isOneToOne: false;
    referencedRelation: "misiones";
    referencedColumns: ["id"];
  },
  {
    foreignKeyName: "notificaciones_destinatario_id_fkey";
    columns: ["destinatario_id"];
    isOneToOne: false;
    referencedRelation: "perfiles";
    referencedColumns: ["id"];
  },
];

/** Campos que genera la base y no se envían al insertar. */
type Generados = "id" | "creado_en" | "actualizado_en";

/**
 * Hace opcionales las columnas que admiten NULL: al insertar, omitirlas
 * equivale a dejarlas nulas.
 */
type ConNulosOpcionales<T> = {
  [K in keyof T as null extends T[K] ? never : K]: T[K];
} & {
  [K in keyof T as null extends T[K] ? K : never]?: T[K];
};

export type Database = {
  public: {
    Tables: {
      unidades: {
        Row: FilaUnidad;
        Insert: Omit<FilaUnidad, Generados | "activa"> &
          Partial<Pick<FilaUnidad, "id" | "activa" | "creado_en" | "actualizado_en">>;
        Update: Partial<FilaUnidad>;
        Relationships: [];
      };
      aeronaves: {
        Row: FilaAeronave;
        Insert: Omit<FilaAeronave, Generados | "activa"> &
          Partial<Pick<FilaAeronave, "id" | "activa" | "creado_en" | "actualizado_en">>;
        Update: Partial<FilaAeronave>;
        Relationships: RelacionesAeronaves;
      };
      tipos_mision: {
        Row: FilaTipoMision;
        Insert: Omit<FilaTipoMision, Generados | "activo" | "orden"> &
          Partial<Pick<FilaTipoMision, "id" | "activo" | "orden" | "creado_en" | "actualizado_en">>;
        Update: Partial<FilaTipoMision>;
        Relationships: [];
      };
      perfiles: {
        Row: FilaPerfil;
        Insert: Omit<FilaPerfil, "creado_en" | "actualizado_en"> &
          Partial<Pick<FilaPerfil, "creado_en" | "actualizado_en">>;
        Update: Partial<FilaPerfil>;
        Relationships: RelacionesPerfiles;
      };
      misiones: {
        Row: FilaMision;
        // anio, tipo_mision y aeronave_matricula los completa un trigger.
        Insert: ConNulosOpcionales<
          Omit<
            FilaMision,
            | Generados
            | "anio"
            | "tipo_mision"
            | "aeronave_matricula"
            | "estado"
            | "enviada_en"
            | "revisada_por"
            | "revisada_en"
            | "aprobada_en"
            | "motivo_anulacion"
            | "anulada_por"
            | "anulada_en"
          >
        > &
          Partial<
            Pick<
              FilaMision,
              "id" | "estado" | "anio" | "tipo_mision" | "aeronave_matricula" | "creado_en"
            >
          >;
        Update: Partial<FilaMision>;
        Relationships: RelacionesMisiones;
      };
      documentos: {
        Row: FilaDocumento;
        Insert: Omit<FilaDocumento, "id" | "creado_en" | "version" | "vigente" | "reemplazado_en"> &
          Partial<Pick<FilaDocumento, "id" | "version" | "vigente" | "reemplazado_en" | "creado_en">>;
        Update: Partial<FilaDocumento>;
        Relationships: RelacionesDocumentos;
      };
      observaciones: {
        Row: FilaObservacion;
        Insert: Omit<
          FilaObservacion,
          "id" | "creado_en" | "resuelta" | "resuelta_en" | "resuelta_por"
        > &
          Partial<
            Pick<FilaObservacion, "id" | "resuelta" | "resuelta_en" | "resuelta_por" | "creado_en">
          >;
        Update: Partial<FilaObservacion>;
        Relationships: RelacionesObservaciones;
      };
      auditoria: {
        // La bitácora solo la escriben los triggers: no hay GRANT de insert ni
        // política que lo permita desde la API.
        Row: FilaAuditoria;
        Insert: Omit<FilaAuditoria, "id" | "creado_en">;
        Update: Partial<FilaAuditoria>;
        Relationships: [];
      };
      notificaciones: {
        Row: FilaNotificacion;
        Insert: Omit<FilaNotificacion, "id" | "creado_en" | "leida" | "leida_en"> &
          Partial<Pick<FilaNotificacion, "id" | "leida" | "leida_en">>;
        Update: Partial<Pick<FilaNotificacion, "leida" | "leida_en">>;
        Relationships: RelacionesNotificaciones;
      };
      intentos_ingreso: {
        Row: FilaIntentoIngreso;
        Insert: Omit<FilaIntentoIngreso, "id" | "creado_en">;
        Update: Partial<FilaIntentoIngreso>;
        Relationships: [];
      };
    };
    Views: {
      misiones_con_completitud: {
        Row: FilaMision & { archivos_vigentes: number; completa: boolean };
        Relationships: RelacionesMisiones;
      };
      directorio: {
        Row: { id: string; nombre_completo: string; grado: string | null };
        Relationships: [];
      };
    };
    Functions: {
      contar_archivos_vigentes: {
        Args: { p_mision_id: string };
        Returns: number;
      };
      mision_completa: {
        Args: { p_mision_id: string };
        Returns: boolean;
      };
      puede_editar_mision: {
        Args: { p_mision_id: string };
        Returns: boolean;
      };
      ingreso_bloqueado: {
        Args: { p_correo: string | null; p_ip: string | null };
        Returns: boolean;
      };
      registrar_intento_ingreso: {
        Args: { p_correo: string | null; p_ip: string | null; p_exitoso: boolean };
        Returns: undefined;
      };
      registrar_evento_autenticacion: {
        Args: {
          p_accion: AccionAuditoria;
          p_actor_id: string | null;
          p_actor_email: string | null;
          p_ip?: string | null;
          p_user_agent?: string | null;
          p_detalle?: Json | null;
        };
        Returns: undefined;
      };
      ruta_de_mision_editable: {
        Args: { p_ruta: string };
        Returns: boolean;
      };
    };
    Enums: {
      rol_usuario: RolUsuario;
      estado_mision: EstadoMision;
      tipo_documento: TipoDocumento;
      accion_auditoria: AccionAuditoria;
      tipo_notificacion: TipoNotificacion;
    };
    CompositeTypes: Record<string, never>;
  };
};
