import { useState, type DragEvent } from 'react';
import { Input, Switch } from '@/components/ui';
import {
  DELIVERY_LIMITS,
  changesOf,
  draftFromCity,
  estimatedLabel,
  hasCityErrors,
  validateCity,
  type AdminDeliveryCity,
  type CityDraft,
  type UpdateDeliveryCityInput,
} from '@/features/admin';
import { cx } from '@/lib/cx';
import { formatCents } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import { ArrowDownIcon, ArrowUpIcon, GripIcon, TrashIcon } from './admin-icons';
import { RowMenu, type RowMenuItem } from './row-menu';
import styles from './delivery-table.module.css';

/**
 * A tabela de taxas.
 *
 * ## Por que os campos ficam sempre abertos
 *
 * Esta tela não e consultada: ela e **ajustada**. O gasolina subiu e a dona
 * reajusta cinco cidades de uma vez, comparando os valores uns com os outros
 * enquanto digita. Campos que só aparecem depois de um clique transformariam
 * isso em dez cliques e tirariam da vista justamente a coluna que ela esta
 * comparando.
 *
 * E por isso que o desktop e uma planilha, e não uma lista com um botão de
 * editar por linha.
 *
 * ## Cada campo salva ao sair dele
 *
 * Não há botão de salvar. Sair do campo — Tab, Enter, um clique em outro
 * lugar — grava, e só o que mudou (`changesOf`): sair sem alterar nada não
 * gasta chamada nenhuma, e e o gesto mais comum de quem esta conferindo.
 *
 * A linha acende em verde por um instante quando o servidor confirma. Sem
 * isso, gravar sem apertar nada fica indistinguível de não gravar.
 *
 * ## O prazo aparece escrito ao lado do número
 *
 * `2` no campo e `Ate 2 dias uteis` ao lado — que e a frase exata que a
 * cliente lê no checkout. E o que impede o cadastro de `0` achando que
 * significa "sem prazo definido" quando significa "no mesmo dia".
 */

/** Acima disto, planilha. Abaixo, blocos. */
const WIDE = '(min-width: 64rem)';

export interface DeliveryTableProps {
  cities: readonly AdminDeliveryCity[];
  /** A lista já reordenada, pronta para o servidor. */
  onReorder: (cities: AdminDeliveryCity[]) => void;
  /** Só o que mudou. `null` de `changesOf` nunca chega aqui. */
  onSave: (city: AdminDeliveryCity, changes: UpdateDeliveryCityInput) => void;
  onToggleActive: (city: AdminDeliveryCity) => void;
  onDelete: (city: AdminDeliveryCity) => void;
  /** O id da cidade que o servidor acabou de confirmar. */
  savedId?: string | null;
  isReordering?: boolean;
}

