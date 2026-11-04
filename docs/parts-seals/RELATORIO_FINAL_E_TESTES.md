# Relatório final e testes — Parts Seals

Data: **2026-11-03**. Repositório de implementação: `partsseals-site` (projeto vizinho ao Kuru Nuvem). **Entrega de código local, sem deploy.** Há recursos completos de interface e cálculo; dados de cobertura real, práticas internas e regras de engenharia permanecem pendentes onde indicado.

## 1. Resumo executivo

Foram adicionados o mapa do Brasil com 27 UFs e fonte de cobertura mínima no servidor, uma seção institucional de orientação técnica em PT/EN/ES, uma Central Técnica protegida para clientes aprovados com dez entradas e um resumo inicial melhorado na Área do Cliente. O visual escuro/vermelho, contatos comerciais, biblioteca/seletor/comparador públicos, login/cadastro, pedidos e expedição foram mantidos. O código não foi publicado nem foi conectado ao Supabase de produção nesta execução.

**Limites deliberados:** nenhuma UF foi marcada sem prova; compatibilidade química e perfil não geram parecer; não há vídeo aprovado; o catálogo avançado, SVGs dimensionais oficiais e PDF com auditoria ficaram no backlog. A apresentação de setores e de práticas internas de qualidade depende de conteúdo aprovado. A página existente já contém indicadores e depoimentos; a revisão editorial deles é pendência do responsável. As imagens artificiais da home foram retiradas em uma etapa posterior descrita abaixo.

## 2. Tabela completa de implementações

