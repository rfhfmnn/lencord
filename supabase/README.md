# Supabase Database & Migrations - Lencord

Este directorio contiene las definiciones SQL, migraciones y configuración de la base de datos de Supabase para la plataforma Lencord.

Para consultar la **documentación técnica y funcional detallada** (diagrama entidad-relación Mermaid, diccionario completo de tablas, tipos ENUM, procedimientos RPC, matriz RLS, buckets de storage e índices), dirigirse a:

👉 **[Documentación Integral de la Base de Datos (`_docs/database.md`)](../_docs/database.md)**

---

## Contenido del Directorio

- [`setup_cloud_schema.sql`](./setup_cloud_schema.sql): Script consolidado e idempotente que contiene el esquema definitivo para producción, tablas, funciones RPC, políticas RLS, buckets de Storage y el usuario administrador inicial (`admin@lencord.ar`).
- [`migrations/`](./migrations/): Registro secuencial e incremental de las migraciones de base de datos del proyecto.

---

## Guía Rápida de Despliegue

### Opción 1: Supabase Dashboard (Recomendada para ambientes nuevos)
1. Abrir el proyecto en el [Dashboard de Supabase](https://supabase.com/dashboard).
2. Ir a **SQL Editor** -> **New query**.
3. Copiar y pegar el contenido de [`setup_cloud_schema.sql`](./setup_cloud_schema.sql).
4. Hacer clic en **Run**.

### Opción 2: Supabase CLI (Desarrollo local / CI/CD)
```bash
# Iniciar servicios de Supabase en local
npx supabase start

# Aplicar las migraciones incrementales
npx supabase migration up

# O aplicar esquema en proyecto remoto
npx supabase db push
```
