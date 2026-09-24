import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { INSTITUTIONAL_PAGE_SLUG_VALUES } from '../../../common/enums/institutional-page.js';
import type { InstitutionalPageSlug } from '../../../common/enums/institutional-page.js';
import { MAX_PAGE_CONTENT_LENGTH } from '../settings.constants.js';

/**
 * Uma página institucional no PATCH.
 *
 * Diferente dos banners, aqui o array não substitui nada: cada item e
 * encontrado pelo `slug` e atualizado no lugar, e a página que não vier no
 * array fica como esta. O slug e a identidade publica da página e não se
 * cria nem se apaga pelo painel — as cinco sempre existem.
 */
export class InstitutionalPageDto {
  @IsIn(INSTITUTIONAL_PAGE_SLUG_VALUES, {
    message: `página desconhecida: use um de ${INSTITUTIONAL_PAGE_SLUG_VALUES.join(', ')}`,
  })
  slug: InstitutionalPageSlug;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  /** Markdown. Vai para o banco como foi escrito; quem renderiza e o site. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PAGE_CONTENT_LENGTH)
  content?: string;

  /** Publicada ou não. Despublicada some do rodapé e responde 404. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