| ID | Funcionalidade | Status | Arquivos principais | Rota/tela | Dependência e observação |
|---|---|---|---|---|---|
| A1 | Mapa IBGE, 27 UFs, foco/toque/lista/regiões | IMPLEMENTADO | `assets/brasil-ufs.json`, `tools/gerar_mapa_ibge.cjs`, `js/cobertura.js`, home PT/EN/ES, CSS | `/#brasil`, `/en.html#brasil`, `/es.html#brasil` | Geometria local; resposta de cobertura pela API |
| A2 | Contagem anônima e fonte manual auditável | IMPLEMENTADO COM LIMITAÇÕES | `netlify/functions/cobertura.js`, `cobertura-dados.json`, `_redirects` | `GET /api/cobertura`; indicador na home | Fonte vazia até prova/aprovação; endpoint nunca envia evidência interna |
| A3 | Integração automática com entregas do Kuru | BLOQUEADO | Contrato descrito em `DIAGNOSTICO.md` | Não publicado | Falta relação validada entrega concluída → UF do endereço de destino |
| B1 | Indicador coerente de UFs atendidas | IMPLEMENTADO COM LIMITAÇÕES | `js/cobertura.js` | Indicadores da home | Surge somente se a fonte comprovar ao menos uma UF; revisar números preexistentes |
| B2 | Qualidade e Controle, conteúdo de orientação | IMPLEMENTADO COM LIMITAÇÕES | `index.html`, `en.html`, `es.html` | `/#qualidade` e equivalentes | Sem afirmação de inspeção/certificação; detalhes internos aguardam aprovação |
| B3 | Setores/especialidades | BLOQUEADO | `BACKLOG_VISUAL.md` | Invisível | Lista de setores e descrições ainda não aprovada |
| B4 | Atendimento nacional ligado ao contato atual | IMPLEMENTADO | Home, `js/cobertura.js` | `/#brasil` → `/#contato` | Não promete prazo/frete/cobertura não confirmados |
| B5 | Matéria-prima à peça pronta | ADIADO | `BACKLOG_VISUAL.md` | Não publicado | Etapas reais e conteúdo autorizado faltantes |
| C0 | Central protegida, navegação e busca | IMPLEMENTADO | `cliente-api/index.js`, `central-template.cjs`, `cliente/js/central.js`, `cliente/central.css`, `_redirects` | `/cliente/central` | Exige sessão e cadastro `aprovado` na função do servidor |
| C1 | Espaço geométrico do alojamento | IMPLEMENTADO | `cliente/js/calculos.js`, `central.js` | `/cliente/central#c1` | Sem tolerância ou indicação técnica |
| C2 | Seção radial | IMPLEMENTADO | mesmos | `/cliente/central#c2` | Fórmula só de geometria cilíndrica |
| C3 | Conversor de unidades | IMPLEMENTADO | mesmos | `/cliente/central#c3` | mm/pol, bar/MPa/psi, °C/°F, fonte NIST |
| C4 | Comparador de materiais interno | IMPLEMENTADO COM LIMITAÇÕES | `cliente/js/central.js` | `/cliente/central#c4` | Lê `/materiais.html` sob demanda; atributos ausentes/revisões não inferidos |
| C5 | Consulta de compatibilidade química | IMPLEMENTADO COM LIMITAÇÕES | `cliente/js/central.js` | `/cliente/central#c5` | Interface e resposta conservadora; matriz científica não aprovada |
| C6 | Guia de medição e ficha local | IMPLEMENTADO | `cliente/js/central.js` | `/cliente/central#c6` | SVG sem escala; ficha em texto, não documento oficial |
| C7 | Questionário de perfis | IMPLEMENTADO COM LIMITAÇÕES | `cliente/js/central.js` | `/cliente/central#c7` | Resumo copiável; não recomenda perfil sem catálogo/regras |
| C8 | FAQ técnico pesquisável | IMPLEMENTADO | `cliente/js/central.js` | `/cliente/central#c8` | Lê 6 respostas da home; sem respostas inventadas |
| C9 | Biblioteca visual categorizável | IMPLEMENTADO COM LIMITAÇÕES | `cliente/js/central.js` | `/cliente/central#c9` | Usa manifesto de fichas existente; nenhum vídeo aprovado |
| C10 | Histórico opt-in local | IMPLEMENTADO | `cliente/js/central.js` | `/cliente/central#c10` | Até 20 registros por conta/navegador; exclusão e limpeza; sem sincronização |
| D44 | Dashboard resumido pós-login | IMPLEMENTADO | `cliente/js/painel.js`, `cliente/cliente.css` | `/cliente` | Deriva contagens só de `GET pedidos`; atalhos para rotas existentes |
| E | SEO, foco, responsividade e isolamento | IMPLEMENTADO COM LIMITAÇÕES | `sitemap.xml`, CSS, `tests/site-build.cjs`, `tests/visual.cjs` | Home/cliente | Auditoria WCAG externa e deploy preview ainda não executados |
| F | Catálogo/PDF/dimensões oficiais | ADIADO | `BACKLOG_CATALOGO.md` | Documento interno | Sem página/PDF público novo |
| G | Visual e editorial futuros | ADIADO | `BACKLOG_VISUAL.md` | Documento interno | Sem fotos próprias da fábrica/equipe, cases ou vídeo novos |
| IMG | Revisão de todas as imagens publicadas | IMPLEMENTADO COM LIMITAÇÕES | `AUDITORIA_IMAGENS.md`, `assets/img/`, HTML PT/EN/ES | Hero, produtos, consultoria, perfis e prévia social | Fotos reais de terceiros identificadas como ilustrativas; não há fotos próprias da empresa |

### IMG — Onde encontrar e como conferir

1. Abrir `/`, `/en.html` e `/es.html`. No topo, a foto real de usinagem deve carregar e uma nota discreta deve informar que é **ilustrativa** e não mostra as instalações da Parts Seals.
2. Rolar até **Produtos e soluções**. Os oito cards devem exibir oito perfis vetoriais distintos, em vermelho sobre grade técnica. Ler a nota acima dos cards: os desenhos são esquemáticos e sem escala. Os links de orçamento continuam funcionando.
3. Rolar até **Consultoria técnica**. A fotografia documental de medição deve carregar com uma legenda que a identifica como ilustrativa e esclarece que não mostra a equipe.
4. Rolar até **Perfis técnicos**. Os três painéis reutilizam desenhos esquemáticos, com legendas que não os apresentam como fotografias das peças.
5. Compartilhar uma URL em ambiente de prévia com inspeção de metadados: `og:image` aponta para a nova arte de 1200 × 630 px, baseada em fotografia real e marcada “FOTO ILUSTRATIVA”. Conferir também `/materiais.html` e as três políticas de privacidade.
6. Abrir `/materiais.html`, `/cliente` e `/expedicao`. As 19 prévias de datasheets, logos, ícones e funcionalidades anteriores permanecem. Nenhuma imagem artificial antiga deve ser servida pela build.