export function DeliveryTable({
  cities,
  onReorder,
  onSave,
  onToggleActive,
  onDelete,
  savedId = null,
  isReordering = false,
}: DeliveryTableProps) {
  const isWide = useMediaQuery(WIDE);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const move = (from: number, to: number): void => {
    if (from === to || from < 0 || to < 0 || from >= cities.length || to >= cities.length) {
      return;
    }

    const next = [...cities];
    const [moved] = next.splice(from, 1);

    if (moved !== undefined) {
      next.splice(to, 0, moved);
    }

    onReorder(next);
  };

  const rows = cities.map((city, index) => (
    <CityFields
      key={city.id}
      city={city}
      index={index}
      total={cities.length}
      wide={isWide}
      justSaved={savedId === city.id}
      dragging={dragging === index}
      isDropTarget={over === index && dragging !== index}
      onDragStart={() => {
        setDragging(index);
      }}
      onDragEnd={() => {
        setDragging(null);
        setOver(null);
      }}
      onDragOver={() => {
        setOver(index);
      }}
      onDrop={() => {
        if (dragging !== null) {
          move(dragging, index);
        }

        setDragging(null);
        setOver(null);
      }}
      onMove={(to) => {
        move(index, to);
      }}
      onSave={onSave}
      onToggleActive={onToggleActive}
      onDelete={onDelete}
    />
  ));

  if (!isWide) {
    return <ul className={cx(styles.blocks, isReordering && styles.busy)}>{rows}</ul>;
  }

  return (
    <div className={cx(styles.tableWrap, isReordering && styles.busy)}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Ordem</span>
            </th>
            <th scope="col">Cidade</th>
            <th scope="col">UF</th>
            <th scope="col">Taxa</th>
            <th scope="col">Prazo</th>
            <th scope="col">Frete grátis a partir de</th>
            <th scope="col">No checkout</th>
            <th scope="col">
              <span className="visually-hidden">Ações</span>
            </th>
          </tr>
        </thead>

        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

/* ---- Uma cidade -------------------------------------------------------------- */

interface CityFieldsProps {
  city: AdminDeliveryCity;
  index: number;
  total: number;
  wide: boolean;
  justSaved: boolean;
  dragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onMove: (to: number) => void;
  onSave: (city: AdminDeliveryCity, changes: UpdateDeliveryCityInput) => void;
  onToggleActive: (city: AdminDeliveryCity) => void;
  onDelete: (city: AdminDeliveryCity) => void;
}

/**
 * Os campos de uma cidade.
 *
 * O rascunho e iniciado uma vez, a partir do que veio do servidor, e não e
 * ressincronizado quando a resposta chega. A tentação seria remontar a linha
 * a cada salvamento — e o custo seria o foco: a dona sai do campo de taxa
 * para o de prazo, a gravação dispara no `blur`, a resposta chega e o campo
 * onde ela acabou de entrar desmonta embaixo do cursor.
 *
 * Não há divergência a temer. O que ela digitou e o que foi gravado, e
 * `changesOf` compara contra o `city` atualizado: um estado escrito "ce" e
 * gravado "CE" volta como "CE", e a comparação — que maiusculiza antes — não
 * enxerga diferença nenhuma. Nada reenvia em laço.
 */
function CityFields({
  city,
  index,
  total,
  wide,
  justSaved,
  dragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMove,
  onSave,
  onToggleActive,
  onDelete,
}: CityFieldsProps) {
  const [draft, setDraft] = useState<CityDraft>(() => draftFromCity(city));
  const [touched, setTouched] = useState(false);

  const errors = touched ? validateCity(draft) : {};

  const set = (patch: Partial<CityDraft>): void => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  /**
   * Grava ao sair do campo.
   *
   * Três saídas possíveis, e as três são tratadas aqui: nada mudou (não
   * chama), o que mudou e inválido (marca o campo e não chama), o que mudou e
   * válido (chama com o diff).
   */
  const commit = (): void => {
    setTouched(true);

    if (hasCityErrors(validateCity(draft))) {
      return;
    }

    const changes = changesOf(draft, city);

    if (changes !== null) {
      onSave(city, changes);
    }
  };

  const items: RowMenuItem[] = [
    {
      label: 'Subir',
      icon: ArrowUpIcon,
      disabled: index === 0,
      onSelect: () => {
        onMove(index - 1);
      },
    },
    {
      label: 'Descer',
      icon: ArrowDownIcon,
      disabled: index === total - 1,
      onSelect: () => {
        onMove(index + 1);
      },
    },
    {
      label: 'Excluir',
      icon: TrashIcon,
      tone: 'danger',
      separated: true,
      onSelect: () => {
        onDelete(city);
      },
    },
  ];

  const days = Number.parseInt(draft.days, 10);

  const fields = {
    name: (
      <Input
        label={`Cidade na linha ${String(index + 1)}`}
        hideLabel={wide}
        block
        maxLength={DELIVERY_LIMITS.name}
        placeholder="Sobral"
        value={draft.name}
        error={errors.name}
        onChange={(event) => {
          set({ name: event.target.value });
        }}
        onBlur={commit}
      />
    ),
    state: (
      <Input
        label={wide ? `UF de ${city.name}` : 'UF'}
        hideLabel={wide}
        block
        maxLength={2}
        placeholder="CE"
        value={draft.state}
        error={errors.state}
        inputClassName={styles.upper}
        onChange={(event) => {
          set({ state: event.target.value });
        }}
        onBlur={commit}
      />
    ),
    fee: (
      <Input
        label={wide ? `Taxa de ${city.name}` : 'Taxa'}
        hideLabel={wide}
        block
        numeric
        inputMode="decimal"
        prefix="R$"
        placeholder="0,00"
        value={draft.fee}
        error={errors.fee}
        onChange={(event) => {
          set({ fee: event.target.value });
        }}
        onBlur={commit}
      />
    ),
    days: (
      <Input
        label={wide ? `Prazo de ${city.name}` : 'Prazo em dias úteis'}
        hideLabel={wide}
        block
        numeric
        inputMode="numeric"
        suffix="dias"
        value={draft.days}
        error={errors.days}
        hint={wide ? undefined : estimatedLabel(Number.isInteger(days) ? days : 0)}
        onChange={(event) => {
          set({ days: event.target.value });
        }}
        onBlur={commit}
      />
    ),
    freeFrom: (
      <Input
        label={wide ? `Frete grátis de ${city.name}` : 'Frete grátis a partir de'}
        hideLabel={wide}
        block
        numeric
        inputMode="decimal"
        prefix="R$"
        placeholder="regra da loja"
        value={draft.freeFrom}
        error={errors.freeFrom}
        hint={wide ? undefined : 'Em branco, vale o mínimo geral de Configurações.'}
        onChange={(event) => {
          set({ freeFrom: event.target.value });
        }}
        onBlur={commit}
      />
    ),
    active: (
      <Switch
        label={wide ? `Oferecer ${city.name} no checkout` : 'Oferecer no checkout'}
        hideLabel={wide}
        checked={city.isActive}
        onChange={() => {
          onToggleActive(city);
        }}
      />
    ),
  };

  const dragProps = {
    draggable: true,
    onDragStart,
    onDragEnd,
    onDragOver: (event: DragEvent) => {
      // Sem isto o navegador recusa o solte.
      event.preventDefault();
      onDragOver();
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      onDrop();
    },
  };

  const state = cx(
    dragging && styles.dragging,
    isDropTarget && styles.dropTarget,
    justSaved && styles.saved,
    !city.isActive && styles.inactive,
  );

  if (!wide) {
    return (
      <li className={cx(styles.block, state)} {...dragProps}>
        <div className={styles.blockHead}>
          <GripIcon className={styles.grip} />
          <h3 className={styles.blockTitle}>
            {city.name === '' ? `Cidade ${String(index + 1)}` : `${city.name}/${city.state}`}
          </h3>
          <RowMenu label={city.name} items={items} />
        </div>

        {fields.name}

        <div className={styles.pair}>
          {fields.state}
          {fields.fee}
        </div>

        {fields.days}
        {fields.freeFrom}

        <div className={styles.blockFoot}>{fields.active}</div>
      </li>
    );
  }

  return (
    <tr className={state} {...dragProps}>
      <td className={styles.gripCell}>
        <GripIcon className={styles.grip} />
      </td>
      <td className={styles.nameCell}>{fields.name}</td>
      <td className={styles.stateCell}>{fields.state}</td>
      <td className={styles.feeCell}>{fields.fee}</td>

      <td className={styles.daysCell}>
        {fields.days}
        {/*
          A frase do checkout ao lado do numero. `0` e "no mesmo dia", e sem
          isso escrito alguem o cadastra achando que e "sem prazo definido".
        */}
        <span className={styles.daysLabel}>
          {estimatedLabel(Number.isInteger(days) ? days : 0)}
        </span>
      </td>

      <td className={styles.freeCell}>
        {fields.freeFrom}

        {draft.freeFrom.trim() === '' ? (
          <span className={styles.freeLabel}>segue a loja</span>
        ) : (
          <span className={styles.freeLabel}>
            {city.minOrderForFreeCents === null ? '' : formatCents(city.minOrderForFreeCents)}
          </span>
        )}
      </td>

      <td>{fields.active}</td>

      <td className={styles.actionsCell}>
        <RowMenu label={city.name} items={items} />
      </td>
    </tr>
  );
}
