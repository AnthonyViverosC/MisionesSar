import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { conectar } from "./conexion.mjs";

/**
 * Aplica las migraciones contra el proyecto remoto.
 *
 *   node supabase/herramientas/aplicar-migraciones.mjs
 *   node supabase/herramientas/aplicar-migraciones.mjs --reiniciar
 *
 * Equivale a `supabase db push`, pero por conexión directa: el CLI exige
 * `supabase login` con un token personal, que en una máquina de desarrollo no
 * siempre está a mano.
 *
 * Cada archivo se aplica dentro de una transacción: o entra completo o no entra,
 * de modo que un fallo no deja el esquema a medias. Al terminar se registra en
 * `supabase_migrations.schema_migrations`, la misma tabla que usa el CLI, para
 * que ambos caminos queden sincronizados.
 *
 * `--reiniciar` borra el esquema y lo reconstruye desde cero. Destruye todos los
 * datos: se usa solo en desarrollo, nunca contra producción.
 */

const DIRECTORIO = "supabase/migrations";
const reiniciar = process.argv.includes("--reiniciar");

const cliente = await conectar();

if (reiniciar) {
  console.log("Reiniciando el esquema…");

  // Objetos que viven fuera de `public` y que crean las migraciones.
  await cliente.query(`
    drop trigger if exists crear_perfil_al_registrar on auth.users;
    drop function if exists auth.rol_actual() cascade;
    drop function if exists auth.unidad_actual() cascade;
    drop function if exists auth.tiene_rol(public.rol_usuario[]) cascade;
    drop policy if exists filmico_insert_reanudable on storage.objects;
  `);

  // El esquema completo, con sus tablas, tipos y funciones.
  await cliente.query(`
    drop schema if exists public cascade;
    create schema public;
    grant all on schema public to postgres;
    grant usage on schema public to anon, authenticated, service_role;
  `);

  await cliente.query(`
    delete from supabase_migrations.schema_migrations
  `).catch(() => {});

  console.log("Esquema reiniciado.\n");
}

await cliente.query(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[],
    name text
  );
`);

const aplicadas = new Set(
  (await cliente.query("select version from supabase_migrations.schema_migrations")).rows.map(
    (fila) => fila.version,
  ),
);

const archivos = (await readdir(DIRECTORIO)).filter((nombre) => nombre.endsWith(".sql")).sort();

let aplicadasAhora = 0;

for (const archivo of archivos) {
  const version = archivo.split("_")[0];

  if (aplicadas.has(version)) {
    console.log(`  ${archivo}: ya estaba aplicada`);
    continue;
  }

  const sql = await readFile(join(DIRECTORIO, archivo), "utf8");
  process.stdout.write(`  ${archivo}… `);

  try {
    await cliente.query("begin");
    await cliente.query(sql);
    await cliente.query(
      "insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)",
      [version, archivo],
    );
    await cliente.query("commit");
    console.log("aplicada");
    aplicadasAhora += 1;
  } catch (error) {
    await cliente.query("rollback");
    console.log("FALLÓ");
    console.error(`\n${error.message}\n`);
    if (error.position) {
      const posicion = Number(error.position);
      console.error("Contexto:", sql.slice(Math.max(0, posicion - 200), posicion + 200));
    }
    await cliente.end();
    process.exit(1);
  }
}

console.log(
  aplicadasAhora === 1
    ? "\n1 migración aplicada."
    : `\n${aplicadasAhora} migraciones aplicadas.`,
);

await cliente.end();