**Pendência:** sem fotos originais dos produtos e processos da Parts Seals, os cards usam diagramas genéricos e as duas fotografias são de terceiros. A auditoria registra origem, licença, limites de uso e os 23 arquivos anteriores removidos. Esse resultado elimina a aparência artificial sem afirmar que imagens externas retratam a empresa.

## 3. Como testar — passo a passo para leigos

**Pré-requisitos gerais:** usar uma implantação de prévia do repositório `partsseals-site` depois que o responsável a disponibilizar. Os caminhos abaixo são reais e devem ser anexados ao domínio da prévia. Para a Central Técnica e o dashboard, ter uma conta de teste da Área do Cliente **aprovada** no Kuru (sem usar cadastro de cliente real para demonstrações). Os números abaixo são **DEMO de entrada**, nunca dados de produção. No celular, repetir em retrato e verificar que não há rolagem lateral.

### A1/A2 — Mapa, regiões, lista e fonte

1. Abrir `/` e rolar até **Parts Seals pelo Brasil** (`/#brasil`). O mapa deve mostrar 27 UFs em cinza enquanto `cobertura-dados.json` estiver vazio, com mensagem “Cobertura em atualização”.
2. Clicar ou focar por Tab uma UF e pressionar Enter. O painel mostra nome, sigla, região e “Sem atendimento comprovado”. No celular, digitar **SP** na busca e selecionar São Paulo; deve aparecer uma opção exata.
3. Clicar **Por região**, escolher Sudeste e conferir que a lista filtra as UFs dessa região. O botão **Solicitar orçamento** leva ao contato comercial já existente.
4. Abrir `/api/cobertura`: deve mostrar `ufs: []` antes de aprovação, sem cliente, endereço, pedido, nota ou evidência. Se houver dados aprovados futuramente, conferir que o contador equivale às UFs em vermelho e que cada uma possui data de referência. API indisponível deve mostrar aviso no mapa sem quebrar o restante da home.

### B1/B2/B4 — Indicador, orientação e contato

1. Na home, ver os indicadores. O indicador de UFs só aparece se a fonte tiver ao menos uma UF comprovada; ele usa a mesma contagem do mapa.
2. Abrir `/#qualidade` e ler a orientação. Ela pede dados de aplicação, sem afirmar certificação ou inspeção interna não comprovada.
3. Clicar **Falar com o atendimento**; a página deve levar ao bloco `/#contato`. Na seção do mapa, o CTA aponta ao mesmo contato. Em `/en.html` e `/es.html`, conferir títulos e textos localizados.

### C0 — Autorização e navegação

1. Sem login, abrir `/cliente/central`: deve ir para `/cliente/entrar`. Com cadastro pendente, deve mostrar acesso indisponível. Com conta aprovada, a Central abre.
2. Na Central, procurar **conversor** no campo de busca: só o cartão correspondente permanece. Abrir um cartão e usar **Todas as ferramentas** para voltar. O link **Meus pedidos** retorna ao painel atual.

### C1 — Espaço do alojamento

1. Abrir `/cliente/central#c1`; DEMO: **Ø alojamento 60**, **Ø eixo 50**, em mm; clicar **Calcular**.
2. Esperado: diferença diametral **10 mm**, espaço radial **5 mm**, fórmula e aviso de validação. Digitar valores invertidos para ver erro; **Limpar** remove o resultado. **Copiar resultado** copia o texto.

### C2 — Seção radial

1. Abrir `/cliente/central#c2`; DEMO: **Ø externo 60**, **Ø interno 50**; clicar **Calcular**.
2. Esperado: **5 mm**, desenho vetorial sem escala e fórmula. Repetir com `60,25` e `50.25` (também 5 mm). Zero, negativo ou diâmetros invertidos devem gerar erro, sem resultado técnico falso.

### C3 — Conversor

