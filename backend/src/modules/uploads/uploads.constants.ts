/** Formatos aceitos. Vão assinados no upload: o Cloudinary recusa o resto. */
export const ALLOWED_IMAGE_FORMATS = ['jpg', 'png', 'webp'] as const;

export type AllowedImageFormat = (typeof ALLOWED_IMAGE_FORMATS)[number];

/**
 * O `.jpeg` que o celular gera e o mesmo formato que o Cloudinary devolve
 * como `jpg`. Aceitar os dois nomes na conferência evita recusar foto boa.
 */
export const FORMAT_ALIASES: Readonly<Record<string, AllowedImageFormat>> = { jpeg: 'jpg' };

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Maior lado da imagem guardada. Foto de celular passa disso com folga. */
export const MAX_IMAGE_SIDE = 2000;

/**
 * Transformação de entrada: aplicada antes de guardar, não na entrega.
 * `c_limit` só reduz — imagem menor que o teto fica como esta, sem ampliar.
 */
export const INCOMING_TRANSFORMATION = `c_limit,w_${MAX_IMAGE_SIDE},h_${MAX_IMAGE_SIDE}`;

/**
 * Validade da assinatura. Uma hora não e escolha nossa: o Cloudinary recusa
 * qualquer assinatura cujo `timestamp` tenha mais que isso.
 */
export const SIGNATURE_TTL_SECONDS = 3600;

/**
 * Larguras de entrega por contexto. O `w_` correspondente entra na URL, e o
 * Cloudinary gera e guarda em cache aquela versão na primeira visita.
 *
 * `wide` existe por causa do banner da home, que ocupa a largura inteira da
 * tela: com teto de 1200 a arte de 1920 era reduzida na entrega e esticada de
 * volta pelo navegador, e chegava mole no monitor. Nenhuma outra tela da loja
 * pede essa largura — card e miniatura continuam escolhendo a menor que
 * couber, porque quem decide e o `sizes` de cada `<img>`, não esta lista.
 *
 * O teto de `MAX_IMAGE_SIDE` (2000) fica acima dela de propósito: `c_limit`
 * só reduz, então arte menor que 1920 não e ampliada — ela e servida no
 * tamanho que tem.
 */
export const IMAGE_WIDTHS = { thumb: 400, card: 600, detail: 1200, wide: 1920 } as const;

export type ImagePreset = keyof typeof IMAGE_WIDTHS;

export const IMAGE_PRESETS = Object.keys(IMAGE_WIDTHS) as ImagePreset[];

export const CLOUDINARY_NOT_CONFIGURED_MESSAGE =
  'O envio de imagens ainda não foi configurado. Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET.';

export const CLOUDINARY_UNREACHABLE_MESSAGE =
  'Não foi possível falar com o serviço de imagens agora. Tente novamente em instantes.';
