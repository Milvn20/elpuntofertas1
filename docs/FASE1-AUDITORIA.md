# Fase 1 — Auditoría Elpuntofertas

## Stack
React 19, TanStack Start/Router, Vite, Tailwind 4, Supabase (actual), Firebase (capa añadida).

## Persistencia de productos
- Los productos viven en **Supabase** (`products`, `product_images`) hasta migrar datos a Firestore.
- **No** se usan arrays mock en el frontend; un catálogo vacío suele ser error de consulta o productos `is_active = false`.

## Causas detectadas de catálogo vacío
1. Consultas sin manejo de `error` (corregido en `src/lib/data/catalog.ts` y rutas home/catálogo).
2. Variables servidor faltantes: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SIGNUP_CODE`.
3. Rutas `/` y `/catalogo` habían sido reemplazadas por placeholders (restauradas).

## Admin
- `redeemAdminCode` requiere service role + `ADMIN_SIGNUP_CODE` en servidor.
- En Firebase: usar custom claim `admin` y `npm run firebase:set-admin`.

## Seguridad
- `.env` excluido en `.gitignore`.
- Reglas Firestore/Storage en `firebase/`.

## Siguiente paso
Completar migración de datos (script `migrate:supabase-to-firebase`) y mover admin a Firestore.
