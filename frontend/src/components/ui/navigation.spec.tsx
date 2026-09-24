// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test } from 'vitest';
import { Accordion, AccordionItem } from './accordion';
import { Tab, TabList, TabPanel, Tabs } from './tabs';

/**
 * A navegacao por teclado das abas e da sanfona.
 *
 * Esta aqui pela mesma razao do teste dos dialogos: e comportamento que nao
 * aparece na tela. Uma fila de abas em que o Tab visita as seis, uma por uma,
 * parece identica a uma em que as setas trocam e o Tab pula para o conteudo —
 * e a segunda e a que a convencao de acessibilidade define.
 */

afterEach(cleanup);

function Abas() {
  return (
    <Tabs defaultValue="descricao">
      <TabList aria-label="Informações do produto">
        <Tab value="descricao">Descrição</Tab>
        <Tab value="notas">Notas</Tab>
        <Tab value="entrega">Entrega</Tab>
      </TabList>

      <TabPanel value="descricao">Perfume amadeirado.</TabPanel>
      <TabPanel value="notas">Bergamota e âmbar.</TabPanel>
      <TabPanel value="entrega">Taxa fixa por cidade.</TabPanel>
    </Tabs>
  );
}

test('só a aba selecionada esta na ordem do Tab', () => {
  render(<Abas />);

  expect(screen.getByRole('tab', { name: 'Descrição' }).tabIndex).toBe(0);
  expect(screen.getByRole('tab', { name: 'Notas' }).tabIndex).toBe(-1);
  expect(screen.getByRole('tab', { name: 'Entrega' }).tabIndex).toBe(-1);
});

test('as setas trocam de aba e a seleção acompanha o foco', async () => {
  const user = userEvent.setup();

  render(<Abas />);

  screen.getByRole('tab', { name: 'Descrição' }).focus();

  await user.keyboard('{ArrowRight}');

  expect(screen.getByRole('tab', { name: 'Notas' })).toHaveProperty('ariaSelected', 'true');
  expect(screen.getByText('Bergamota e âmbar.')).toBeDefined();

  await user.keyboard('{ArrowLeft}');

  expect(screen.getByRole('tab', { name: 'Descrição' })).toHaveProperty('ariaSelected', 'true');
});

test('a fila de abas circula nas duas pontas', async () => {
  const user = userEvent.setup();

  render(<Abas />);

  screen.getByRole('tab', { name: 'Descrição' }).focus();

  // Para tras na primeira leva a ultima.
  await user.keyboard('{ArrowLeft}');
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Entrega' }));

  // E para frente na ultima volta a primeira.
  await user.keyboard('{ArrowRight}');
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Descrição' }));
});

test('Home e End vao para as pontas', async () => {
  const user = userEvent.setup();

  render(<Abas />);

  screen.getByRole('tab', { name: 'Descrição' }).focus();

  await user.keyboard('{End}');
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Entrega' }));

  await user.keyboard('{Home}');
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Descrição' }));
});

function Sanfona() {
  return (
    <Accordion>
      <AccordionItem value="entrega" title="Entrega">
        Taxa fixa por cidade.
      </AccordionItem>
      <AccordionItem value="pagamento" title="Pagamento">
        PIX e cartão.
      </AccordionItem>
      <AccordionItem value="troca" title="Troca">
        Até sete dias.
      </AccordionItem>
    </Accordion>
  );
}

test('a sanfona abre e fecha, e anuncia o estado', async () => {
  const user = userEvent.setup();

  render(<Sanfona />);

  const gatilho = screen.getByRole('button', { name: /Entrega/ });

  expect(gatilho.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByText('Taxa fixa por cidade.')).toBeNull();

  await user.click(gatilho);

  expect(gatilho.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByText('Taxa fixa por cidade.')).toBeDefined();

  await user.click(gatilho);

  expect(gatilho.getAttribute('aria-expanded')).toBe('false');
});

test('abrir um item fecha o anterior quando o modo e de um só', async () => {
  const user = userEvent.setup();

  render(<Sanfona />);

  await user.click(screen.getByRole('button', { name: /Entrega/ }));
  await user.click(screen.getByRole('button', { name: /Pagamento/ }));

  expect(screen.queryByText('Taxa fixa por cidade.')).toBeNull();
  expect(screen.getByText('PIX e cartão.')).toBeDefined();
});

test('as setas movem entre os gatilhos da sanfona', async () => {
  const user = userEvent.setup();

  render(<Sanfona />);

  const entrega = screen.getByRole('button', { name: /Entrega/ });

  entrega.focus();

  await user.keyboard('{ArrowDown}');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /Pagamento/ }));

  await user.keyboard('{End}');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /Troca/ }));

  await user.keyboard('{Home}');
  expect(document.activeElement).toBe(entrega);
});
