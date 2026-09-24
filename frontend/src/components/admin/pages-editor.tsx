import { useState } from 'react';
import { Input, Switch, Textarea } from '@/components/ui';
import { PAGE_LABELS, SETTINGS_LIMITS, type PageDraft, type PageErrors } from '@/features/admin';
import type { InstitutionalPageSlug } from '@/features/settings';
import { cx } from '@/lib/cx';
import { ChevronRightIcon } from './admin-icons';
import styles from './pages-editor.module.css';

/**
 * As cinco páginas institucionais.
 *
 * ## Por que as cinco aparecem sempre
 *
 * Mesmo as que ninguém escreveu. A lista e fechada — o endereço de cada uma
 * já circula no rodapé e em conversa de WhatsApp, e não se cria nem se apaga
 * página por aqui — então mostrar as cinco e o que responde "o que falta
 * escrever?", que e a pergunta que traz a dona a esta tela.
 *
 * ## Uma de cada vez
 *
 * Cinco caixas de texto abertas transformariam a tela de configurações numa
 * rolagem de três metros. Abre-se a que se vai escrever; as outras mostram o
 * essencial numa linha — se estão publicadas e se tem texto.
 *
 * A página com erro abre sozinha e não fecha: um erro dentro de um bloco
 * fechado e um erro que ninguém vê, e a barra de salvar diria "corrija" sem
 * dizer onde.
 *
 * ## Publicar e escrever são decisões separadas
 *
 * O interruptor fica junto do texto, e não no cabeçalho, porque a ordem
 * importa: escreve-se e depois publica-se. Publicada sem texto, a página vira
 * um link no rodapé que abre em branco — o aviso da tela diz isso com todas
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
                  label="Título da página"
                  block
                  maxLength={SETTINGS_LIMITS.pageTitle}
                  hint="E o que aparece no rodapé e no topo da página."
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
                  hint="Aceita Markdown: ## para título, ** ** para negrito, - para lista."
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
                      ? 'O link esta no rodapé e o endereço responde.'
                      : 'Fora do rodapé, e o endereço responde que a página não existe.'}
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

/** O essencial de uma página fechada: publicada, e se há o que publicar. */
function summaryOf(page: PageDraft): string {
  if (page.content.trim() === '') {
    return page.isActive ? 'Publicada, sem texto' : 'Sem texto';
  }

  return page.isActive ? 'Publicada' : 'Escrita, não publicada';
}
