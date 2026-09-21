import styles from './spinner.module.css';

/**
 * O indicador de espera.
 *
 * O elemento e um `<output>`, que ja tem `role="status"` embutido: sem um
 * anuncio, quem nao ve o circulo girando nao recebe aviso nenhum de que a
 * pagina esta carregando — o conteudo simplesmente aparece, ou nao aparece.
 *
 * Nao ha versao "inline dentro do botao" aqui: botao carregando e estado do
 * botao, e mora no proprio componente de botao quando a hora chegar.
 */
interface SpinnerProps {
  /** Ocupa metade da janela: e o `fallback` de uma rota carregando. */
  page?: boolean;
  label?: string;
}

export function Spinner({ page = false, label = 'Carregando' }: SpinnerProps) {
  return (
    <output className={page ? `${styles.wrapper} ${styles.page}` : styles.wrapper}>
      <span className={styles.spinner} />
      <span className="visually-hidden">{label}</span>
    </output>
  );
}
