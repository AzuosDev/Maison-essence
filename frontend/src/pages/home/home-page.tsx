import { MessageScreen } from '@/components/store';

/**
 * A vitrine.
 *
 * Placeholder: a fundacao esta de pe — router, cliente HTTP, sessoes,
 * sacola, tokens — e as prateleiras entram nos proximos passos. O que esta
 * aqui existe para provar que a rota raiz renderiza dentro do layout da loja.
 */
export default function HomePage() {
  return (
    <MessageScreen
      title="A loja esta sendo montada"
      description="A vitrine, o catalogo e o checkout entram em seguida. A fundacao ja esta de pe."
    />
  );
}