1. Abrir `/cliente/central#c3`; DEMO: **25,4 mm → pol**, clicar **Converter**: esperado **1 pol**. Tentar **1 pol → mm**: **25,4 mm**.
2. Tentar **10 bar → MPa**: **1 MPa**; **0 °C → °F**: **32 °F**. Unidades de grandezas diferentes devem gerar erro. Usar **Copiar resultado** e **Limpar**.

### C4 — Comparador de materiais

1. Abrir `/cliente/central#c4`; escolher dois materiais do seletor e clicar **Comparar**.
2. Ver atributos lado a lado. Onde a biblioteca não informa algo, aparece **não informado**. Cada coluna tem documento/revisão (ou ausência explícita) e link para `/materiais.html`, fonte já existente. Se a biblioteca falhar, deve aparecer mensagem de indisponibilidade.

### C5 — Compatibilidade química

1. Abrir `/cliente/central#c5`; DEMO: material **PTFE**, fluido **óleo**; clicar **Consultar**.
2. Esperado: **“Sem dados suficientes para afirmar compatibilidade”** e pedido de condições de uso. Não deve surgir grau/classificação inventada.

### C6 — Medição

1. Abrir `/cliente/central#c6`; avançar por **Próximo passo** e voltar por **Anterior**. São quatro passos, com desenho ilustrativo.
2. DEMO: preencher Ø interno `50`, Ø externo `60`, altura `5` mm; clicar **Montar ficha**. A ficha pessoal aparece como texto **não oficial**; **Copiar ficha** a leva à área de transferência. Sem nenhuma medida, deve mostrar erro.

### C7 — Seletor de perfis

1. Abrir `/cliente/central#c7`; DEMO: aplicação **Haste**, movimento **Alternativo**, e preencher apenas condições conhecidas.
2. Clicar **Montar resumo** e **Copiar resumo**. O texto lista campos ausentes e declara que faltam catálogo/regras para recomendar uma família. Não deve indicar código ou perfil específico.

### C8 — Perguntas técnicas

1. Abrir `/cliente/central#c8`; buscar **desenho** e expandir a pergunta encontrada.
2. Comparar com a FAQ em `/#faqTitle`: o texto deve ser o mesmo. Buscar termo ausente mostra estado vazio e caminho para atendimento.

### C9 — Conteúdos visuais

1. Abrir `/cliente/central#c9`; selecionar uma **Categoria** e abrir **Abrir biblioteca** em uma ficha.
2. A lista usa documentos já publicados em `/materiais.html#biblioteca`. A mensagem informa que não há vídeo aprovado; não deve haver player ou vídeo fictício.

### C10 — Histórico

1. Fazer o cálculo de C2. Marcar **Salvar esta consulta neste navegador…**, clicar **Salvar consulta** e abrir `/cliente/central#c10`.
2. Conferir o cálculo salvo, clicar **Reabrir** e ver as entradas restauradas. Voltar ao histórico e testar **Excluir**; salvar outra consulta e testar **Limpar todo o histórico**. Sem marcar o opt-in, não deve salvar nada. Em outra conta/navegador, o histórico anterior não aparece pela interface.

### D44 — Dashboard

1. Entrar em `/cliente/entrar` com conta de teste aprovada e abrir `/cliente`.
2. Conferir **Resumo da sua área**: produção, a caminho e entregues vêm dos pedidos autorizados no período selecionado; se não houver, a lista mostra “Nenhum pedido nesse período”. Clicar nos cartões filtra a lista atual. **Abrir Central Técnica** leva à rota protegida.
3. Trocar período/empresa, quando houver mais de uma, e confirmar que o resumo acompanha o filtro. Se a API falhar, aparecem “Resumo indisponível” e opção de tentar novamente, sem números antigos.

### E — Idiomas, responsividade e regressão

1. Conferir `/`, `/en.html` e `/es.html`, nav/CTAs, mapa, bloco de qualidade, FAQ e footer. Testar `/#contato`.
2. Em 360, 390, 768, 1024 e 1440 px, verificar mapa, lista, calculadoras e dashboard sem rolagem lateral; usar teclado até as UFs e os formulários. `prefers-reduced-motion` remove transições novas.
3. Abrir `/materiais.html`, seletor e comparador públicos; login/cadastro `/cliente/entrar` e `/cliente/cadastro`; `/expedicao`. Esses caminhos não foram substituídos.

