import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { checkoutKeys } from '@/features/checkout';
import { fetchDeliveryCities } from './delivery.api';
import type { PublicDeliveryCity } from './delivery.types';

/**
 * As cidades atendidas, buscadas uma vez por visita.
 *
 * Cinco minutos de frescor, e nao a meia hora das configuracoes: aqui viaja
 * preco. Um reajuste de taxa precisa chegar a tela de quem esta comprando
 * agora, e a resposta ja vem com `ETag` do backend — entao a revalidacao
 * custa um `304` sem corpo.
 *
 * A chave e a do checkout (`checkoutKeys.deliveryCities`), e nao uma nova:
 * a pagina do produto e o checkout perguntam a mesma coisa, e a segunda tela
 * da visita nao tem por que perguntar de novo.
 */
const STALE_TIME_MS = 5 * 60 * 1000;

export function useDeliveryCities() {
  return useQuery<PublicDeliveryCity[]>({
    queryKey: checkoutKeys.deliveryCities(),
    queryFn: ({ signal }) => fetchDeliveryCities(signal),
    staleTime: STALE_TIME_MS,
  });
}

/**
 * A cidade que este navegador ja escolheu uma vez.
 *
 * Quem mora em Juazeiro nao deveria informar isso de novo a cada produto que
 * abre. A escolha fica no `localStorage` e alimenta tanto o bloco de entrega
 * da pagina do produto quanto, depois, o checkout.
 *
 * Guardado o **id**, e nao o nome: cidade renomeada no painel continua
 * casando, e cidade removida simplesmente nao casa com nenhuma da lista — o
 * seletor volta ao estado de quem nunca escolheu, em vez de mostrar uma
 * cidade que a loja nao atende mais.
 *
 * Toda leitura e escrita dentro de `try`: em aba anonima ou com dados de
 * site bloqueados, `localStorage` lanca em vez de devolver vazio. Perder a
 * preferencia e aceitavel; derrubar a pagina do produto por causa dela nao.
 */
const STORAGE_KEY = 'maison-essence.delivery-city';

export function useChosenCity(): [string, (cityId: string) => void] {
  // Leitura preguicosa: uma vez na montagem, e nao a cada render do bloco.
  const [cityId, setCityId] = useState<string>(readChosenCity);

  const choose = useCallback((next: string) => {
    setCityId(next);
    writeChosenCity(next);
  }, []);

  return [cityId, choose];
}

function readChosenCity(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeChosenCity(cityId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, cityId);
  } catch {
    // Sem memoria nesta sessao. O seletor continua funcionando.
  }
}
