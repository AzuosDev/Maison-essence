import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { checkoutKeys } from '@/features/checkout/checkout.keys';
import { fetchDeliveryCities } from './delivery.api';
import type { PublicDeliveryCity } from './delivery.types';

/**
 * As cidades atendidas, buscadas uma vez por visita.
 *
 * Cinco minutos de frescor, e não a meia hora das configurações: aqui viaja
 * preço. Um reajuste de taxa precisa chegar a tela de quem esta comprando
 * agora, e a resposta já vem com `ETag` do backend — então a revalidação
 * custa um `304` sem corpo.
 *
 * A chave e a do checkout (`checkoutKeys.deliveryCities`), e não uma nova:
 * a página do produto e o checkout perguntam a mesma coisa, e a segunda tela
 * da visita não tem por que perguntar de novo.
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
 * A cidade que este navegador já escolheu uma vez.
 *
 * Quem mora em Juazeiro não deveria informar isso de novo a cada produto que
 * abre. A escolha fica no `localStorage` e alimenta tanto o bloco de entrega
 * da página do produto quanto, depois, o checkout.
 *
 * Guardado o **id**, e não o nome: cidade renomeada no painel continua
 * casando, e cidade removida simplesmente não casa com nenhuma da lista — o
 * seletor volta ao estado de quem nunca escolheu, em vez de mostrar uma
 * cidade que a loja não atende mais.
 *
 * Toda leitura e escrita dentro de `try`: em aba anonima ou com dados de
 * site bloqueados, `localStorage` lança em vez de devolver vazio. Perder a
 * preferência e aceitável; derrubar a página do produto por causa dela não.
 */
const STORAGE_KEY = 'maison-essence.delivery-city';

export function useChosenCity(): [string, (cityId: string) => void] {
  // Leitura preguicosa: uma vez na montagem, e não a cada render do bloco.
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
    // Sem memória nesta sessão. O seletor continua funcionando.
  }
}