## 4. Testes automatizados e validações

| Comando/ação executada | Resultado real |
|---|---|
| `node tools/gerar_mapa_ibge.cjs` | IBGE retornou 27 UFs; asset local de cerca de 60 KiB |
| `node tests/cobertura.cjs` | Passou: 27 UFs únicas, regiões, fonte vazia, resposta mínima, evidência não exposta, entradas inválidas recusadas |
| `node tests/calculos.cjs` | Passou: radial/alojamento, vírgula/ponto, zero, negativo, invertido, mm/pol, bar/MPa/psi, °C/°F e grandezas incompatíveis |
| `node tests/cliente-regras.cjs` | 7 testes passaram, 0 falhas |
| `node tests/cliente-api.cjs` | 22 testes passaram, 0 falhas; inclui sessão anônima/pendente/aprovada para Central, isolamento e CSRF |
| `node tests/expedicao-api.cjs` | 36 testes passaram, 0 falhas (regressão da API existente) |
| `node tools/build_site.cjs` e `node tests/site-build.cjs` | Passaram; `dist/` inclui arquivos públicos, não inclui função/fonte privada; redirects da Central e cobertura verificados |
| `node --check` dos JS novos/alterados e `git diff --check` | Sem erro sintático ou de whitespace |
| `tests/visual.cjs` via Electron isolado | Passou: mapa vazio, 2 UFs DEMO só em fixture, falha de API, busca/teclado, 10 ferramentas, cálculos, comparador, FAQ, visuais, histórico, dashboard vazio/erro; sem transbordamento em 360/390/768/1024/1440 px. Capturas da home, hero mobile, oito cards e consultoria foram geradas em pasta temporária e examinadas. |

**Erros encontrados e corrigidos:** a busca por “SP” também retornava “Espírito Santo”; agora sigla exata tem prioridade. O campo “Buscar ferramenta” deixava o rótulo visível dentro da ferramenta; o conjunto é ocultado. O mapa repetia a mensagem de cobertura vazia em dois locais; ficou uma só. O primeiro teste visual precisou isolar variáveis da própria fixture.

**Não foi possível testar:** sessão/conta de cliente real no Supabase, estado atendido real, fluxo Netlify publicado, bundle de função na infraestrutura Netlify, auditoria externa WCAG/Lighthouse, validação editorial de setores/práticas internas e cálculo baseado em normas ou formulações inexistentes. O projeto não possui `package.json` nem pipeline de lint/typecheck; nenhum resultado desses comandos foi inventado.

## 5. Integrações e origem dos dados

