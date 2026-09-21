import type { ReactNode } from 'react';
import { Container } from '@/components/ui';
import styles from './message-screen.module.css';

/**
 * A tela que ocupa o lugar do conteudo quando nao ha conteudo.
 *
 * Uma so para os tres casos — endereco que nao existe, rota que quebrou,
 * listagem vazia — porque sao a mesma situacao do ponto de vista de quem
 * navega: a pagina abriu e nao ha o que ver. O que muda e o texto e o que se
 * oferece como saida.
 *
 * E por isso que ela vive em `components/store` e nao em `components/ui`:
 * carrega o tom da loja, e o painel administrativo tera o seu.
 */
interface MessageScreenProps {
  /** `404`, `Erro`. Fica acima do titulo, pequeno. */
  code?: string;
  title: string;
  description?: string;
  /** O caminho de volta: um ou dois botoes, nunca mais que isso. */
  actions?: ReactNode;
  /** Detalhe tecnico, so em desenvolvimento. */
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
