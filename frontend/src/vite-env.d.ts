/// <reference types="vite/client" />

/**
 * O que o Vite injeta no bundle.
 *
 * Declarado aqui, e nao inferido: `import.meta.env` e `any` por padrao, e um
 * `VITE_API_ULR` com erro de digitacao viraria `undefined` silencioso. Quem
 * le estes valores e `lib/env.ts`, que ainda os valida no boot — a declaracao
 * pega o erro de digitacao, e o Zod pega o valor ausente ou malformado.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** CSS Modules: `styles.productCard` tipado como string, e nao como `any`. */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
