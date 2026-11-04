# Guia rápido de testes — Parts Seals

**Antes de clicar:** estas mudanças estão no código, **ainda não no site público**. Use a prévia de implantação do repositório `partsseals-site` quando ela for criada; substitua somente o domínio nos endereços abaixo. Para a Central Técnica, entre com uma conta de teste aprovada no Kuru. Os números e nomes de entrada abaixo são **DEMO de teste**, não dados comerciais.

| O que testar | Onde clicar | O que fazer | Resultado esperado |
|---|---|---|---|
| Mapa | `/` → rolar até **Parts Seals pelo Brasil** (`/#brasil`) | Clicar numa UF; no celular pesquisar `SP` na lista | Nome, região e situação aparecem. Sem dados aprovados, mapa neutro e “Cobertura em atualização” |
| Regiões | Mapa → **Por região** | Escolher Sudeste | Lista mostra somente UFs dessa região; contador de atendidas deriva da fonte |
| Qualidade | Home → `/#qualidade` | Ler e abrir **Falar com o atendimento** | Orientação sem promessa técnica; abre o contato atual |
| Imagens | Home PT/EN/ES → topo, **Produtos**, **Consultoria** e **Perfis técnicos** | Conferir fotos, oito esquemas e legendas; abrir catálogo e links de orçamento | Duas fotografias reais com aviso “ilustrativa”; perfis sem escala; nenhuma cena artificial anterior |
| Dashboard | `/cliente/entrar` → `/cliente` | Entrar, ver resumo e clicar **Central Técnica** | Somente pedidos da conta; sem pedidos, cartões com zero e estado vazio; Central abre |
| Acesso negado | `/cliente/central` | Abrir sem login ou com cadastro pendente | Redireciona para Entrar ou mostra acesso indisponível |
| Espaço do alojamento | Central → **Espaço do alojamento** (`#c1`) | DEMO: alojamento `60`, eixo `50` | Diferença diametral 10 mm; espaço radial 5 mm; aviso de limite |
| Seção radial | Central → **Seção radial** (`#c2`) | DEMO: Ø externo `60`, Ø interno `50` | 5 mm; trocar por diâmetros invertidos mostra erro |
| Conversor | Central → **Conversor de unidades** (`#c3`) | DEMO: `25,4` mm para pol; depois copiar | 1 pol; resultado copiado; limpar apaga |
| Comparador | Central → **Comparador de materiais** (`#c4`) | Selecionar dois materiais | Atributos publicados aparecem lado a lado, ausentes como “não informado”, com link para a biblioteca |
| Compatibilidade | Central → **Compatibilidade química** (`#c5`) | DEMO: material `PTFE`, fluido `óleo` | “Sem dados suficientes para afirmar compatibilidade”; sem classificação inventada |
| Medição | Central → **Guia de medição** (`#c6`) | Avançar passos; DEMO: Ø interno `50`, externo `60`, altura `5`; copiar ficha | Passos mudam; ficha pessoal de texto, marcada como não oficial |
| Perfis | Central → **Seletor de perfis** (`#c7`) | DEMO: aplicação `Haste`, movimento `Alternativo`; montar resumo | Resumo copiável; nenhuma família indicada sem regra aprovada |
| Perguntas | Central → **Perguntas técnicas** (`#c8`) | Buscar `desenho` e abrir resposta | Resposta da FAQ existente; busca vazia avisa |
| Visuais | Central → **Conteúdos visuais** (`#c9`) | Filtrar uma categoria | Fichas existentes com link à biblioteca; nenhum vídeo fictício |
| Histórico | Calcular algo → marcar “Salvar…” → **Salvar consulta** → Histórico (`#c10`) | Reabrir, excluir item ou limpar tudo | Só o que foi salvo aparece neste navegador/conta; exclusão funciona |

O painel de expedição `/expedicao`, o login/cadastro e `/materiais.html` continuam pelos caminhos anteriores. O relatório final traz testes e pendências detalhados.
