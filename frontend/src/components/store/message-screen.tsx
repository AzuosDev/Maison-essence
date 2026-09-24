import type { ReactNode } from 'react';
import { Container } from '@/components/ui';
import styles from './message-screen.module.css';

/**
 * A tela que ocupa o lugar do conteúdo quando não há conteúdo.
 *
 * Uma só para os três casos — endereço que não existe, rota que quebrou,
 * listagem vazia — porque são a mesma situação do ponto de vista de quem
 * navega: a página abriu e não há o que ver. O que muda e o texto e o que se
 * oferece como saída.
 *
 * E por isso que ela vive em `components/store` e não em `components/ui`:
 * carrega o tom da loja, e o painel administrativo terá o seu.
 */
interface MessageScreenProps {
  /** `404`, `Erro`. Fica acima do título, pequeno. */
  code?: string;
  title: string;
  description?: string;
  /** O caminho de volta: um ou dois botões, nunca mais que isso. */
  actions?: ReactNode;
  /** Detalhe técnico, só em desenvolvimento. */
  details?: string;
}

export function MessageScreen({ code, title, description, actions, details }: MessageScreenProps) {
  return (
    <Container>
      <div className={styles.screen}>
        {code ? <p className={styles.code}>{code}</p> : null}

        <h1 className={styles.title}>{title}</h1>

        {description ? <p className={styles.description}>{description}</p> : null}

        {actions ? <div className={styles.actions}>{actions}</div> : null}

        {details ? (
          <details className={styles.details}>
            <summary>Detalhes tecnicos</summary>
            <pre>{details}</pre>
          </details>
        ) : null}
      </div>
    </Container>
  );
}
