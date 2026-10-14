# Elpuntofertas

Tienda online chilena de bicicletas, zapatillas, ropa, camas, tecnología, perfumes y otros productos. El catálogo público, la autenticación y los pedidos usan **Firebase** cuando las variables de entorno están completas. Supabase queda solo como origen de migración: no se borra desde este proyecto.

## Tecnologías

- React 19, TanStack Start y TanStack Router
- Vite 8 y Tailwind CSS 4
- Firebase Authentication, Cloud Firestore y Firebase Storage
- Firebase Admin SDK en el servidor para pedidos, roles y auditoría
- Vitest para la lógica de carrito, precios y validación

## Requisitos

- Node.js 22 o superior
- Un proyecto de Firebase
- Cuenta de servicio de Firebase solo en el servidor, nunca en el navegador

## Instalación

```powershell
npm install
copy .env.example .env
npm run dev
```

La aplicación arranca con Vite. Si no existe `.env`, el catálogo muestra un error de configuración y no un listado vacío.

## Variables de entorno

Copia `.env.example`. Los valores `VITE_*` son públicos y solo admiten la configuración web de Firebase.

| Variable | Dónde | Uso |
| --- | --- | --- |
| `VITE_DATA_BACKEND` | público | `firebase` |
| `VITE_FIREBASE_API_KEY` | público | Configuración web |
| `VITE_FIREBASE_AUTH_DOMAIN` | público | Configuración web |
| `VITE_FIREBASE_PROJECT_ID` | público | Configuración web |
| `VITE_FIREBASE_STORAGE_BUCKET` | público | Configuración web |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | público | Configuración web |
| `VITE_FIREBASE_APP_ID` | público | Configuración web |
| `VITE_FIREBASE_APPCHECK_SITE_KEY` | público | Opcional. Activa App Check si existe |
| `VITE_FIREBASE_USE_EMULATORS` | público | `true` solo con emuladores locales |
| `FIREBASE_PROJECT_ID` | servidor | Admin SDK |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | servidor | JSON de la cuenta de servicio, en una sola línea |
| `GOOGLE_APPLICATION_CREDENTIALS` | máquina local | Ruta al JSON. No lo subas a Git |
| `ADMIN_ACCESS_CODE` | servidor | Código opcional para el primer canje de admin. No uses `VITE_` |

Las variables de Supabase solo hacen falta para el script de migración.

## Firebase Console

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Authentication → Correo/Contraseña → Activar.
3. Firestore → crear base de datos en modo producción. Región sugerida: `southamerica-east1` si está disponible.
4. Storage → comenzar, en la misma región.
5. Configuración del proyecto → app web → copiar la configuración a `.env`.
6. Desplegar reglas e índices:

```powershell
npx firebase-tools login
npx firebase-tools use TU_PROJECT_ID
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
```

Los archivos están en `firebase/firestore.rules`, `firebase/storage.rules` y `firestore.indexes.json`.

App Check es opcional. Si creas una app web con reCAPTCHA v3, pon la clave de sitio en `VITE_FIREBASE_APPCHECK_SITE_KEY`. No sustituye a Authentication ni a las reglas. Las reglas de este repositorio no exigen App Check, para no bloquear la tienda antes de configurarlo.

## Primer administrador

El rol admin es un custom claim. El documento `users/{uid}` no concede permisos.

