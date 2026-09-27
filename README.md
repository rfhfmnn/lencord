# Lencord

Plataforma peer-to-peer (P2P) de préstamos colectivos orientada a PyMEs argentinas.

## Visión General

Lencord conecta a pequeñas y medianas empresas argentinas en crecimiento con inversores que buscan retornos reales, mediante un mecanismo de subasta "todo o nada" ágil, transparente y seguro.

- **Modelo de negocio:** préstamos colectivos directos (P2P lending) bajo marco de mutuo y pagaré digital con firma electrónica.
- **Evaluación crediticia:** integración con la Central de Deudores del BCRA (y otras APIs externas) y categorización por niveles de riesgo (Tier A, Tier B, Tier C).
- **Esquemas de tasa:** tasa fija (TNA) para corto plazo (30, 60 y 90 días) y UVA/CER + spread para mediano plazo (6 y 12 meses).
- **Arquitectura técnica:** Next.js (App Router), TypeScript, Tailwind CSS / Vanilla CSS tokens, Supabase (PostgreSQL + RLS + RPC), Vitest.

## Estado del Proyecto

- **Fase 1 (MVP Core):** Completada al 100% con pruebas unitarias, de integración y flujo E2E verificadas.
- **Fase 2 (Expansión & Escalamiento):** Especificada y mapeada en el backlog de GitHub Issues (`#24`–`#51`).

## Comandos y Desarrollo

### Requisitos Previos

- Node.js 18+ (recomendado Node 20 LTS o superior)
- npm

### Comandos Principales

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo local (http://localhost:3000)
npm run dev

# Ejecutar la suite completa de pruebas (Vitest)
npm run test

# Ejecutar un archivo de test específico
npx vitest run tests/components/HeroSimulator.test.tsx

# Type-checking de TypeScript y build de producción
npm run build

# Aprovisionar rol de administrador (CLI)
npm run seed:admin -- admin@lencord.ar
```

### Aprovisionamiento Inicial de Administrador

Para promover una cuenta de usuario existente al rol de administrador (`admin`):

```bash
# Asignación directa especificando el email del usuario registrado
npm run seed:admin -- <email>

# O mediante prompt interactivo en la terminal
npm run seed:admin
```

> **Nota de Seguridad**: Este comando opera exclusivamente a nivel de base de datos del servidor y requiere que la clave institucional `SUPABASE_SERVICE_ROLE_KEY` esté configurada en el entorno o en el archivo `.env.local`. Nunca exponga dicha credencial en paquetes del cliente.

## Documentación

### Especificaciones y Backlog
- [Especificación Técnica y Funcional - Fase 1](_docs/plan.md)
- [Backlog de Tareas - Fase 1](_docs/tasks.md)
- [Plan y Arquitectura de Expansión - Fase 2](_docs/next_plan.md)
- [Backlog de Tareas y GitHub Issues - Fase 2](_docs/next_tasks.md)

### Lineamientos y Proceso
- [Flujo de Trabajo y Ciclo de Issues](_docs/process.md)
- [Guía de Pruebas Automatizadas](_docs/testing-guidelines.md)
- [Sistema de Diseño e Interfaz](_docs/design-system.md)
- [Roles de Equipo](_docs/team/pm.md) (`pm.md`, `software-engineer.md`, `qa-engineer.md`)

### Manuales del Sistema
- [Manual Técnico (PDF)](Manual_Tecnico_Lencord.pdf)
- [Manual de Administrador (PDF)](Manual_Administrador_Lencord.pdf)
- [Manual de Usuario (PDF)](Manual_Usuario_Lencord.pdf)
- [Manual de Marco Legal y Habilitación (PDF)](Manual_Marco_Legal_Lencord.pdf)

