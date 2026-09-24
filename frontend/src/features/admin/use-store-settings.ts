import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsKeys } from '@/features/settings';
import { fetchAdminSettings, updateSettings } from './admin.api';
import { adminKeys } from './admin.keys';
import type { UpdateStoreSettingsInput } from './admin.types';

/**
 * As configurações da loja.
 *
 * ## Documento único, sem lista
 *
 * Um registro só, que nasce com os padrões na primeira leitura. Nada aqui e
 * otimista: o que se grava e o nome da loja e o número para onde vai todo
 * pedido, e ver o valor aparecer e voltar meio segundo depois e o jeito mais
 * rápido de não confiar na tela.
 *
 * ## Por que a resposta entra no cache em vez de invalidar
 *
 * O servidor devolve tudo normalizado — o WhatsApp só com digitos, a sigla do
 * estado em maiúscula, o e-mail em minúscula — e os banners novos já com os
 * seus `id`. Guardar a resposta e o que faz a tela mostrar o que **esta
 * gravado**; sem isso, o próximo salvamento mandaria os banners de novo sem
 * `id` e criaria copias deles.
 *
 * ## A loja inteira fica velha
 *
 * Estas configurações desenham a moldura de toda página do site: cabeçalho,
 * rodapé, barra de avisos e o carrossel da home. A mesma aba pode estar com a
 * loja aberta em outra guia, e o cache dela e outro (`settingsKeys`, fora da
 * raiz `['admin']`), então ele e invalidado junto.
 */
const STALE_TIME_MS = 5 * 60_000;

export function useAdminSettings() {
  return useQuery({
    queryKey: adminKeys.settings(),
    queryFn: ({ signal }) => fetchAdminSettings(signal),
    staleTime: STALE_TIME_MS,
  });
}

export function useSaveSettings() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateStoreSettingsInput) => updateSettings(input),

    onSuccess: (saved) => {
      client.setQueryData(adminKeys.settings(), saved);
      void client.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}
