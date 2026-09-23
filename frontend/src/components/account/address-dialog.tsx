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
  /** Ausente, e um endereco novo. */
  address?: AccountAddress | undefined;
  onSubmit: (values: AddressForm, id: string | undefined) => void;
  isPending: boolean;
  error: unknown;
  /** Este sera o primeiro endereco: ele vira padrao de qualquer jeito. */
  isFirst: boolean;
}

/**
 * O formulario de endereco: um dialogo para criar e para editar.
 *
 * ## Por que aqui um modal e justificado
 *
 * O cartao de endereco confirma a exclusao na propria linha, sem interromper
 * nada — e esta bem assim. Este formulario e outra coisa: sao oito campos
 * que nao cabem dentro de um cartao de lista, e preenche-los e uma tarefa
 * com comeco e fim. O foco preso e o Escape que desiste sao exatamente o que
 * se quer aqui.
 *
 * ## A ordem dos campos e a ordem de quem escreve um endereco
 *
 * Apelido, CEP, rua, numero, complemento, bairro, cidade, referencia. Nao e
 * a ordem do banco: e a ordem em que alguem dita o proprio endereco em voz
 * alta. O numero fica ao lado da rua na mesma linha, a partir de 640px,
 * porque e assim que ele e escrito — e porque um campo de vinte caracteres
 * ocupando a largura toda parece pedir mais do que pede.
 *
 * ## "Usar como padrao" some no primeiro endereco
 *
 * Nao por economia de tela: o servidor **promove o primeiro da lista a
 * padrao** quando nenhum vem marcado. Oferecer uma caixa que ja esta
 * decidida seria um controle que mente sobre ter efeito. No lugar dela, a
 * frase que explica o que vai acontecer.
 *
 * ## A cidade e uma escolha entre as que a loja atende
 *
 * O backend recusa endereco apontando para cidade nao atendida — e deve
 * recusar, porque seria uma entrega que so falha no fechamento do pedido.
 * Entao o campo e um seletor, e nao texto livre, e aceita ficar vazio: quem
 * mora fora da area de entrega ainda quer guardar o endereco para a retirada
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

  // Reabrir o dialogo mostra o endereco que foi escolhido agora, e nao o que
  // foi editado na vez anterior. O `open` na dependencia e o que importa: sem
  // ele, clicar em "Editar" num segundo cartao reabriria o primeiro.
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
      title={address === undefined ? 'Novo endereco' : 'Editar endereco'}
      description="Ele fica guardado na sua conta para os proximos pedidos."
    >
      <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        {error === null || error === undefined ? null : (
          <p className={styles.error} role="alert">
            {errorMessage(error)}
          </p>
        )}

        <Input
          label="Apelido"
          hint="Casa, Trabalho, Casa da minha mae."
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
            label="Numero"
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
          hint="So as cidades que a loja atende. Deixe em branco se a sua nao esta aqui."
          options={cityOptions}
          error={errors.cityId?.message}
          {...register('cityId')}
        />

        <Input
          label="Ponto de referencia"
          hint="Perto de que? Ajuda na hora da entrega."
          autoComplete="off"
          error={errors.reference?.message}
          {...register('reference')}
        />

        {isFirst ? (
          <p className={styles.note}>
            Este e o seu primeiro endereco, entao ele ja entra como padrao.
          </p>
        ) : (
          <Checkbox label="Usar como endereco padrao" {...register('isDefault')} />
        )}

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>

          <Button type="submit" loading={isPending} loadingLabel="Salvando">
            Salvar endereco
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
