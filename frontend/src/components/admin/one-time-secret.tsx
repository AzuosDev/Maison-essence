import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { copyToClipboard } from '@/features/admin';
import { CheckIcon, CopyIcon } from './admin-icons';
import styles from './one-time-secret.module.css';

/**
 * A senha temporária, mostrada uma vez.
 *
 * ## O que este componente promete
 *
 * Que a senha aparece **agora** e não volta. Não há rota que a recupere — o
 * servidor guarda o hash argon2 —, então o que a tela faz com ela nos
 * próximos segundos e tudo o que existe. Três decisões saem disso:
 *
 * 1. **O aviso vem antes da senha, não depois.** Quem lê de cima para baixo
 *    encontra "anote agora" antes de decidir fechar o diálogo.
 * 2. **O texto e selecionável.** `navigator.clipboard` não existe em
 *    contexto inseguro, e o painel aberto por IP na rede da loja e um
 *    contexto inseguro. Quando copiar falha, selecionar a mão ainda
 *    funciona, e o aviso diz isso.
 * 3. **Nada de mascarar com um olhinho.** Esconder o que só aparece uma vez
 *    e um passo a mais para chegar ao único conteúdo da tela. Quem esta
 *    olhando a tela junto já estava olhando.
 *
 * ## O retorno do botão de copiar
 *
 * "Copiado" fica dois segundos e volta a ser "Copiar". O botão precisa
 * confirmar que fez algo — sem isso ninguém sabe se o clique pegou —, e
 * precisa voltar, porque a pessoa costuma copiar de novo depois de colar no
 * lugar errado.
 */

export interface OneTimeSecretProps {
  /** A senha em texto. Só existe aqui, e só por esta renderização. */
  secret: string;
  /** "Senha temporária de rayane@maisonessence.test". */
  label: string;
}

/** Quanto tempo o botão fica dizendo "Copiado". */
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
        Anote ou copie agora. Esta senha não aparece de novo — se ela se perder, o caminho e resetar
        a senha outra vez.
      </p>

      <p className={styles.label}>{label}</p>

      {/*
        `aria-label` no próprio valor para que o leitor de tela anuncie o que
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
        O aviso de falha e uma região viva — `<output>` já e `role="status"`
        nativamente. Quem não vê a tela precisa saber
        que o clique não copiou nada e que a saída e selecionar o texto.
      */}
      <output className={styles.status}>
        {state === 'failed'
          ? 'Não foi possível copiar por aqui. Selecione a senha acima e copie a mão.'
          : ''}
      </output>
    </div>
  );
}
