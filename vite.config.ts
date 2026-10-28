// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Fuera de Lovable el despliegue es Netlify. Dentro del sandbox de Lovable el preset vuelve a Cloudflare.
  nitro: {
    preset: "netlify",
    // Sin esto Nitro vuelve a empaquetar firebase-admin y rompe el default export.
    traceDeps: ["firebase-admin*"],
  } as { preset: string },
  vite: {
    ssr: {
      // El wrapper ESM de firebase-admin hace `import mod from "./app"` y lee mod.SDK_VERSION.
      // Vite lo empaqueta como .default.SDK_VERSION, default queda undefined y el pago revienta en Netlify.
      external: ["firebase-admin"],
    },
  },
});
