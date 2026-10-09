# Expedição no site principal

O projeto publica o site institucional em `https://parts-seals.com.br/` e o
portal operacional em `https://parts-seals.com.br/expedicao`. A API está neste
repositório, em `netlify/functions/expedicao-api/`, com a regra de consulta
incluída na própria função. A publicação não depende do repositório do Kuru.

## Configuração na Netlify

No projeto que já atende o domínio `parts-seals.com.br`, copie do projeto
antigo de expedição as variáveis abaixo. Os valores ficam somente na Netlify,
nunca no código, em um commit ou no HTML público:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (a chave anon; não usar service_role)
- `KURU_SEGREDO_SESSAO`
- `TABELA_ORDENS`, se houver um valor personalizado no projeto antigo

Configure os valores para Functions/Runtime e para o contexto Production.
Se testar a prévia, habilite também o contexto Deploy Previews. Use o mesmo
banco do Kuru para preservar os códigos das etiquetas. Não crie tokens novos
para as etiquetas existentes.

O `netlify.toml` define a base `.`, o comando `node tools/build_site.cjs`, o
diretório público `dist` e o diretório de funções `netlify/functions`.
O build copia somente páginas e recursos públicos. Arquivos de conexão,
código do servidor, testes e PDFs-fonte não entram no diretório publicado.

## Verificação antes da troca dos QR Codes

1. Publique este projeto e abra `/expedicao` no celular.
2. Confira se `/expedicao/api/estado` retorna JSON, com a configuração dos
   interruptores do Kuru, sem uma mensagem de variáveis ausentes.
3. Entre com um PIN que já tem permissão. Confira a consulta de uma etiqueta
   existente, câmera, entrega e coleta. Uma baixa real deve ser feita somente
   em um pedido que precisa ser expedido.
4. No Kuru, altere `SITE_EXPEDICAO` em `src/main/etiquetasAuto.js` para
   `https://parts-seals.com.br/expedicao`. As etiquetas novas passarão a usar
   `/expedicao/e/CODIGO`. Faça essa troca somente depois de conferir o portal.
5. No projeto antigo `parts-seals-expedicao.netlify.app`, substitua os
   redirecionamentos por estas regras e publique uma última vez:

   ```text
   /api/*  https://parts-seals.com.br/expedicao/api/:splat  307!
   /*      https://parts-seals.com.br/expedicao/:splat      301!
   ```

O endereço antigo deve permanecer como redirecionador: as etiquetas já
impressas usam esse domínio. Depois da troca, a página, a API e as futuras
atualizações ficam no `partsseals-site`. O leitor novo aceita tanto os links
antigos quanto os links de `/expedicao/e/`. Links `/e/CODIGO` no domínio
principal também são encaminhados para a expedição.

## Buscas e páginas públicas

As páginas institucionais têm canonical e links de idioma no domínio oficial,
e estão listadas em `/sitemap.xml`, indicado por `/robots.txt`. Depois de
publicar, o sitemap pode ser enviado ao Google Search Console.

A expedição conserva `noindex, nofollow` e fica fora do sitemap: é um portal
operacional com PIN e dados de pedidos. Esses controles não são aplicados ao
site institucional. A presença da expedição no mesmo domínio não garante
melhoria de posição nas buscas; o conteúdo público é o que pode ser indexado.

## Testes locais, sem banco real

```text
node tools/build_site.cjs
node tests/site-build.cjs
node tests/expedicao-api.cjs
```

A suíte de API usa dados simulados e confere autenticação, permissões, bloqueio
de PIN, consulta, entrega, coleta parcial, cliente incorreto e auditoria.
