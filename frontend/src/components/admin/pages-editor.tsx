import { useState } from 'react';
import { Input, Switch, Textarea } from '@/components/ui';
import { PAGE_LABELS, SETTINGS_LIMITS, type PageDraft, type PageErrors } from '@/features/admin';
import type { InstitutionalPageSlug } from '@/features/settings';
import { cx } from '@/lib/cx';
import { ChevronRightIcon } from './admin-icons';
import styles from './pages-editor.module.css';

/**
 * As cinco paginas institucionais.
 *
 * ## Por que as cinco aparecem sempre
 *
 * Mesmo as que ninguem escreveu. A lista e fechada — o endereco de cada uma
 * ja circula no rodape e em conversa de WhatsApp, e nao se cria nem se apaga
 * pagina por aqui — entao mostrar as cinco e o que responde "o que falta
 * escrever?", que e a pergunta que traz a dona a esta tela.
 *
 * ## Uma de cada vez
 *
 * Cinco caixas de texto abertas transformariam a tela de configuracoes numa
 * rolagem de tres metros. Abre-se a que se vai escrever; as outras mostram o
 * essencial numa linha — se estao publicadas e se tem texto.
 *
 * A pagina com erro abre sozinha e nao fecha: um erro dentro de um bloco
 * fechado e um erro que ninguem ve, e a barra de salvar diria "corrija" sem
 * dizer onde.
 *
 * ## Publicar e escrever sao decisoes separadas
 *
 * O interruptor fica junto do texto, e nao no cabecalho, porque a ordem
 * importa: escreve-se e depois publica-se. Publicada sem texto, a pagina vira
 * um link no rodape que abre em branco — o aviso da tela diz isso com todas
 * as letras.
 */
export interface PagesEditorProps {
  pages: readonly PageDraft[];
  errors: Partial<Record<InstitutionalPageSlug, PageErrors>> | undefined;
  onChange: (pages: PageDraft[]) => void;
}

export function PagesEditor({ pages, errors, onChange }: PagesEditorProps) {
  const [opened, setOpened] = useState<InstitutionalPageSlug | null>(null);

  const set = (slug: InstitutionalPageSlug, patch: Partial<PageDraft>): void => {
    onChange(pages.map((page) => (page.slug === slug ? { ...page, ...patch } : page)));
  };

  return (
    <ul className={styles.list}>
      {pages.map((page) => {
        const pageErrors = errors?.[page.slug];
        const open = opened === page.slug || pageErrors !== undefined;

        return (
          <li key={page.slug} className={cx(styles.item, open && styles.opened)}>
            <h3 className={styles.heading}>
              <button
                type="button"
                className={styles.trigger}
                aria-expanded={open}
                onClick={() => {
                  setOpened(open ? null : page.slug);
                }}
              >
                <ChevronRightIcon className={styles.chevron} aria-hidden="true" />

                <span className={styles.name}>{PAGE_LABELS[page.slug]}</span>

                <span className={styles.state}>{summaryOf(page)}</span>
              </button>
            </h3>

            {open ? (
              <div className={styles.body}>
                <Input
                  label="Titulo da pagina"
                  block
                  maxLength={SETTINGS_LIMITS.pageTitle}
                  hint="E o que aparece no rodape e no topo da pagina."
                  value={page.title}
                  error={pageErrors?.title}
                  onChange={(event) => {
                    set(page.slug, { title: event.target.value });
                  }}
                />

                <Textarea
                  label="Texto"
                  block
                  rows={10}
                  maxLength={SETTINGS_LIMITS.pageContent}
                  hint="Aceita Markdown: ## para titulo, ** ** para negrito, - para lista."
                  value={page.content}
                  error={pageErrors?.content}
                  onChange={(event) => {
                    set(page.slug, { content: event.target.value });
                  }}
                />

                <div className={styles.publish}>
                  <Switch
                    label="Publicada no site"
                    checked={page.isActive}
                    onChange={(event) => {
                      set(page.slug, { isActive: event.target.checked });
                    }}
                  />

                  <p className={styles.publishHint}>
                    {page.isActive
                      ? 'O link esta no rodape e o endereco responde.'
                      : 'Fora do rodape, e o endereco responde que a pagina nao existe.'}
                  </p>
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** O essencial de uma pagina fechada: publicada, e se ha o que publicar. */
function summaryOf(page: PageDraft): string {
  if (page.content.trim() === '') {
    return page.isActive ? 'Publicada, sem texto' : 'Sem texto';
  }

  return page.isActive ? 'Publicada' : 'Escrita, nao publicada';
}
