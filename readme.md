# Parts Seals Vedações Industriais

Landing page institucional estática para a Parts Seals, feita com HTML5, CSS3 e JavaScript puro. O projeto roda no Live Server; na Netlify, uma etapa de preparação reúne os arquivos públicos para publicação.

O portal de expedição também faz parte deste projeto, em `/expedicao`. A Netlify
usa `node tools/build_site.cjs` para montar `dist/` com os arquivos públicos e
empacota a API separadamente. Consulte [a configuração e a migração da expedição](docs/expedicao-migracao.md)
antes de publicar pela primeira vez com o portal integrado.

A Área do Cliente fica em `/cliente` (cadastro, entrar e acompanhamento de
pedidos), com a API em `netlify/functions/cliente-api/`. Variáveis, Supabase
Auth e roteiro de teste em [docs/area-do-cliente.md](docs/area-do-cliente.md).

A evolução do mapa e da Central Técnica está descrita em
[docs/parts-seals/RELATORIO_FINAL_E_TESTES.md](docs/parts-seals/RELATORIO_FINAL_E_TESTES.md).
O mapa começa sem UFs destacadas até haver comprovação aprovada; a fonte manual
fica na função de servidor, fora de `dist/`.

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
- `materiais.html`: seletor técnico, guia de materiais e visualizador protegido de datasheets.
- `css/style.css`: identidade visual, responsividade e animações.
- `css/materials.css`: estilos da biblioteca de materiais e do visualizador.
- `js/script.js`: menu mobile, FAQ, animações e links editáveis de contato.
- `js/materials.js`: recomendações do seletor, mensagem de WhatsApp e controles do visualizador.
- `assets/logo.png`: logo da Parts Seals.
- `assets/logo-header-white.png`: versão recortada para o cabeçalho em fundo escuro.
- `assets/logo-footer-white.png`: versão da logo para fundo escuro, usada no rodapé.
- `assets/img/`: imagens usadas no hero, produtos e galeria.
- `assets/icons/`: pasta reservada para ícones adicionais.
- `assets/folder-parts-seals.pdf`: folder institucional.
- `assets/sobre-nos-parts-seals.pdf`: PDF "Sobre nós".
- `assets/parts-seals-contato.vcf`: cartão de contato.
- `assets/datasheets-view/`: páginas com marca d'água exibidas no site, em formato WebP.
- `assets/DataSheets/`: área local dos documentos-fonte; os PDFs não são publicados.
- `tools/build_datasheets.py`: recria as fichas de referência, aplica a marca d'água e gera as imagens públicas.

## Como atualizar os datasheets

1. Coloque os PDFs recebidos em `assets/DataSheets/_originais/`.
2. Ajuste o cadastro em `tools/build_datasheets.py` caso o nome ou o material seja novo.
3. Execute `python tools/build_datasheets.py`.
4. Confira visualmente os arquivos gerados em `assets/datasheets-view/`.

Os PDFs originais e as cópias PDF protegidas estão no `.gitignore`. O site publica apenas imagens rasterizadas com a marca d'água incorporada. As fichas criadas pelo projeto são identificadas como referência e não substituem um certificado de inspeção ou de lote.

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

As duas fotografias editoriais ficam em `assets/img/foto-*.jpg`. Elas mostram cenas reais de terceiros e são identificadas no site como **ilustrativas**, sem atribuí-las à fábrica ou equipe da Parts Seals. Os oito perfis em `assets/img/perfis/` são esquemas genéricos, sem escala. Os SVGs fontes podem ser recriados com `node tools/gerar_imagens_tecnicas.cjs`; os PNGs de 1400 × 933 px são as versões publicadas, geradas a partir deles. A arte de compartilhamento é `assets/img/og-parts-seals-real.jpg`.

Para substituir as fotos por imagens da Parts Seals, obtenha originais e autorização de uso, confirme as legendas e revise os três idiomas (`index.html`, `en.html`, `es.html`). Mantenha o crédito e a origem no inventário `docs/parts-seals/AUDITORIA_IMAGENS.md`. Não use fotos de terceiros como prova de instalações, pessoas ou produtos da empresa.

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
2. Conecte o repositório `partsseals-site`.
3. Mantenha o `netlify.toml`: ele executa `node tools/build_site.cjs` e publica somente `dist/`.
4. Configure as variáveis de servidor da Área do Cliente conforme `docs/area-do-cliente.md`.
5. Confira uma prévia de implantação antes de publicar no domínio principal.

Depois de publicar, atualize a meta tag `og:image` em `index.html` para uma URL absoluta do Netlify. Isso melhora o preview no WhatsApp.

## Observações técnicas

- O site usa HTML, CSS e JavaScript puro.
- O menu mobile, FAQ e animações usam `js/script.js`.
- As animações respeitam `prefers-reduced-motion`.
- Os botões de orçamento abrem WhatsApp com mensagem padrão.
- O layout é responsivo para desktop, tablet e celular.
