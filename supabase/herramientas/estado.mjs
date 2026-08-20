import { conectar } from "./conexion.mjs";

/**
 * Diagnóstico del esquema.
 *
 *   node supabase/herramientas/estado.mjs
 *
 * Muestra qué hay realmente aplicado en la base: tablas, enums, funciones,
 * políticas, triggers, buckets y migraciones registradas. Sirve para saber en
 * qué punto quedó un despliegue a medias.
 */
const cliente = await conectar();

const consulta = async (sql) => (await cliente.query(sql)).rows;

const tablas = await consulta(
  `select table_name from information_schema.tables
   where table_schema = 'public' order by table_name`,
);

const enums = await consulta(
  `select typname from pg_type t
   join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public' and t.typtype = 'e' order by typname`,
);

const funciones = await consulta(
  `select n.nspname || '.' || p.proname as nombre from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'auth')
     and p.proname in ('rol_actual','unidad_actual','tiene_rol','mision_completa',
       'contar_archivos_vigentes','auditar','validar_transicion_estado','puede_editar_mision',
       'ingreso_bloqueado','registrar_evento_autenticacion')
   order by 1`,
);

const politicas = await consulta(
  `select tablename, count(*)::int as total from pg_policies
   where schemaname = 'public' group by tablename order by tablename`,
);

const triggers = await consulta(
  `select event_object_table as tabla, trigger_name as nombre
   from information_schema.triggers
   where trigger_schema = 'public'
   group by 1, 2 order by 1, 2`,
);

const rls = await consulta(
  `select relname, relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' order by relname`,
);

const buckets = await consulta(`select id, public from storage.buckets order by id`);

const migraciones = await consulta(
  `select version from supabase_migrations.schema_migrations order by version`,
).catch(() => []);

const filas = async (tabla) => {
  try {
    const resultado = await cliente.query(`select count(*)::int as total from public.${tabla}`);
    return resultado.rows[0].total;
  } catch {
    return "—";
  }
};

console.log("\n== Esquema ==");
console.log("Tablas:", tablas.map((f) => f.table_name).join(", ") || "(ninguna)");
console.log("Enums:", enums.map((f) => f.typname).join(", ") || "(ninguno)");
console.log("Funciones clave:", funciones.map((f) => f.nombre).join(", ") || "(ninguna)");

console.log("\n== Seguridad ==");
console.log(
  "RLS activo:",
  rls
    .map((f) => `${f.relname}${f.relrowsecurity ? "" : " (SIN RLS)"}`)
    .join(", ") || "(sin tablas)",
);
console.log(
  "Políticas:",
  politicas.map((f) => `${f.tablename}=${f.total}`).join(", ") || "(ninguna)",
);
console.log("Triggers:", triggers.length);
console.log(
  "Buckets:",
  buckets.map((f) => `${f.id} (${f.public ? "PÚBLICO" : "privado"})`).join(", ") || "(ninguno)",
);

console.log("\n== Datos ==");
for (const tabla of ["unidades", "aeronaves", "tipos_mision", "perfiles", "misiones", "documentos", "auditoria"]) {
  console.log(`${tabla}:`, await filas(tabla));
}

console.log("\n== Migraciones registradas ==");
console.log(migraciones.map((f) => f.version).join(", ") || "(ninguna)");

await cliente.end();
