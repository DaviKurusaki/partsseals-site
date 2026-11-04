# Estado da implementação — 2026-11-03

O código implementado está no repositório `partsseals-site`. **Não foi publicado.** Os HTMLs de e-mail que já estavam não rastreados foram preservados.

| Fase / módulo | Estado | Arquivos principais | Onde acessar / como verificar | Limitação ou pendência |
|---|---|---|---|---|
| 0 Diagnóstico | TESTADO | `DIAGNOSTICO.md` | Ler arquitetura, integrações e riscos | Revisão editorial do conteúdo preexistente |
| A Mapa e lista de 27 UFs | TESTADO | `assets/brasil-ufs.json`, `tools/gerar_mapa_ibge.cjs`, `js/cobertura.js`, home PT/EN/ES | Home `/#brasil`; `node tests/cobertura.cjs`; `node tests/visual.cjs` | UFs atendidas ainda não aprovadas |
| A Fonte de cobertura server-side | TESTADO | `netlify/functions/cobertura.js`, `cobertura-dados.json`, `_redirects` | `GET /api/cobertura`; resposta pública mínima | Integração automática com Kuru BLOQUEADA por falta de vínculo comprovado entrega → UF de destino |
| B1 Indicador de UFs | TESTADO | `js/cobertura.js`, `.stats-grid` da home | Só aparece na seção de indicadores quando a fonte tem UFs comprovadas | Sem número exibido enquanto fonte vazia; indicadores antigos exigem revisão editorial |
| B2 Qualidade e Controle | TESTADO | `index.html`, `en.html`, `es.html` | Home `/#qualidade` | Texto orienta informações de entrada; práticas internas aguardam validação |
| B3 Setores | BLOQUEADO | `BACKLOG_VISUAL.md` | Não publicado | Lista e descrições dos setores precisam de aprovação |
| B4 Atendimento nacional | TESTADO | Seção `/#brasil` e CTA `/#contato` | Selecionar UF; contato existente | Sem promessa de cobertura/prazo |
| B5 Matéria-prima à peça | ADIADO | `BACKLOG_VISUAL.md` | Não publicado | Etapas reais e fotos autorizadas faltantes |
| C1 Espaço do alojamento | TESTADO | `cliente/js/calculos.js`, `central.js` | `/cliente/central#c1` | Aritmética, sem tolerância/recomendação |
| C2 Seção radial | TESTADO | mesmos arquivos | `/cliente/central#c2` | Fórmula para geometria circular, não perfil funcional complexo |
| C3 Conversor | TESTADO | mesmos arquivos | `/cliente/central#c3` | Unidades de mesma grandeza; até 6 casas exibidas |
| C4 Comparador | TESTADO | `cliente/js/central.js` | `/cliente/central#c4` | Lê a biblioteca atual; revisão de alguns atributos não informada |
| C5 Compatibilidade química | TESTADO | `cliente/js/central.js` | `/cliente/central#c5` | Sem base validada; sempre informa dados insuficientes |
| C6 Guia de medição | TESTADO | `cliente/js/central.js` | `/cliente/central#c6` | Ficha local não oficial; SVG didático sem escala |
| C7 Seletor de perfis | TESTADO | `cliente/js/central.js` | `/cliente/central#c7` | Questionário/resumo, sem famílias candidatas até catálogo/regras aprovados |
| C8 FAQ técnico | TESTADO | `cliente/js/central.js` | `/cliente/central#c8` | Reaproveita as 6 perguntas existentes na home |
| C9 Conteúdos visuais | TESTADO | `cliente/js/central.js`, manifesto existente | `/cliente/central#c9` | Fichas existentes; nenhum vídeo aprovado para exibir |
| C10 Histórico local | TESTADO | `cliente/js/central.js` | `/cliente/central#c10` | Opt-in, até 20 entradas por conta/navegador; não sincroniza |
| C Autorização | TESTADO | `cliente-api/index.js`, `central-template.cjs`, `_redirects` | `node tests/cliente-api.cjs` (22 cenários) | Fluxo Netlify real ainda requer teste de prévia após publicação |
| D Dashboard inicial | TESTADO | `cliente/js/painel.js`, `cliente/cliente.css` | `/cliente` após login aprovado | Resume apenas os pedidos que a API atual devolve no período |
| E SEO, acessibilidade e responsividade | TESTADO | `sitemap.xml`, estilos novos, `tests/site-build.cjs`, `tests/visual.cjs` | Build + 5 larguras e navegação de teclado | Auditoria externa WCAG/Lighthouse não executada |
| F Catálogo avançado | ADIADO | `BACKLOG_CATALOGO.md` | Documento interno | Sem ativação ou PDF novo |
| G Visual/editorial | ADIADO | `BACKLOG_VISUAL.md` | Documento interno | Fotos/etapas/setores dependem de aprovação |
| Auditoria e substituição das imagens | TESTADO | `AUDITORIA_IMAGENS.md`, `assets/img/`, `index.html`, `en.html`, `es.html` | Home, produtos, consultoria, perfis e prévia social | Fotos de terceiros identificadas como ilustrativas; fotos próprias da empresa indisponíveis |
| Relatório e guia | IMPLEMENTADO | `RELATORIO_FINAL_E_TESTES.md`, `GUIA_RAPIDO_DE_TESTES.md` | Documentos desta pasta | Validação final do responsável |

## Testes executados

`node tools/build_site.cjs`, `node tests/site-build.cjs`, `node tests/cobertura.cjs`, `node tests/calculos.cjs`, `node tests/cliente-regras.cjs`, `node tests/cliente-api.cjs`, `node tests/expedicao-api.cjs`, `node --check` dos JS alterados, `git diff --check` e `tests/visual.cjs` em Electron isolado. Resultados e limites detalhados no relatório final.

## Como alimentar a fonte manual do mapa

Uma pessoa com acesso de escrita ao repositório e aprovação de negócio edita `netlify/functions/cobertura-dados.json` e acrescenta, por UF comprovada, `{ "uf": "SP", "confirmadoEm": "AAAA-MM-DD", "evidenciaInterna": "REFERENCIA-INTERNA" }`. A referência não deve conter nome, NF, endereço ou pedido. Revisão por Git registra a alteração; a função só publica `uf` e `dataReferencia`. Não há UFs cadastradas neste ciclo. A integração automática poderá substituir apenas a fonte da função, mantendo o contrato e a UI.
