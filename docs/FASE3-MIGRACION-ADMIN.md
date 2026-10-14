# Fase 3 — Auth y panel admin (Firebase + fallback Supabase)

## Auth unificada
- `src/lib/auth/client.ts`: registro, login, logout, recuperación de contraseña.
- Con **Firebase** activo (`VITE_FIREBASE_*` completas): Firebase Auth + documento `users/{uid}`.
- Sin Firebase: sigue Supabase Auth + tabla `user_roles`.

## Admin
- CRUD productos/categorías: `src/lib/data/admin.ts` (Firestore o Supabase).
- Server functions: `src/lib/admin.functions.ts` con middleware `requireAuth`.
- Código admin: variable servidor `ADMIN_ACCESS_CODE` o `ADMIN_SIGNUP_CODE` → custom claim `admin: true` (Firebase) o fila en `user_roles` (Supabase).

## Primer administrador (Firebase)
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS=".\service-account.json"
npm run firebase:set-admin -- admin@tudominio.com
```

## Migración de datos
```powershell
$env:SUPABASE_SERVICE_ROLE_KEY="..."
$env:GOOGLE_APPLICATION_CREDENTIALS=".\service-account.json"
npm run migrate:supabase-to-firebase
```

## Despliegue de reglas
```bash
firebase deploy --only firestore:rules,storage
```

## Índices Firestore recomendados
- `products`: `active` + `createdAt`, `active` + `featured`, `active` + `categorySlug`, `slug` + `active`
- `categories`: `displayOrder`
