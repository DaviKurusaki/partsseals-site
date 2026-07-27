# Parts Seals Vedações Industriais

Landing page institucional estática para a Parts Seals, feita com HTML5, CSS3 e JavaScript puro. O projeto roda no Live Server e pode ser publicado no Netlify sem build.

## Como rodar no Live Server

1. Abra esta pasta no VS Code.
2. Instale a extensão **Live Server**, se ainda não tiver.
3. Clique com o botão direito em `index.html`.
4. Escolha **Open with Live Server**.

Também é possível abrir `index.html` diretamente no navegador, mas o Live Server simula melhor o ambiente de publicação.

## Estrutura de pastas

- `index.html`: versão em português brasileiro da landing page.
- `en.html`: versão em inglês da landing page.
- `es.html`: versão em espanhol da landing page.
- `css/style.css`: identidade visual, responsividade e animações.
- `js/script.js`: menu mobile, FAQ, animações e links editáveis de contato.
- `assets/logo.png`: logo da Parts Seals.
- `assets/logo-header-white.png`: versão recortada para o cabeçalho em fundo escuro.
- `assets/logo-footer-white.png`: versão da logo para fundo escuro, usada no rodapé.
- `assets/img/`: imagens usadas no hero, produtos e galeria.
- `assets/icons/`: pasta reservada para ícones adicionais.
- `assets/folder-parts-seals.pdf`: folder institucional.
- `assets/sobre-nos-parts-seals.pdf`: PDF "Sobre nós".
- `assets/parts-seals-contato.vcf`: cartão de contato.

## Como alterar textos

Edite os textos diretamente no HTML do idioma correspondente (`index.html`, `en.html` ou `es.html`). As seções estão separadas por blocos semânticos:

- Header e hero.
- Números de confiança.
- Soluções principais.
- Produtos e soluções.
- Segmentos atendidos.
- Consultoria técnica.
- Materiais.
- Como funciona o atendimento.
- Diferenciais.
- Galeria.
- Depoimentos.
- FAQ.
- CTA final e footer.

## Como alterar imagens

As imagens principais ficam em `assets/img/`:

- `hero-industrial.jpg`
- `seals-components.jpg`
- `technical-analysis.jpg`
- `manufacturing-gallery.jpg`
- `product-aneis-guia.jpg`
- `product-vedacoes-pneumaticas.jpg`
- `product-pecas-tecnicas.jpg`
- `product-amostra-desenho.jpg`

Para trocar uma imagem, substitua o arquivo mantendo o mesmo nome ou altere o caminho no `src` correspondente em `index.html`. Mantenha imagens otimizadas, de preferência em JPG ou WebP, com largura entre 1200px e 1800px.

## Onde trocar WhatsApp e e-mail

Os links principais são configurados no topo de `js/script.js`. As mensagens automáticas usam o idioma da página (`pt-BR`, `en` ou `es`) a partir de `CONTACT_COPY`:

```js
var CONTACT_COPY = {
  pt: { whatsappMessage: "..." },
  en: { whatsappMessage: "..." },
  es: { whatsappMessage: "..." },
};
```

Também há telefone fixo e e-mails no footer dos arquivos de idioma:

- `(19) 3626-3552`
- `vendas@parts-seals.com.br`
- `pcp@parts-seals.com.br`
- `contato@parts-seals.com.br`

## Onde trocar endereço, CNPJ e redes sociais

No footer do `index.html`, procure pelos comentários `EDITE`. Ali estão:

- Endereço.
- CNPJ.
- Inscrição Estadual.
- Links de LinkedIn e Instagram.
- Link do Google Maps.

## Como publicar no Netlify

1. Entre no Netlify.
2. Crie um novo site.
3. Faça upload da pasta do projeto ou conecte o repositório.
4. Não configure comando de build.
5. Use a pasta raiz como diretório de publicação.

Depois de publicar, atualize a meta tag `og:image` em `index.html` para uma URL absoluta do Netlify. Isso melhora o preview no WhatsApp.

## Observações técnicas

- O site usa HTML, CSS e JavaScript puro.
- O menu mobile, FAQ e animações usam `js/script.js`.
- As animações respeitam `prefers-reduced-motion`.
- Os botões de orçamento abrem WhatsApp com mensagem padrão.
- O layout é responsivo para desktop, tablet e celular.
