# Pasar Elpuntofertas de Supabase (pausado) a Firebase

Tu proyecto Supabase en Lovable está **pausado**, por eso el registro falla con *Failed to fetch*. Firebase reemplaza auth, base de datos e imágenes.

## 1. Crear proyecto Firebase

1. Entra a [Firebase Console](https://console.firebase.google.com/).
2. **Crear proyecto** (ej. `elpuntofertas`).
3. Desactiva Google Analytics si no lo necesitas (opcional).

## 2. Authentication

1. **Build → Authentication → Comenzar**.
2. Proveedor **Correo/Contraseña** → Activar.
3. (Opcional) Desactiva “Verificación de correo” en desarrollo para probar más rápido.

## 3. Firestore

1. **Build → Firestore Database → Crear base de datos**.
2. Modo **producción** (luego despliegas reglas del repo).
3. Región cercana (ej. `southamerica-east1` si está disponible).

## 4. Storage

1. **Build → Storage → Comenzar**.
2. Misma región que Firestore.

## 5. Config web (`.env`)

En Firebase: **Configuración del proyecto → Tus apps → Web (`</>`)**.

Copia los valores a tu `.env` (y en Lovable → Environment variables):

```env
VITE_DATA_BACKEND=firebase

VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

FIREBASE_PROJECT_ID=tu-proyecto
ADMIN_ACCESS_CODE=elige_un_codigo_largo_secreto
```

**Opcional:** comenta o elimina las `VITE_SUPABASE_*` para no usar Supabase pausado.

## 6. Reglas de seguridad

Instala Firebase CLI (`npm i -g firebase-tools`), inicia sesión y en la carpeta del proyecto:

```bash
firebase login
firebase use tu-proyecto
firebase deploy --only firestore:rules,storage
```

Las reglas están en `firebase/firestore.rules` y `firebase/storage.rules`.

## 7. Primer administrador

1. Descarga la **cuenta de servicio** (Configuración → Cuentas de servicio → Generar nueva clave JSON).
2. Guarda el archivo fuera del repo (ej. `service-account.json`, ya está en `.gitignore`).
3. Regístrate en `/auth` con tu correo.
4. En terminal:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\service-account.json"
$env:FIREBASE_PROJECT_ID="tu-proyecto"
npm run firebase:set-admin -- tu@email.com
```

5. Cierra sesión y vuelve a entrar (para refrescar el claim `admin`).

Alternativa al registrarte: en el campo **Código admin** usa el mismo valor que `ADMIN_ACCESS_CODE` (solo en servidor, nunca en el frontend público).

## 8. Migrar datos desde Supabase (opcional)

Si **reactivas** Supabase un momento y descargas backup, o tienes `SUPABASE_SERVICE_ROLE_KEY`:

```powershell
$env:SUPABASE_URL="https://....supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="..."
$env:GOOGLE_APPLICATION_CREDENTIALS="...\service-account.json"
npm run migrate:supabase-to-firebase
```

## 9. Probar

```powershell
npm install
npm run dev
```

- Crear cuenta en `/auth`
- Entrar al panel `/admin`
- Crear categorías y productos

## Índices Firestore

Si la consola pide índices al filtrar productos, crea los compuestos que sugiera el enlace del error, o usa `firestore.indexes.json` del repo tras `firebase deploy --only firestore:indexes`.
