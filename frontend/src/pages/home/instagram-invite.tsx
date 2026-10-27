import { Container } from '@/components/ui';
import { InstagramIcon } from '@/components/store';
import { useStoreSettings } from '@/features/settings';
import styles from './instagram-invite.module.css';

/**
 * O convite para o Instagram, no pe da vitrine.
 *
 * Metade do movimento desta loja vem de lá: a dona posta o frasco no story,
 * e quem viu chega aqui. O caminho de volta e esta faixa — e ela fecha a
 * página falando da loja como as pessoas, e não como um catálogo.
 *
 * ## Por que não há uma grade de fotos aqui
 *
 * Na loja que serviu de referência, esta seção mostra as últimas publicações
 * do perfil. Isso exige a API do Instagram — um token que expira, um fluxo
 * de autorização e um servidor para guardar o segredo —, e este site e
 * estático: não há onde esconder um token, e um token no bundle e um token
 * público.
 *
 * Então a faixa e o convite, não a vitrine do perfil. Quando houver backend
 * para isso, e aqui que a grade entra.
 *
 * Sem `instagram` cadastrado nas configurações, a seção não existe: uma faixa
 * convidando para um perfil que não foi informado levaria o cliente para
 * lugar nenhum.
 */
export function InstagramInvite() {
  const { settings } = useStoreSettings();
  const handle = settings?.socialLinks.instagram.trim() ?? '';

  if (handle === '') {
    return null;
  }

  return (
    <section className={styles.invite} aria-labelledby="instagram-da-loja">
      <Container className={styles.inner}>
        <span className={styles.icon} aria-hidden="true">
          <InstagramIcon width="24" height="24" />
        </span>

        <div className={styles.text}>
          <h2 id="instagram-da-loja" className={styles.title}>
            Acompanhe no Instagram
          </h2>

          <p className={styles.note}>
            Lançamento, chegada de encomenda e o que entrou em pronta entrega aparecem lá primeiro.
          </p>
        </div>

        {/*
          `rel="noreferrer"` junto do `noopener`: o primeiro impede que a aba
          nova consiga mexer nesta, e o segundo evita mandar o endereço da
          loja no cabeçalho da requisição.
        */}
        <a
          href={profileUrl(handle)}
          className={styles.action}
          target="_blank"
          rel="noopener noreferrer"
        >
          {atHandle(handle)}
        </a>
      </Container>
    </section>
  );
}

/**
 * O endereço do perfil, venha o campo como vier.
 *
 * A dona digita o que quiser no painel: `@maisonessence`, `maisonessence` ou
 * a URL inteira colada do navegador. As três chegam aqui, e as três precisam
 * virar um link que abre.
 */
function profileUrl(handle: string): string {
  if (handle.startsWith('http://') || handle.startsWith('https://')) {
    return handle;
  }

  return `https://instagram.com/${handle.replace(/^@/, '')}`;
}

/** `@perfil`, extraído de qualquer uma das três formas acima. */
function atHandle(handle: string): string {
  const withoutUrl = handle.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');

  return `@${withoutUrl.replace(/^@/, '').replace(/\/+$/, '')}`;
}
