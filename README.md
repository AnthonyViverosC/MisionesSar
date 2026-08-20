# MISIONES SAR

Archivo digital de las misiones de búsqueda y rescate de una unidad aérea.
Centraliza por número de misión los seis soportes obligatorios —ocho archivos— y
añade un flujo de revisión y aprobación con trazabilidad completa.

| Soporte | Formato | Cantidad |
|---|---|---|
| Orden de vuelo | PDF | 1 |
| Orden fragmentaria | PDF | 1 |
| Requerimiento de misión | PDF | 1 |
| Formulario de misión cumplida | PDF | 1 |
| Certificado de consumo | PDF | 1 |
| Archivo fílmico | JPG/PNG + MP4 | 2 fotos y 1 video |

Una misión no se envía a revisión mientras le falte alguno. Nada se borra: las
misiones se anulan con motivo y los documentos reemplazados suben de versión.

## Stack

- **Next.js 16** (App Router) con TypeScript y React Server Components
- **Supabase**: Postgres, Auth, Storage y Row Level Security
- **Tailwind CSS 4** y **shadcn/ui**
- **Zod** para validación en cliente y servidor, **React Hook Form** en los formularios
- **Vitest** para las pruebas
- Despliegue en **Vercel**

## Requisitos

- Node.js 20 o superior (probado con 24)
- pnpm 10
- Un proyecto de Supabase (el plan gratuito basta para desarrollo)

## Instalación local

```bash
pnpm install
cp .env.example .env.local     # y completa los valores
```

### Variables de entorno

Todas están documentadas en `.env.example`. Las imprescindibles:

| Variable | De dónde sale | Se expone al navegador |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Panel → Settings → API | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Panel → Settings → API | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Panel → Settings → API | **No, nunca** |
| `SUPABASE_DB_PASSWORD` | Panel → Settings → Database | No |
| `SUPABASE_PROJECT_REF` | La parte variable de la URL del proyecto | No |
| `NEXT_PUBLIC_URL_APLICACION` | `http://localhost:3000` en local | Sí |

La clave de servicio salta todas las políticas de RLS. Solo se usa en el
servidor, desde `src/lib/supabase/servicio.ts`, que importa `server-only`: si
alguien la arrastrara a un componente de cliente, la compilación falla.

### Base de datos

```bash
pnpm db:aplicar     # aplica todas las migraciones por conexión directa
pnpm db:estado      # diagnóstico: qué hay realmente aplicado
pnpm db:seed        # datos de prueba (opcional)
```

`db:aplicar` usa `SUPABASE_PROJECT_REF` y `SUPABASE_DB_PASSWORD`, aplica cada
migración dentro de una transacción y las registra en
`supabase_migrations.schema_migrations`, la misma tabla que usa el CLI oficial.
Se prefiere al CLI porque `supabase db push` exige `supabase login` con un token
personal, que en una máquina de desarrollo no siempre está a mano. Si prefieres
el CLI, `pnpm db:push` sigue disponible tras enlazar el proyecto.

Para rehacer el esquema desde cero en desarrollo (**borra todos los datos**):

```bash
node supabase/herramientas/aplicar-migraciones.mjs --reiniciar
```

> La conexión directa a Postgres de los proyectos nuevos de Supabase es
> IPv6. Si tu red no tiene IPv6, usa la cadena del *connection pooler* que
> aparece en Settings → Database.

Las migraciones viven en `supabase/migrations` y se aplican en orden. **No
configures nada a mano desde el panel de Supabase**: si un cambio no está en una
migración, se pierde en el siguiente despliegue.

Orden de las migraciones:

1. `tipos_y_extensiones` — enums y utilidades
2. `catalogos` — unidades, aeronaves, tipos de misión
3. `perfiles` — perfiles y funciones `public.rol_actual()` / `public.unidad_actual()`
4. `misiones` — expediente y coherencia con los catálogos
5. `documentos` — versionado y completitud
6. `observaciones_notificaciones`
7. `auditoria` — bitácora inmutable y control de intentos de ingreso
8. `reglas_estado` — grafo de estados e inmutabilidad
9. `rls` — todas las políticas, una por operación
10. `almacenamiento` — buckets privados y sus políticas

