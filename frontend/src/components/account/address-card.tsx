import { useEffect, useRef, useState } from 'react';
import { PencilIcon, StarIcon, TrashIcon } from '@/components/store';
import { Badge, Button } from '@/components/ui';
import type { AccountAddress } from '@/features/account';
import { addressLines } from '@/lib/format';
import styles from './address-card.module.css';

export interface AddressCardProps {
  address: AccountAddress;
  /** O nome da cidade, resolvido a partir de `cityId`. Vazio quando nao ha. */
  cityName: string;
  onEdit: (address: AccountAddress) => void;
  onMakeDefault: (address: AccountAddress) => void;
  onDelete: (address: AccountAddress) => void;
  /** Ha uma gravacao em andamento: os botoes param de aceitar clique. */
  busy: boolean;
}

/**
 * Um endereco salvo.
 *
 * ## O apelido e o titulo, e ele pode nao existir
 *
 * "Casa", "Trabalho", "Casa da minha mae" — e o que a pessoa procura quando
 * tem tres enderecos parecidos, e nenhum deles se distingue pela rua. Mas
 * quem tem um endereco so nao batiza o lugar onde mora, entao o apelido e
 * opcional e a falta dele nao deixa um titulo vazio: vira "Meu endereco".
 *
 * ## Excluir confirma na propria linha
 *
 * Sem modal. O que se perde aqui e um endereco que pode ser redigitado em
 * trinta segundos — interromper a tela inteira, prender o foco e escurecer o
 * fundo por causa disso seria um susto desproporcional ao estrago.
 *
 * O que a confirmacao **precisa** ter e o alvo a vista, e por isso ela
 * acontece dentro do cartao: os botoes somem e a pergunta ocupa o lugar
 * deles, com o endereco continuando escrito logo acima. Numa lista de tres
 * cartoes parecidos, um dialogo flutuante perguntando "tem certeza?" nao
 * diria de qual deles se esta falando.
 *
 * ## O padrao e um estado, nao um botao repetido
 *
 * O endereco marcado mostra o selo e **nao** oferece "usar como padrao" —
 * um botao que nao muda nada e uma promessa quebrada. Os outros oferecem.
 */
export function AddressCard({
  address,
  cityName,
  onEdit,
  onMakeDefault,
  onDelete,
  busy,
}: AddressCardProps) {
  const [confirming, setConfirming] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);

  /**
   * O foco segue a confirmacao.
   *
   * Clicar em "Excluir" apaga o proprio botao que foi clicado, e com ele o
   * foco — que cairia no `<body>`, deixando quem navega por teclado sem
   * lugar nenhum e quem usa leitor de tela sem saber que algo apareceu. O
   * foco vai para **"Manter"**, e nao para "Excluir": um Enter reflexo
   * precisa desistir, nunca apagar.
   */
  useEffect(() => {
    if (confirming) {
      keepRef.current?.focus();
    }
  }, [confirming]);

  // Numa lista de cartoes parecidos, tres botoes chamados "Editar" soam
  // iguais para quem ouve a tela. O nome acessivel leva o apelido junto.
  const name = address.label === '' ? 'Meu endereco' : address.label;

  const lines = addressLines({
    street: address.street,
    number: address.number,
    complement: address.complement,
    district: address.district,
    city: cityName,
    state: '',
    zipCode: address.zipCode,
    reference: address.reference,
  });

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.label}>{name}</h3>

        {address.isDefault ? <Badge variant="gold">Padrao</Badge> : null}
      </div>

      <div className={styles.lines}>
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      {address.reference === '' ? null : (
        <p className={styles.reference}>
          <span className={styles.referenceLabel}>Referencia</span>
          {address.reference}
        </p>
      )}

      {confirming ? (
        <div className={styles.confirm}>
          <p className={styles.confirmText}>Excluir {name}?</p>

          <div className={styles.confirmActions}>
            <Button
              type="button"
              variant="danger"
              size="small"
              loading={busy}
              loadingLabel="Excluindo"
              onClick={() => {
                onDelete(address);
              }}
            >
              Excluir
            </Button>

            <Button
              ref={keepRef}
              type="button"
              variant="ghost"
              size="small"
              onClick={() => {
                setConfirming(false);
              }}
            >
              Manter
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          {address.isDefault ? null : (
            <button
              type="button"
              className={styles.action}
              disabled={busy}
              aria-label={`Usar ${name} como endereco padrao`}
              onClick={() => {
                onMakeDefault(address);
              }}
            >
              <StarIcon className={styles.actionIcon} />
              Usar como padrao
            </button>
          )}

          <button
            type="button"
            className={styles.action}
            disabled={busy}
            aria-label={`Editar ${name}`}
            onClick={() => {
              onEdit(address);
            }}
          >
            <PencilIcon className={styles.actionIcon} />
            Editar
          </button>

          <button
            type="button"
            className={styles.action}
            disabled={busy}
            aria-label={`Excluir ${name}`}
            onClick={() => {
              setConfirming(true);
            }}
          >
            <TrashIcon className={styles.actionIcon} />
            Excluir
          </button>
        </div>
      )}
    </article>
  );
}
