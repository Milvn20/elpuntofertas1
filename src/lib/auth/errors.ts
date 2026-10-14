export function authErrorMessage(err: unknown): string {
  if (err instanceof TypeError && String(err.message).includes("fetch")) {
    return "No hay conexión con el servidor de autenticación. Revisa tu internet, las variables VITE_SUPABASE_* o VITE_FIREBASE_* y que el proyecto en la nube esté activo.";
  }
  const e = err as { code?: string; message?: string };
  if (e?.code) return firebaseAuthMessage(e.code);
  if (e?.message?.includes("Failed to fetch") || e?.message?.includes("auth/network-request-failed")) {
    return "No hay conexión con Firebase. Revisa tu internet y que Authentication con correo esté activo en el proyecto.";
  }
  return e?.message ?? "No se pudo completar la autenticación.";
}

export function firebaseAuthMessage(code: string): string {
  const map: Record<string, string> = {
    "auth/email-already-in-use": "Este correo ya está registrado.",
    "auth/invalid-email": "Correo electrónico inválido.",
    "auth/weak-password": "La contraseña debe tener al menos 8 caracteres.",
    "auth/user-not-found": "No existe una cuenta con este correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
  };
  return map[code] ?? "No se pudo completar la autenticación.";
}
