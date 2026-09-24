/// <reference types="vite/client" />

/**
 * O que o Vite injeta no bundle.
 *
 * Declarado aqui, e não inferido: `import.meta.env` e `any` por padrão, e um
 * `VITE_API_ULR` com erro de digitação viraria `undefined` silencioso. Quem
 * lê estes valores e `lib/env.ts`, que ainda os valida no boot — a declaração
 * pega o erro de digitação, e o Zod pega o valor ausente ou malformado.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** CSS Modules: `styles.productCard` tipado como string, e não como `any`. */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
