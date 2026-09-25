# Lencord

Plataforma peer-to-peer (P2P) de préstamos colectivos orientada a PyMEs argentinas.

## Visión General

Lencord conecta a pequeñas y medianas empresas argentinas en crecimiento con inversores que buscan retornos reales, mediante un mecanismo de subasta "todo o nada" ágil, transparente y seguro.

- **Modelo de negocio:** préstamos colectivos directos (P2P lending) bajo marco de mutuo y pagaré digital con firma electrónica.
- **Evaluación crediticia:** integración con la Central de Deudores del BCRA (y otras APIs externas) y categorización por niveles de riesgo (Tier A, Tier B, Tier C).
- **Esquemas de tasa:** tasa fija (TNA) para corto plazo (30, 60 y 90 días) y UVA/CER + spread para mediano plazo (6 y 12 meses).
- **Arquitectura técnica:** Next.js (App Router), TypeScript, Tailwind CSS / Vanilla CSS tokens, Supabase (PostgreSQL + RLS + RPC).

## Documentación

- [Especificación Técnica y Funcional (plan.md)](_docs/plan.md)
- [Backlog de Tareas (tasks.md)](_docs/tasks.md)
