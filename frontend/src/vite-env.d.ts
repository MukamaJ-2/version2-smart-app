/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Set at build time in vite.config (e.g. Railway’s RAILWAY_GIT_COMMIT_SHA). Empty string locally if unset. */
declare const __GIT_COMMIT__: string;
