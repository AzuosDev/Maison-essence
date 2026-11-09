import { Input, Select } from '@/components/ui';
import {
  LINK_ROUTES,
  LINK_TARGET_KINDS,
  LINK_TARGET_LABELS,
  SETTINGS_LIMITS,
  flatten,
  useAdminCategories,
  type LinkTargetKind,
} from '@/features/admin';

/**
 * "Para onde isto leva", perguntado em duas partes.
 *
 * ## A mesma pergunta, duas listas
 *
 * A fileira de círculos e a faixa de cartazes gravam a mesma coisa — um
 * caminho —, e por isso perguntam igual: que tipo de destino, e qual. Duas
 * cópias deste par divergiriam na primeira vez que a loja ganhasse um destino
 * novo, e a dona encontraria a opção num editor e não no outro.
 *
 * ## Por que não e um campo de texto
 *
 * O servidor guarda um caminho e nada mais. Deixar digitar barra e slug na
 * mão e o jeito mais rápido de a home apontar para `/categorias/hidrantes`
 * porque alguém trocou uma letra — e isso não aparece no painel, aparece na
 * cliente que tocou no círculo. A categoria sai de um seletor com a arvore
 * inteira, a lista pronta sai de uma lista fechada, e só a marca e o endereço
 * livre se digitam.
 *
 * ## Os quatro controles ocupam o mesmo lugar
 *
 * E não quatro campos empilhados dos quais três ficariam desabilitados. O
 * rótulo muda junto — "Qual categoria", "Qual marca" —, em vez de um "Valor"
 * genérico: a pergunta inteira precisa caber na leitura de uma linha.
 */

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * As categorias como opções, uma vez por tela.
 *
 * Chamada pelo editor e não por cada linha: declarada lá dentro, a lista
 * viraria um array novo a cada tecla digitada em qualquer campo.
 *
 * A categoria desativada entra com a palavra escrita ao lado em vez de sumir:
 * ela continua sendo um destino válido — a dona pode estar montando a fileira
 * de uma categoria que ainda vai ao ar —, e esconde-lá faria o atalho já
 * salvo perder o destino silenciosamente ao reabrir a tela.
 */
export function useCategoryOptions(): SelectOption[] {
  const { data: tree } = useAdminCategories();

  return flatten(tree ?? []).map((category) => ({
    value: category.slug,
    label: category.isActive ? category.name : `${category.name} (fora do ar)`,
  }));
}

/**
 * Os quatro tipos de destino, fora do componente.
 *
 * Declarada dentro, a lista viraria um array novo a cada render de cada
 * linha.
 */
const TARGET_OPTIONS = LINK_TARGET_KINDS.map((kind) => ({
  value: kind,
  label: LINK_TARGET_LABELS[kind],
}));

const ROUTE_OPTIONS = LINK_ROUTES.map((route) => ({
  value: route.value,
  label: route.label,
}));

export interface LinkTargetFieldsProps {
  kind: LinkTargetKind;
  value: string;
  error: string | undefined;
  categoryOptions: readonly SelectOption[];
  /** O teto do endereço escrito a mão. Igual nas duas listas, hoje. */
  maxLength: number;
  onChange: (next: { targetKind: LinkTargetKind; targetValue: string }) => void;
}

export function LinkTargetFields({
  kind,
  value,
  error,
  categoryOptions,
  maxLength,
  onChange,
}: LinkTargetFieldsProps) {
  return (
    <>
      <Select
        label="Leva para"
        block
        options={TARGET_OPTIONS}
        value={kind}
        onChange={(event) => {
          /*
            Trocar o tipo limpa o valor, e isso e de propósito.

            O slug de uma categoria não e o nome de uma marca nem um caminho:
            carregar o valor antigo para o campo novo deixaria um destino que
            parece preenchido e não leva a lugar nenhum, que e exatamente o
            erro que este par existe para evitar.
          */
          onChange({ targetKind: event.target.value as LinkTargetKind, targetValue: '' });
        }}
      />

      <TargetValue
        kind={kind}
        value={value}
        error={error}
        categoryOptions={categoryOptions}
        maxLength={maxLength}
        onChange={(targetValue) => {
          onChange({ targetKind: kind, targetValue });
        }}
      />
    </>
  );
}

/** A segunda metade da pergunta: qual categoria, qual marca, qual lista. */
function TargetValue({
  kind,
  value,
  error,
  categoryOptions,
  maxLength,
  onChange,
}: {
  kind: LinkTargetKind;
  value: string;
  error: string | undefined;
  categoryOptions: readonly SelectOption[];
  maxLength: number;
  onChange: (value: string) => void;
}) {
  if (kind === 'category') {
    return (
      <Select
        label="Qual categoria"
        block
        placeholder="Escolha a categoria"
        options={categoryOptions}
        value={value}
        error={error}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    );
  }

  if (kind === 'route') {
    return (
      <Select
        label="Qual lista"
        block
        placeholder="Escolha a lista"
        options={ROUTE_OPTIONS}
        value={value}
        error={error}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    );
  }

  if (kind === 'brand') {
    return (
      <Input
        label="Qual marca"
        block
        maxLength={SETTINGS_LIMITS.brandName}
        placeholder="Isabelle La Belle"
        hint="Escreva como esta no cadastro dos produtos, com as mesmas letras."
        value={value}
        error={error}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    );
  }

  return (
    <Input
      label="Qual endereço"
      block
      maxLength={maxLength}
      placeholder="/produtos?pronta=1"
      hint="Um caminho da loja, começando com barra, ou um endereço inteiro."
      value={value}
      error={error}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}
