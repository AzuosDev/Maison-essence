// @vitest-environment jsdom
import { useState, type ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test } from 'vitest';
import { Button } from './button';
import { Drawer } from './drawer';
import { Input } from './input';
import { Modal } from './modal';

/**
 * As tres obrigacoes de um dialogo.
 *
 * Estao aqui, e nao na lista de coisas a conferir a olho, porque sao
 * invisiveis: um modal com o foco solto parece exatamente igual a um modal
 * com o foco preso. Quem descobre a diferenca e quem navega por teclado — e
 * so depois de ficar preso do lado de fora.
 *
 * Modal e Drawer compartilham o `useDialog`, entao o que vale para um vale
 * para o outro; o ultimo caso confirma isso.
 */

// A limpeza nao e automatica: ela so se registra sozinha quando o Vitest
// roda com `globals`, e aqui os utilitarios sao importados um a um.
afterEach(cleanup);

function Exemplo({ render: renderDialog }: { render: (props: DialogProps) => ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Abrir
      </button>

      <button type="button">Fora do dialogo</button>

      {renderDialog({
        open,
        onClose: () => {
          setOpen(false);
        },
      })}
    </>
  );
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
}

function ModalExemplo() {
  return (
    <Exemplo
      render={({ open, onClose }) => (
        <Modal
          open={open}
          onClose={onClose}
          title="Escolha a variante"
          footer={<Button onClick={onClose}>Confirmar</Button>}
        >
          <Input label="Quantidade" defaultValue="1" />
        </Modal>
      )}
    />
  );
}

test('o foco entra no dialogo quando ele abre', async () => {
  const user = userEvent.setup();

  render(<ModalExemplo />);

  await user.click(screen.getByRole('button', { name: 'Abrir' }));

  const dialog = screen.getByRole('dialog');

  expect(dialog).toBeDefined();
  // O primeiro focavel do modal e o X do cabecalho.
  expect(dialog.contains(document.activeElement)).toBe(true);
});

test('o Tab circula dentro do dialogo e nao escapa para a pagina', async () => {
  const user = userEvent.setup();

  render(<ModalExemplo />);

  await user.click(screen.getByRole('button', { name: 'Abrir' }));

  const dialog = screen.getByRole('dialog');
  const fora = screen.getByRole('button', { name: 'Fora do dialogo' });

  // Uma volta inteira e mais um pouco: em nenhum momento o foco sai.
  // Um Tab de cada vez, de proposito: a posicao seguinte depende de onde o
  // anterior parou, e e justamente isso que esta sendo verificado.
  // oxlint-disable no-await-in-loop
  for (let step = 0; step < 6; step += 1) {
    await user.tab();

    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(fora);
  }

  // E para tras tambem.
  for (let step = 0; step < 4; step += 1) {
    await user.tab({ shift: true });

    expect(dialog.contains(document.activeElement)).toBe(true);
  }
});

test('o Escape fecha o dialogo', async () => {
  const user = userEvent.setup();

  render(<ModalExemplo />);

  await user.click(screen.getByRole('button', { name: 'Abrir' }));
  expect(screen.queryByRole('dialog')).not.toBeNull();

  await user.keyboard('{Escape}');

  expect(screen.queryByRole('dialog')).toBeNull();
});

test('ao fechar, o foco volta para o botao que abriu', async () => {
  const user = userEvent.setup();

  render(<ModalExemplo />);

  const gatilho = screen.getByRole('button', { name: 'Abrir' });

  await user.click(gatilho);
  await user.keyboard('{Escape}');

  expect(document.activeElement).toBe(gatilho);
});

test('a gaveta se comporta igual: mesmo hook, mesmas tres obrigacoes', async () => {
  const user = userEvent.setup();

  render(
    <Exemplo
      render={({ open, onClose }) => (
        <Drawer open={open} onClose={onClose} title="Sua sacola">
          <Input label="Cupom" />
        </Drawer>
      )}
    />,
  );

  const gatilho = screen.getByRole('button', { name: 'Abrir' });

  await user.click(gatilho);

  const dialog = screen.getByRole('dialog');

  expect(dialog.contains(document.activeElement)).toBe(true);

  await user.tab();
  expect(dialog.contains(document.activeElement)).toBe(true);

  await user.keyboard('{Escape}');

  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(gatilho);
});