- **Geometria:** [IBGE API de Malhas v3](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3), Brasil com subdivisão por UF, e [IBGE Localidades](https://servicodados.ibge.gov.br/api/docs/localidades). `tools/gerar_mapa_ibge.cjs` gera um JSON estático com nomes, siglas, regiões e caminhos SVG. O navegador não consulta o IBGE ao abrir a home.
- **Atendimento por UF:** `netlify/functions/cobertura-dados.json` é a fonte manual interna versionada. Hoje está **vazia**. Para cada UF, exigir comprovante interno aprovado, data e UF de **entrega**, não de cobrança. A função valida e publica apenas `{ uf, dataReferencia }`, em cache de 5 minutos. A contagem é `Set` de UFs válidas e alimenta mapa e indicador. Erros retornam 503 sem clientes/segredos.
- **Kuru:** `sql/141_site_area_cliente.sql` e `sql/142_site_cliente_empresas.sql` mostram RLS e RPCs de pedidos por usuário; não há contrato seguro de UF da entrega ligado a atendimento concluído no site. A integração automática permanece bloqueada até desenhar/validar esse vínculo e a autorização. A UI continuará consumindo `/api/cobertura` quando a origem mudar.
- **Dados técnicos:** C4 lê os cartões de `/materiais.html`; C8 lê a FAQ da home; C9 lê `assets/datasheets-view/manifest.json`. C1–C3 usam matemática e fatores documentados pelo [NIST](https://www.nist.gov/pml/owm/metric-si/unit-conversion/pressure-and-gas-flow-unit-conversions) e pela [definição de polegada](https://www.nist.gov/pml/owm/si-units-length). C5/C7 não têm base de compatibilidade/perfis aprovada e não fazem recomendação.
- **Variáveis do servidor:** a Central reutiliza `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e, se configurada, `SITE_CLIENTE_URL` já descritas em `docs/area-do-cliente.md`; nenhum valor é exposto. A fonte manual do mapa não exige credencial nova. Não colocar chaves no HTML ou no Git.

## 6. Privacidade e segurança

- A função `cliente-api` verifica cookie HttpOnly no Supabase Auth e cadastro `aprovado` antes de devolver a página da Central. A rota direta da função passa pela mesma verificação. A página tem `no-store`, `noindex`, CSP, `X-Frame-Options: DENY` e não recebe dados de pedidos ou identificador bruto do usuário.
- A API de pedidos existente deriva o id da sessão e chama RPCs de serviço com grants limitados. `site_clientes` e `site_clientes_empresas` têm RLS, sem leitura direta para `anon/authenticated`; a migração do Kuru não foi modificada.
- O histórico é **local**, criado somente após marcar opt-in e clicar em salvar; até 20 entradas por chave de conta derivada, persiste até exclusão/limpeza ou remoção dos dados do navegador. Não sincroniza e não serve para dados sigilosos; outros scripts da mesma origem e quem controla o aparelho ainda podem acessar o armazenamento local. Nenhuma entrada é enviada ao servidor.
- O endpoint público de cobertura não retorna evidência, cliente, endereço, NF, pedido, valor ou coordenadas. A fonte fica fora de `dist/`. Dados de teste DEMO só vivem em `tests/`.
- Entradas numéricas são validadas; resultados de texto usam `textContent` ou escape HTML. POSTs da Área do Cliente existente exigem `X-Cliente` e cookies SameSite. Não foi criada nova mutação no banco.

## 7. Pendências para o responsável

1. Validar o critério de “UF atendida” e fornecer evidências sem PII para cada UF que deseja destacar; aprovar o preenchimento manual de `cobertura-dados.json` ou priorizar o vínculo seguro de entrega/UF no Kuru.
2. Confirmar lista de setores, descrições e etapas reais de qualidade/processo antes de publicá-las. Revisar também os números, depoimentos e imagens já existentes na home.
3. Fornecer catálogo de perfis, regras verificadas e fontes de compatibilidade química se quiser transformar C5/C7 em recomendações, com revisão de engenharia.
4. Aprovar vídeos/legendas/transcrições, se houver, e política de conteúdo futuro. Fornecer desenhos oficiais, PDFs e autorização/auditoria antes do catálogo avançado.
5. Criar prévia de implantação, validar login com conta aprovada de teste e o bundle das funções Netlify; então decidir publicação. Não foi feita alteração em produção.

## 8. Backlog futuro

`BACKLOG_CATALOGO.md` especifica catálogo por código/família/material/dimensões, SVG dimensional oficial, autorização, PDF com marca d'água aplicada no servidor, URLs temporárias e trilha de quem gerou/baixou. `BACKLOG_VISUAL.md` registra fotografias reais/autorizadas e dependências editoriais. Galeria, cases, logos, linha do tempo e vídeo institucional continuam rejeitados neste ciclo.

## 9. Changelog resumido e publicação/rollback

- Adicionados mapa IBGE, API de cobertura mínima, orientações institucionais em três idiomas, Central Técnica protegida, dez ferramentas, dashboard e testes/documentação.
- Corrigidos busca por sigla exata, duplicação do estado vazio e ocultação da busca ao abrir uma ferramenta.
- Antes de publicar: revisar diff, validar fonte manual vazia, rodar comandos da seção 4, implantar uma **prévia** e conferir login, Netlify Functions, CSS/mobile e API sem PII. Fazer publicação de produção somente após aprovação. Para rollback, restaurar o deploy anterior na Netlify; a entrega não alterou tabelas nem migrações do banco.
