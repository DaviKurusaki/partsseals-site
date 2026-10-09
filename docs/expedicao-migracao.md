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
5. O projeto antigo `parts-seals-expedicao.netlify.app` passa a servir somente
   o redirecionador gerado por `node tools/build_legacy_redirect.cjs`:

   ```text
   /api/*  https://parts-seals-links.netlify.app/.netlify/functions/expedicao-api/:splat  200!
   /*      https://parts-seals.com.br/expedicao/:splat      301!
   ```

   O proxy da API preserva autenticação, corpo e método das chamadas de abas
   antigas. Um redirecionamento da API entre domínios perderia o cabeçalho de
   autenticação. As páginas e etiquetas usam o redirecionamento permanente.
   Para republicar esse redirecionador, execute dentro de `dist-legado/`:

   ```text
   npx netlify-cli deploy --prod --no-build --dir public --functions functions --site 4f24d4ba-68ee-4fa1-af56-932fcf926894
   ```

   Os builds automáticos do projeto antigo ficam parados na Netlify, para
   que mudanças no Kuru não substituam o redirecionador. O projeto principal
   continua vinculado ao `partsseals-site` com os builds ativos.

O endereço antigo deve permanecer como redirecionador: as etiquetas já
impressas usam esse domínio. Depois da troca, a página, a API e as futuras
atualizações ficam no `partsseals-site`. O leitor novo aceita tanto os links
antigos quanto os links de `/expedicao/e/`. Links `/e/CODIGO` no domínio
principal também são encaminhados para a expedição.

A migração foi publicada em 9 de outubro de 2026. A API de estado respondeu
com configuração válida; consultas sem PIN retornaram 401. As suítes locais
usam dados simulados: nenhuma entrega ou coleta real foi registrada na
verificação. Reinicie o Kuru atualizado para gerar novos QR Codes com o
endereço oficial.

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

## Avisos de WhatsApp e endereços do ARGUS

Ao confirmar uma entrega ou coleta, a função prepara um aviso `expedicao`
na fila existente `pcp_avisos_whatsapp`. O Kuru do remetente configurado
produz a mesma imagem e legenda da Expedição do Acabamento e envia ao mesmo
grupo. Continua dependente do interruptor de avisos e do Kuru conectado ao
WhatsApp; não há sessão de WhatsApp na Netlify.

O snapshot do aviso fica no primeiro item de `expedicao_baixas`, junto com a
baixa. A função tenta enfileirar imediatamente; o Kuru 0.2.704 ou superior
retoma avisos pendentes em caso de falha. O ID da fila é o negativo do ID da
baixa. A chave primária impede duplicações; nunca fazer upsert ou mesclar
outros eventos nesses registros. `expedicao-aviso.cjs` é autossuficiente aqui
e sua cópia em `src/shared/` do Kuru deve permanecer idêntica.

O status Parcial/Finalizado considera todas as OPs do pedido, inclusive
itens futuros e saídas anteriores. O aviso lista apenas os itens desta
baixa, com dados relidos pelo servidor e nome do retirante na coleta.

Os endereços continuam sendo lidos de `clientes_enderecos`. No Kuru,
Tabula > Etiquetas > Expedição oferece Importar do ARGUS. A conexão com o
Firebird permanece cifrada no computador, fora deste site. A importação
preserva endereços manuais, não altera o ARGUS e ignora correspondências
ambíguas. Não exige nova migração SQL; usa as tabelas existentes.
