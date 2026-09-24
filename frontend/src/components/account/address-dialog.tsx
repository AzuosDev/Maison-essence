import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button, Checkbox, Input, Modal, Select } from '@/components/ui';
import { addressSchema, type AccountAddress, type AddressForm } from '@/features/account';
import { useDeliveryCities } from '@/features/delivery';
import { errorMessage } from '@/lib/http';
import styles from './address-dialog.module.css';

export interface AddressDialogProps {
  open: boolean;
  onClose: () => void;
  /** Ausente, e um endereço novo. */
  address?: AccountAddress | undefined;
  onSubmit: (values: AddressForm, id: string | undefined) => void;
  isPending: boolean;
  error: unknown;
  /** Este será o primeiro endereço: ele vira padrão de qualquer jeito. */
  isFirst: boolean;
}

/**
 * O formulário de endereço: um diálogo para criar e para editar.
 *
 * ## Por que aqui um modal e justificado
 *
 * O cartão de endereço confirma a exclusão na própria linha, sem interromper
 * nada — e esta bem assim. Este formulário e outra coisa: são oito campos
 * que não cabem dentro de um cartão de lista, e preenche-los e uma tarefa
 * com começo e fim. O foco preso e o Escape que desiste são exatamente o que
 * se quer aqui.
 *
 * ## A ordem dos campos e a ordem de quem escreve um endereço
 *
 * Apelido, CEP, rua, número, complemento, bairro, cidade, referência. Não e
 * a ordem do banco: e a ordem em que alguém dita o próprio endereço em voz
 * alta. O número fica ao lado da rua na mesma linha, a partir de 640px,
 * porque e assim que ele e escrito — e porque um campo de vinte caracteres
 * ocupando a largura toda parece pedir mais do que pede.
 *
 * ## "Usar como padrão" some no primeiro endereço
 *
 * Não por economia de tela: o servidor **promove o primeiro da lista a
 * padrão** quando nenhum vem marcado. Oferecer uma caixa que já esta
 * decidida seria um controle que mente sobre ter efeito. No lugar dela, a
 * frase que explica o que vai acontecer.
 *
 * ## A cidade e uma escolha entre as que a loja atende
 *
 * O backend recusa endereço apontando para cidade não atendida — e deve
 * recusar, porque seria uma entrega que só falha no fechamento do pedido.
 * Então o campo e um seletor, e não texto livre, e aceita ficar vazio: quem
 * mora fora da área de entrega ainda quer guardar o endereço para a retirada
 * e para o que a loja passar a atender depois.
 */
export function AddressDialog({
  open,
  onClose,
  address,
  onSubmit,
  isPending,
  error,
  isFirst,
}: AddressDialogProps) {
  const { data: cities } = useDeliveryCities();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: emptyAddress(),
  });

  // Reabrir o diálogo mostra o endereço que foi escolhido agora, e não o que
  // foi editado na vez anterior. O `open` na dependência e o que importa: sem
  // ele, clicar em "Editar" num segundo cartão reabriria o primeiro.
  useEffect(() => {
    if (open) {
      reset(address === undefined ? emptyAddress() : formFrom(address));
    }
  }, [open, address, reset]);

  const submit = handleSubmit((values) => {
    onSubmit(values, address?.id);
  });

  const cityOptions = (cities ?? []).map((city) => ({
    value: city.id,
    label: `${city.name} — ${city.state}`,
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={address === undefined ? 'Novo endereço' : 'Editar endereço'}
      description="Ele fica guardado na sua conta para os próximos pedidos."
    >
      <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        {error === null || error === undefined ? null : (
          <p className={styles.error} role="alert">
            {errorMessage(error)}
          </p>
        )}

        <Input
          label="Apelido"
          hint="Casa, Trabalho, Casa da minha mãe."
          autoComplete="off"
          error={errors.label?.message}
          {...register('label')}
        />

        <Input
          label="CEP"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="63010-000"
          error={errors.zipCode?.message}
          {...register('zipCode')}
        />

        <div className={styles.row}>
          <Input
            label="Rua"
            autoComplete="address-line1"
            className={styles.street}
            error={errors.street?.message}
            {...register('street')}
          />

          <Input
            label="Número"
            inputMode="numeric"
            autoComplete="off"
            placeholder="s/n"
            className={styles.number}
            error={errors.number?.message}
            {...register('number')}
          />
        </div>

        <Input
          label="Complemento"
          hint="Apartamento, bloco, casa dos fundos."
          autoComplete="address-line2"
          error={errors.complement?.message}
          {...register('complement')}
        />

        <Input
          label="Bairro"
          autoComplete="address-level3"
          error={errors.district?.message}
          {...register('district')}
        />

        <Select
          label="Cidade"
          placeholder="Escolher depois"
          hint="Só as cidades que a loja atende. Deixe em branco se a sua não esta aqui."
          options={cityOptions}
          error={errors.cityId?.message}
          {...register('cityId')}
        />

        <Input
          label="Ponto de referência"
          hint="Perto de que? Ajuda na hora da entrega."
          autoComplete="off"
          error={errors.reference?.message}
          {...register('reference')}
        />

        {isFirst ? (
          <p className={styles.note}>
            Este e o seu primeiro endereço, então ele já entra como padrão.
          </p>
        ) : (
          <Checkbox label="Usar como endereço padrão" {...register('isDefault')} />
        )}

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>

          <Button type="submit" loading={isPending} loadingLabel="Salvando">
            Salvar endereço
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function emptyAddress(): AddressForm {
  return {
    label: '',
    cityId: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    zipCode: '',
    reference: '',
    isDefault: false,
  };
}

function formFrom(address: AccountAddress): AddressForm {
  return {
    label: address.label,
    cityId: address.cityId ?? '',
    street: address.street,
    number: address.number,
    complement: address.complement,
    district: address.district,
    zipCode: address.zipCode,
    reference: address.reference,
    isDefault: address.isDefault,
  };
}