1. Regístrate en `/auth`.
2. En tu máquina, con la cuenta de servicio fuera del repositorio:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\service-account.json"
$env:FIREBASE_PROJECT_ID="tu-proyecto"
npm run firebase:set-admin -- tu@email.com
```

3. Cierra sesión y vuelve a entrar para refrescar el token.

También puedes, una sola vez, escribir el mismo secreto en `ADMIN_ACCESS_CODE` y usarlo en el campo «Código admin» al crear la cuenta. El servidor compara el código y asigna el claim. No pongas ese código en el frontend.

## Catálogo y administración

- El catálogo público lee productos con `active == true`.
- Un error de red o de permisos muestra un mensaje y un reintento. No se presenta como catálogo vacío.
- `/admin` permite productos, categorías, pedidos, actividad y usuarios.
- Desactivar un producto lo oculta del catálogo y lo conserva en Firestore.
- No se puede eliminar una categoría que todavía tiene productos. Se puede ocultar.
- Al renombrar una categoría se actualizan `categoryName` y `categorySlug` de sus productos.
- El precio anterior solo se guarda si es mayor que el precio actual. El descuento se calcula a partir de esos dos números.

## Carrito y pedidos

El carrito del visitante vive en `localStorage` (`elpuntofertas.cart.v1`). No es la fuente de precios ni de stock.

Al registrar un pedido, la función de servidor `createOrder`:

1. Vuelve a leer cada producto en Firestore con el Admin SDK.
2. Rechaza productos inactivos, cantidades inválidas, precios distintos a los mostrados o stock insuficiente.
3. Calcula subtotal y total en el servidor.
4. Guarda el pedido con estado `pending` y `paymentStatus: unpaid`.
5. No descuenta stock. El inventario se reserva o descuenta solo cuando definas esa política en la operación de la tienda.
6. No cobra. El pago queda para una integración futura de Mercado Pago o Webpay.

Retiro: despacho 0. Despacho desde $20.000: costo 0, según el aviso que ya existía en el sitio. Bajo ese monto el costo de despacho no se inventa: queda por confirmar en WhatsApp y no entra en el total.

## Migración desde Supabase

No se ejecutó contra datos reales en este entorno: no hay `.env` ni credenciales. El script está listo y es idempotente. No borra Supabase.

```powershell
$env:SUPABASE_URL="https://TU_PROYECTO.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="..."
$env:FIREBASE_PROJECT_ID="tu-proyecto"
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\service-account.json"
npm run migrate:supabase-to-firebase
```

El script guarda `backups/supabase-*.json` y `backups/migration-report-*.json`. Esas carpetas están en `.gitignore`.

Comprueba en el informe las cantidades leídas, escritas, omitidas y fallidas. Conserva el respaldo. Para volver atrás, no borres el proyecto Supabase y restaura desde ese JSON si hace falta volver a cargar Firestore.

Las contraseñas de Supabase Auth no se migran. Cada cliente debe crear de nuevo su cuenta o usar la recuperación de contraseña de Firebase.

Las imágenes que ya estén en URLs de Supabase Storage seguirán usándose mientras esas URLs respondan. El script no las copia a Firebase Storage. Las imágenes nuevas del panel sí se suben a Storage.

## Pruebas

```powershell
npm test
npm run build
```

Emuladores, cuando tengas Firebase CLI y `VITE_FIREBASE_USE_EMULATORS=true`:

```powershell
npx firebase-tools emulators:start
npm run dev
```

Puertos: Auth 9099, Firestore 8080, Storage 9199, UI 4000.

## Despliegue

El build de producción usa Nitro con destino Cloudflare, la configuración que ya traía el proyecto Lovable:

```powershell
npm run build
```

En el hosting debes definir las mismas variables. `FIREBASE_SERVICE_ACCOUNT_JSON` solo en el entorno del servidor. Sin esa credencial, el catálogo puede leerse con las reglas públicas, pero registrar pedidos, cambiar estados y asignar administradores no funciona.

## Qué está implementado y qué falta

Implementado en código: Firebase como backend preferido, servicios de catálogo y admin, autenticación, carrito, registro de pedidos en servidor, panel, reglas, índices, script de migración y pruebas de la lógica de precios.

Pendiente de tu configuración y de una ejecución real:

- Crear el proyecto Firebase y completar `.env`.
- Desplegar reglas e índices.
- Ejecutar y revisar la migración.
- Crear el primer administrador.
- Probar el catálogo con productos reales.
- App Check en la consola, si quieres exigirlo después en las reglas.
- Pasarela de pago. No está simulada.
- Copia física de las imágenes de Supabase Storage a Firebase Storage.
- Retirar la dependencia `@supabase/supabase-js` solo después de verificar la migración. Hoy sigue en el proyecto para el script y el respaldo.

## Costos y límites

Revisa en Firebase el plan Blaze si usas Storage, Admin SDK fuera de los emuladores, o superas la cuota gratuita de Firestore, Authentication y Storage. Las lecturas del catálogo crecen con cada visita; el listado público no pagina en el servidor, pagina en el navegador después de leer los productos activos. Si el inventario crece mucho, conviene pasar a cursores de Firestore.

## Seguridad residual

Las reglas impiden que un visitante modifique productos, pedidos o auditoría. El claim `admin` solo lo asigna el Admin SDK. Aun así, la aplicación no es invulnerable: hace falta desplegar las reglas, proteger la cuenta de servicio, activar App Check si hay abuso, y revisar `npm audit`. Hay avisos de dependencias transitivas; no se aplicó `npm audit fix --force` porque puede romper Vite, Nitro o Firebase.