### Ejecutar

```bash
pnpm dev        # http://localhost:3000
pnpm build      # compilación de producción
pnpm test       # pruebas
pnpm typecheck  # tipos
pnpm lint       # estilo
```

## Cuentas de prueba

`pnpm db:seed` crea cinco cuentas con la contraseña de `PRUEBAS_CLAVE_USUARIOS`
(por defecto `Sar.Pruebas.2026!`):

| Correo | Rol | Unidad |
|---|---|---|
| `admin@sar.mil.co` | Administrador | — |
| `operador@sar.mil.co` | Operador | VII Brigada Aérea |
| `supervisor@sar.mil.co` | Supervisor | VII Brigada Aérea |
| `consulta@sar.mil.co` | Consulta | — |
| `operador.sur@sar.mil.co` | Operador | Grupo Aéreo del Sur |

La última existe para comprobar que un operador no ve misiones de otra unidad.
La verificación en dos pasos es voluntaria: cada usuario la activa desde su
perfil. Para volver a exigirla a un rol, añádelo a `ROLES_CON_MFA_OBLIGATORIO`
en `src/dominio/roles.ts`; el flujo completo ya está implementado.

## Crear el primer administrador en producción

No hay registro público. El primer admin se crea una sola vez desde el panel de
Supabase:

1. **Authentication → Users → Add user**, con correo institucional y "Auto
   confirm user" activado.
2. En **SQL Editor**, asigna el rol al perfil que creó el trigger:

   ```sql
   update public.perfiles
   set rol = 'admin',
       nombre_completo = 'Nombre y apellidos',
       documento_identidad = '00000000',
       debe_cambiar_clave = true
   where id = (select id from auth.users where email = 'admin@tu-dominio.mil');
   ```

3. Entra con esa cuenta: la aplicación exigirá cambiar la contraseña y aceptar
   el aviso de uso. Desde ahí se invita al resto.

## Despliegue en Vercel

1. Sube el repositorio a GitHub e impórtalo en Vercel.
2. Configura las variables de entorno del proyecto (las mismas de `.env.local`,
   con `NEXT_PUBLIC_URL_APLICACION` apuntando al dominio real).
3. En Supabase, **Authentication → URL Configuration**, agrega el dominio de
   Vercel a *Site URL* y a *Redirect URLs*, incluyendo `/auth/callback`.
4. Aplica las migraciones contra el proyecto de producción con `pnpm db:push`.
5. Configura el SMTP institucional en **Authentication → Emails**: el proveedor
   por defecto de Supabase tiene un límite bajo y no sirve para operación real.

## Respaldos y recuperación

Activa **Point-in-Time Recovery** en el panel del proyecto (Database → Backups).
El procedimiento de restauración está documentado en
[`docs/decisiones-tecnicas.md`](docs/decisiones-tecnicas.md).

## Organización del repositorio

```
src/
  acciones/       Server Actions (toda mutación pasa por aquí)
  app/
    (publico)/    login, recuperación, invitación
    (tramite)/    primer ingreso, verificación e inscripción de MFA
    (app)/        aplicación con sesión: tablero, misiones, revisión, admin
    auth/         retorno de los enlaces por correo y cierre de sesión
  components/     interfaz; `ui/` son los componentes base de shadcn
  config/         identidad de la unidad (escudo y nombres)
  dominio/        reglas del negocio: roles, estados y soportes
  lib/            Supabase, sesión, seguridad y utilidades
  tipos/          tipos del esquema de la base
supabase/
  migrations/     esquema, funciones, triggers y políticas de RLS
  seed/           semilla de desarrollo
pruebas/
  unitarias/      reglas de estado sin base de datos
  integracion/    políticas de RLS y triggers contra el proyecto real
```

Todo el código y los comentarios están en español. Las pruebas de integración se
saltan solas si no hay credenciales configuradas.
