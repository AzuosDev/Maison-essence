import { MessageScreen } from '@/components/store';

/**
 * A abertura da area da conta.
 *
 * Placeholder, como a home: o resumo dos pedidos e os enderecos salvos entram
 * com as telas da conta.
 */
export default function AccountHomePage() {
  return (
    <MessageScreen
      title="Sua conta esta a caminho"
      description="Aqui vao aparecer seus pedidos, seus enderecos e seus dados de contato."
    />
  );
}
