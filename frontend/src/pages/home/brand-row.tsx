import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Container } from '@/components/ui';
import { brandsOf, type PublicProduct } from '@/features/catalog';
import { useStoreSettings } from '@/features/settings';
import styles from './brand-row.module.css';

/**
 * As marcas da casa, escritas.
 *
 * ## Por que não há logo de marca aqui
 *
 * A referência desta vitrine mostra nove logos de fabricante numa faixa. Os
 * arquivos não existem neste repositório, e inventa-los — redesenhar de
 * memória, baixar de um buscador — seria publicar marca registrada de
 * terceiro com qualidade de fac-símile na página de uma loja que vende os
 * produtos dessas marcas. O nome escrito diz a mesma coisa e não promete
 * nada que não seja verdade.
 *
 * Quando a dona tiver os arquivos autorizados, esta faixa e o lugar deles.
 *
 * ## De onde sai a lista
 *
 * Da faixa que a dona monta no painel: os nomes que ela escolheu, na ordem
 * dela. Marca e campo livre do cadastro do produto, e e por isso que essa
 * escolha passou a existir — sem ela, esta faixa publicava cada erro de
 * digitação como se fosse uma marca da casa: "Arabe" ao lado de "Arabic", a
 * mesma casa escrita de três jeitos, cada grafia com uma vitrine pela metade.
 *
 * **Sem nenhuma marca escolhida, a faixa volta a sair das prateleiras desta
 * página** — as marcas dos produtos que a home já carregou, em ordem
 * alfabética. E o que ela sempre fez, e o que faz nenhuma loja ficar sem a
 * faixa no dia do deploy. Não e uma consulta nova: as três fileiras já
 * trouxeram esses produtos, e pedir o catálogo inteiro para desenhar oito
 * palavras custaria uma requisição de cem itens.
 *
 * Nos dois casos cada nome leva para a vitrine já filtrada por aquela marca —
 * e, escolhida ou deduzida, a grafia precisa ser a mesma do cadastro, porque
 * e ela que o filtro casa.
 */

/** Oito e o que cabe em duas linhas de desktop sem a faixa virar parágrafo. */
const MAX_BRANDS = 8;

interface BrandRowProps {
  /** Os produtos já carregados pelas prateleiras da página. */
  products: readonly PublicProduct[];
}

export function BrandRow({ products }: BrandRowProps) {
  const { settings } = useStoreSettings();
  const chosen = settings?.brands ?? [];

  const brands = (chosen.length > 0 ? chosen : brandsOf(products)).slice(0, MAX_BRANDS);

  // Com uma marca só não há fileira: há uma palavra solta no meio da página.
  if (brands.length < 2) {
    return null;
  }

  return (
    <section className={styles.row} aria-labelledby="marcas-da-casa">
      <Container>
        {/*
          Um título de seção como o das prateleiras, e não um rótulo em caixa
          alta pendurado acima dos nomes. O rótulo que estava aqui —
          "ALGUMAS DAS NOSSAS MARCAS", pequeno, cinza e centralizado — era
          decoração anunciando o conteúdo logo abaixo; a página já tem uma
          forma de dizer "começa uma seção aqui", e e esta.
        */}
        <h2 id="marcas-da-casa" className={styles.title}>
          Nossas marcas
        </h2>

        <ul className={styles.list}>
          {brands.map((brand) => (
            <li key={brand}>
              <Link to={ROUTES.productsByBrand(brand)} className={styles.brand}>
                {brand}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
