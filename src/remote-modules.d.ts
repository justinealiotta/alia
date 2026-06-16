// Ambient declarations for runtime-only module sources that TypeScript can't
// resolve at build time but the browser loads fine.
//
//  - esm.sh URL imports: the composer loads TipTap from the CDN at runtime
//    (see src/composer/engine.ts). These are real ES modules in the browser
//    but have no local type declarations, so we type them as `any`.
declare module 'https://esm.sh/*';
