# Decisiones técnicas

Por qué el sistema está construido así, qué se descartó y qué compromisos se
aceptaron. Cuando una decisión cambie, este documento cambia con ella.

## La autorización vive en la base de datos

Todas las reglas de acceso están en políticas de RLS de Postgres
(`supabase/migrations/20260819000900_rls.sql`), una por tabla y por operación.
La aplicación comprueba el rol antes de cada mutación, pero esa comprobación es
comodidad: sirve para dar un mensaje claro, no para proteger el dato.

El motivo es sencillo. Un archivo digital que va a durar años sobrevivirá a esta
interfaz: llegarán scripts de migración, herramientas de reportes, quizá otra
aplicación. Si la frontera estuviera en el código de Next.js, cada cliente nuevo
tendría que reimplementarla y bastaría un olvido para abrir el archivo entero.
En la base, la regla se aplica una vez y vale para cualquier cliente.

La consecuencia práctica: **nunca se añade una regla de acceso solo en la
aplicación**. Si un rol nuevo debe ver algo, se escribe la política y luego, si
hace falta, se ajusta la interfaz.

## Nada se borra

Ninguna tabla del expediente concede `DELETE`, ni siquiera al rol de servicio, y
ninguna tiene política de borrado. Las consecuencias son deliberadas:

- Una misión errónea **se anula con motivo**, y queda visible como anulada.
- Un documento equivocado **se reemplaza**: el nuevo entra como versión vigente y
  el anterior queda marcado como no vigente, con su hash y su fecha.
- Una cuenta que ya no debe entrar **se desactiva**. Su rastro en la bitácora y
  la autoría de sus misiones se conservan.
- Un catálogo que ya no se usa **se desactiva**: deja de ofrecerse en las
  misiones nuevas y las antiguas conservan el dato con el que se ejecutaron.

Un archivo del que se puede borrar no es un archivo.

## La bitácora la escriben los triggers

`public.auditoria` no tiene política de `INSERT`, `UPDATE` ni `DELETE`. Los
registros entran por triggers `SECURITY DEFINER` instalados en las tablas
auditadas, y los eventos que no nacen de una tabla —ingresos, cierres de sesión
y descargas— por una función reservada al rol de servicio, que además solo acepta
ese subconjunto de acciones.

Así, desde la API es imposible escribir en la bitácora, y también es imposible
que una operación quede sin registrar: no depende de que la aplicación se acuerde
de anotarla.

El precio: las acciones que solo puede hacer el rol de servicio (crear la cuenta
al invitar) quedan con actor nulo. Por eso **la invitación va en dos pasos**: Auth
crea la cuenta con el rol más restrictivo y, acto seguido, el administrador le
asigna rol y unidad con su propia sesión. La concesión de privilegios queda
firmada por una persona (ver `src/acciones/administracion.ts`).

## Los archivos nunca son públicos

Los dos buckets son privados. No hay URL pública de ningún soporte: cada descarga
pasa por una URL firmada de cinco minutos que el servidor emite después de
comprobar quién pide qué. Las rutas son `<mision_id>/<tipo>/<uuid>.<ext>`; el
nombre original se guarda aparte, para mostrarlo y para armar el ZIP.

De cada archivo se calcula el SHA-256 y se verifican sus *magic bytes*: el MIME
que declara el navegador y la extensión del nombre no son evidencia de nada.

El expediente completo se descarga en ZIP armado **en streaming**: con videos de
hasta 500 MB, acumular en memoria del servidor sería insostenible.

## Sin verificación en dos pasos

La unidad decidió no usarla. El ingreso es con correo y contraseña, sin segundo
factor para ningún rol. La protección de las cuentas descansa en:

- contraseña de doce caracteres como mínimo, verificada contra la base de
  filtraciones de Have I Been Pwned por k-anonymity (nunca sale la contraseña ni
  su hash completo);
- bloqueo de quince minutos tras cinco intentos fallidos, por cuenta y por IP;
- expiración de la sesión por inactividad, con aviso previo;
- cierre inmediato de la sesión de una cuenta desactivada.

Si la decisión se revisa, el punto de entrada es
`src/lib/supabase/sesion-middleware.ts`, donde ya está el lugar por el que pasa
cada petición autenticada.

## Migraciones por conexión directa

`pnpm db:aplicar` aplica las migraciones por conexión directa a Postgres, cada
una en su transacción, y las registra en `supabase_migrations.schema_migrations`,
la misma tabla que usa el CLI oficial.

Se prefiere al CLI porque `supabase db push` exige `supabase login` con un token
personal, que en una máquina de desarrollo no siempre está a mano. El CLI sigue
disponible (`pnpm db:push`) y las dos vías comparten el registro, así que se
pueden alternar.

**Ningún cambio de esquema se hace desde el panel de Supabase.** Lo que no está
en una migración no existe: se pierde en el siguiente despliegue y no hay forma
de reconstruir el estado.

## Cabeceras y CSP

Las cabeceras estáticas están en `next.config.ts`. La Content-Security-Policy no:
se genera por petición en el proxy con un nonce distinto cada vez, que es lo que
permite prescindir de `unsafe-inline`.

## Respaldos y recuperación

Activa **Point-in-Time Recovery** en el panel del proyecto (Database → Backups).
El plan gratuito solo conserva copias diarias; para operación real hace falta un
plan con PITR.

Procedimiento de restauración:

1. **Detén las escrituras.** En Vercel, pon el proyecto en mantenimiento o retira
   temporalmente las variables de entorno del despliegue de producción. Restaurar
   con usuarios trabajando produce un archivo incoherente.
2. En el panel de Supabase, **Database → Backups → Point in Time**, elige el
   instante anterior al incidente. Supabase restaura sobre el mismo proyecto.
3. Cuando termine, verifica el esquema con `pnpm db:estado`: debe listar las diez
   migraciones aplicadas.
4. Comprueba a mano una misión aprobada reciente: sus datos, sus ocho archivos
   vigentes y su hilo de observaciones.
5. Restablece el acceso y **anota el incidente**: qué se restauró, a qué instante
   y qué se perdió en la ventana.

Ten en cuenta que el almacenamiento de archivos y la base se restauran juntos en
el PITR de Supabase, pero un archivo subido después del punto elegido queda
huérfano: su fila desaparece y el objeto puede quedar en el bucket. No es
peligroso —nada lo referencia—, pero conviene revisarlo tras una restauración.

## Lo que se descartó

- **Un campo de texto para la unidad.** La unidad es la frontera de visibilidad
  de RLS: tiene que ser una clave foránea, no una cadena que alguien escriba
  distinto dos veces.
- **Borrado lógico con `deleted_at`.** Añade una condición que hay que recordar
  en cada consulta y en cada política; olvidarla una vez expone lo borrado. Es
  más seguro no conceder `DELETE` y modelar los cierres como estados.
- **Guardar el correo en `perfiles`.** Ya vive en `auth.users`. Duplicarlo abre
  la puerta a que las dos copias discrepen; cuando la interfaz lo necesita, lo
  pide con la clave de servicio en el momento.
- **Contar archivos en la aplicación.** La completitud se calcula en la base
  (`mision_completa`) y el trigger de envío la exige. Si el conteo viviera en el
  cliente, bastaría una petición armada a mano para enviar una misión incompleta.
