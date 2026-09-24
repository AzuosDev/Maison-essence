import { useEffect, useRef, useState } from 'react';
import { PencilIcon, StarIcon, TrashIcon } from '@/components/store';
import { Badge, Button } from '@/components/ui';
import type { AccountAddress } from '@/features/account';
import { addressLines } from '@/lib/format';
import styles from './address-card.module.css';

export interface AddressCardProps {
  address: AccountAddress;
  /** O nome da cidade, resolvido a partir de `cityId`. Vazio quando não há. */
  cityName: string;
  onEdit: (address: AccountAddress) => void;
  onMakeDefault: (address: AccountAddress) => void;
  onDelete: (address: AccountAddress) => void;
  /** Há uma gravação em andamento: os botões param de aceitar clique. */
  busy: boolean;
}

/**
 * Um endereço salvo.
 *
 * ## O apelido e o título, e ele pode não existir
 *
 * "Casa", "Trabalho", "Casa da minha mãe" — e o que a pessoa procura quando
 * tem três endereços parecidos, e nenhum deles se distingue pela rua. Mas
 * quem tem um endereço só não batiza o lugar onde mora, então o apelido e
 * opcional e a falta dele não deixa um título vazio: vira "Meu endereço".
 *
 * ## Excluir confirma na própria linha
 *
 * Sem modal. O que se perde aqui e um endereço que pode ser redigitado em
 * trinta segundos — interromper a tela inteira, prender o foco e escurecer o
 * fundo por causa disso seria um susto desproporcional ao estrago.
 *
 * O que a confirmação **precisa** ter e o alvo a vista, e por isso ela
 * acontece dentro do cartão: os botões somem e a pergunta ocupa o lugar
 * deles, com o endereço continuando escrito logo acima. Numa lista de três
 * cartões parecidos, um diálogo flutuante perguntando "tem certeza?" não
 * diria de qual deles se esta falando.
 *
 * ## O padrão e um estado, não um botão repetido
 *
 * O endereço marcado mostra o selo e **não** oferece "usar como padrão" —
 * um botão que não muda nada e uma promessa quebrada. Os outros oferecem.
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
   * O foco segue a confirmação.
   *
   * Clicar em "Excluir" apaga o próprio botão que foi clicado, e com ele o
   * foco — que cairia no `<body>`, deixando quem navega por teclado sem
   * lugar nenhum e quem usa leitor de tela sem saber que algo apareceu. O
   * foco vai para **"Manter"**, e não para "Excluir": um Enter reflexo
   * precisa desistir, nunca apagar.
   */
  useEffect(() => {
    if (confirming) {
      keepRef.current?.focus();
    }
  }, [confirming]);

  // Numa lista de cartões parecidos, três botões chamados "Editar" soam
  // iguais para quem ouve a tela. O nome acessível leva o apelido junto.
  const name = address.label === '' ? 'Meu endereço' : address.label;

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

        {address.isDefault ? <Badge variant="gold">Padrão</Badge> : null}
      </div>

      <div className={styles.lines}>
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      {address.reference === '' ? null : (
        <p className={styles.reference}>
          <span className={styles.referenceLabel}>Referência</span>
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
              aria-label={`Usar ${name} como endereço padrão`}
              onClick={() => {
                onMakeDefault(address);
              }}
            >
              <StarIcon className={styles.actionIcon} />
              Usar como padrão
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
