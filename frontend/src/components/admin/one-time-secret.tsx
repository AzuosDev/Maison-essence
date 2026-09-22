import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { copyToClipboard } from '@/features/admin';
import { CheckIcon, CopyIcon } from './admin-icons';
import styles from './one-time-secret.module.css';

/**
 * A senha temporaria, mostrada uma vez.
 *
 * ## O que este componente promete
 *
 * Que a senha aparece **agora** e nao volta. Nao ha rota que a recupere — o
 * servidor guarda o hash argon2 —, entao o que a tela faz com ela nos
 * proximos segundos e tudo o que existe. Tres decisoes saem disso:
 *
 * 1. **O aviso vem antes da senha, nao depois.** Quem le de cima para baixo
 *    encontra "anote agora" antes de decidir fechar o dialogo.
 * 2. **O texto e selecionavel.** `navigator.clipboard` nao existe em
 *    contexto inseguro, e o painel aberto por IP na rede da loja e um
 *    contexto inseguro. Quando copiar falha, selecionar a mao ainda
 *    funciona, e o aviso diz isso.
 * 3. **Nada de mascarar com um olhinho.** Esconder o que so aparece uma vez
 *    e um passo a mais para chegar ao unico conteudo da tela. Quem esta
 *    olhando a tela junto ja estava olhando.
 *
 * ## O retorno do botao de copiar
 *
 * "Copiado" fica dois segundos e volta a ser "Copiar". O botao precisa
 * confirmar que fez algo — sem isso ninguem sabe se o clique pegou —, e
 * precisa voltar, porque a pessoa costuma copiar de novo depois de colar no
 * lugar errado.
 */

export interface OneTimeSecretProps {
  /** A senha em texto. So existe aqui, e so por esta renderizacao. */
  secret: string;
  /** "Senha temporaria de rayane@maisonessence.test". */
  label: string;
}

/** Quanto tempo o botao fica dizendo "Copiado". */
const FEEDBACK_MS = 2000;

export function OneTimeSecret({ secret, label }: OneTimeSecretProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') {
      return;
    }

    const timer = setTimeout(() => {
      setState('idle');
    }, FEEDBACK_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [state]);

  const copy = (): void => {
    void copyToClipboard(secret).then((ok) => {
      setState(ok ? 'copied' : 'failed');
    });
  };

  return (
    <div className={styles.box}>
      <p className={styles.warning}>
        Anote ou copie agora. Esta senha nao aparece de novo — se ela se perder, o caminho e resetar
        a senha outra vez.
      </p>

      <p className={styles.label}>{label}</p>

      {/*
        `aria-label` no proprio valor para que o leitor de tela anuncie o que
        ele e antes de soletrar dezesseis caracteres sem sentido.
      */}
      <p className={styles.secret} aria-label={label}>
        {secret}
      </p>

      <Button type="button" variant="secondary" size="small" onClick={copy}>
        {state === 'copied' ? <CheckIcon /> : <CopyIcon />}
        {state === 'copied' ? 'Copiado' : 'Copiar'}
      </Button>

      {/*
        O aviso de falha e uma regiao viva — `<output>` ja e `role="status"`
        nativamente. Quem nao ve a tela precisa saber
        que o clique nao copiou nada e que a saida e selecionar o texto.
      */}
      <output className={styles.status}>
        {state === 'failed'
          ? 'Nao foi possivel copiar por aqui. Selecione a senha acima e copie a mao.'
          : ''}
      </output>
    </div>
  );
}
