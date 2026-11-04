# Diagnóstico do site Parts Seals — 2026-11-03

## Arquitetura real

- O repositório do site é `partsseals-site`, vizinho do Kuru Nuvem. O repositório do Kuru contém o portal de expedição de origem e as migrações/RPCs do cliente.
- HTML, CSS e JavaScript puros, sem bundler de front-end. `tools/build_site.cjs` copia somente os arquivos públicos para `dist/`; Netlify empacota funções separadas. Não há `package.json`, typecheck ou lint configurados.
- Home em `/`, `/en.html`, `/es.html`; biblioteca e seletor em `/materiais.html`; portal em `/cliente`; expedição em `/expedicao`.
- `js/materials.js` contém um comparador por faixas de temperatura e um seletor existente. `assets/datasheets-view/manifest.json` lista fichas; a biblioteca pública abre imagens com marca d'água. Esses dados não comprovam compatibilidade química ou recomendação de perfil de uma formulação específica.
- Área do Cliente: `netlify/functions/cliente-api/index.js` confere Supabase Auth por cookies HttpOnly e chama somente RPCs `site_cliente_*` via service role. O painel usa `GET eu` e `GET pedidos`. A autorização de pedidos é feita pelo RPC de banco do Kuru; verificar as migrations `sql/141` e `sql/142` antes de ampliá-lo.
- Expedição tem API e UI próprias. Não há motivo para tocá-las nesta evolução.
- O site usa paleta escura/vermelha e padrões `section`, `container`, `btn`, com media queries e `prefers-reduced-motion`. Há páginas em PT/EN/ES, canonical, hreflang, robots e sitemap. Páginas privadas ficam fora do sitemap.

## Riscos e decisões

- Não há, nos contratos do site, relação comprovada entre entrega concluída e **UF do endereço de entrega**. O mapa usará fonte manual interna versionada e começará vazio; a integração automática só pode entrar após validação do vínculo e do critério pelo responsável.
- A malha estática usa as APIs oficiais de Malhas v3 e Localidades v1 do IBGE. A geração é reproduzível por `node tools/gerar_mapa_ibge.cjs`; o navegador não depende do IBGE.
- A fonte de atendimento fica fora de `dist` e fornece à página somente UF e data. Para alimentar, editar `netlify/functions/cobertura-dados.json` com revisão do responsável, UF, data e `evidenciaInterna` (referência não pessoal), registrar a aprovação no controle de mudanças e publicar pelo fluxo normal. Não inserir cliente, NF ou endereço. O arquivo é auditável pelo Git e requer acesso de escrita ao repositório.
- Integração futura: serviço server-side privilegiado mínimo deve cruzar registros de entrega/faturamento confirmado com **endereço de destino**, agregar `DISTINCT uf` e devolver o mesmo contrato público. Não derivar UF do cadastro de cobrança nem do nome do cliente. Aplicar cache e monitorar erros sem PII.
- Parte do conteúdo institucional atual, como `+8 anos`, depoimentos e fotos, já estava no site. Não foram introduzidas novas alegações desse tipo; a revisão editorial do material preexistente depende do responsável.
- Há dois HTMLs de e-mail não rastreados no repositório no início do trabalho; foram preservados.

## Plano verificável

1. Mapa responsivo e acessível, fonte anônima, testes de 27 UFs e estado vazio/erro.
2. Conteúdo institucional novo apenas com texto que o site já sustenta; demais módulos editoriais em espera de aprovação.
3. Central Técnica autenticada usando cálculos matemáticos isolados e os links da biblioteca existente; sem parecer de engenharia sem base.
4. Dashboard do cliente baseado somente no retorno de `GET pedidos`.
5. Regressão, SEO/acessibilidade, backlogs e relatórios com comandos e limitações reais.
