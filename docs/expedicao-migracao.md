# Expedição: saída no Kuru, chegada pelo site

A entrada pública mostra somente **Sou cliente** (site da Parts Seals) e
**Interno**. Interno abre Consultar etiqueta, Entregas confirmadas e Despache;
o PIN e o controle de chegada permanecem como descrito abaixo. A explicação
da dupla conferência fica fora da entrada pública.

Há dois controles independentes:

1. **Saída da fábrica:** Acabamento > Expedição e Acabamento > Despachar,
   no Kuru Nuvem, continuam com o funcionamento existente.
2. **Chegada ao cliente:** o motorista abre
   https://parts-seals.com.br/expedicao e faz a Dupla conferência, lendo as
   NFs e o mesmo rastreio registrado na saída pelo Kuru.

O site não despacha, não cria baixas de expedição e não altera o status,
rastreio ou data do Fiscal. Entrega, coleta e criação de rotas de saída
foram retiradas do portal. As rotas HTTP antigas recusam a operação com
410, inclusive para páginas antigas que ainda estejam abertas.

## Ativar a dupla conferência

1. Execute `sql/150_expedicao_dupla_conferencia.sql` no Supabase. Pode
   repetir sem apagar dados; usa as tabelas de Fiscal/Expedição/avisos já
   existentes. Não precisa do SQL 149: ele foi substituído após o usuário
   esclarecer que o site deve confirmar a chegada, e não a saída. Se 149
   já foi aplicado, 150 revoga a RPC antiga sem apagar registros.
2. Atualize/reabra o Kuru para usar o controle e o processador novos. Evite
   encerramento forçado quando houver WhatsApp conectado.
3. Mantenha as permissões Expedição pelo celular e Confirmar entrega ao
   cliente, com os interruptores de consulta e de dupla conferência ligados
   em PCP > Tabula > Etiquetas > Expedição. Os IDs/chaves anteriores são
   reaproveitados, sem precisar conceder novamente as permissões.
4. Deixe a estação dos jobs aberta, com o remetente do WhatsApp conectado
   e o grupo de Expedição configurado para enviar os avisos de chegada.

## Como o motorista confere

Entre com o PIN, escaneie as NFs do pacote e depois o rastreio da saída.
Uma NF não cadastrada, cancelada ou sem saída com aquele rastreio é recusada.
Só os itens já saídos com o rastreio conferido são marcados como entregues;
itens ainda FATURADO e itens enviados com outro código ficam fora.
Repetir a conferência não duplica a entrega nem a mensagem e preserva quem
confirmou primeiro. Falha ao gravar a chegada, auditoria ou aviso desfaz a
transação inteira; a lista permanece para tentar novamente.

O registro fica em `expedicao_entregas`, separado das tabelas de saída.
Ele guarda NF, pedido, OP/item, cliente, rastreio, data da saída e data/nome
do motorista na chegada. Não converte despachos ou rotas antigos em entregas.
O aviso ao grupo tem o título **Entrega confirmada ao cliente**, com fila
própria e o mesmo envio com espaçamento do Kuru.

No site, **Entregas confirmadas** mostra o histórico, e **Consultar etiqueta**
permite ler o QR sem fazer nenhuma baixa. No Kuru, veja **Acabamento >
Entregas ao cliente**, com pesquisa e paginação. A consulta de expedição
passa a distinguir saída de chegada confirmada, por item.

## Câmera e campanhas

Code128/Code39 usam o leitor nativo ou ZXing 0.23.0 local, com licença em
`site-expedicao/vendor/zxing-LICENSE`. O QR de consulta usa jsQR local.
Também é possível usar leitor físico, digitação ou colagem. Fechar/ocultar
o leitor encerra a câmera. Não há consulta a CDN durante a leitura.

O portal acompanha o calendário do site: setembro amarelo, outubro rosa,
novembro azul e Natal verde/dourado, preservando claro/escuro e cores de
estado. Usa o mesmo calendário/assets do institucional; o sincronizador
extrai as paletas do CSS principal. Não há selo flutuante sobre os controles.

## Verificação isolada

`node scripts/test-expedicao-dupla-conferencia.cjs` verifica API e SQL em
PostgreSQL isolado, inclusive a preservação integral da saída.
`node scripts/test-dupla-conferencia-whatsapp.cjs` verifica o processador
sem enviar mensagens reais.
Em Electron isolado, rode `scripts/test-expedicao-dupla-conferencia-visual.cjs`,
`scripts/test-entregas-cliente-visual.cjs` e `scripts/test-expedicao-campanhas.cjs`.
Os testes do portal aceitam `../partsseals-site/expedicao` como argumento.
As configurações de produção não são usadas nesses testes.

## Publicação e histórico

`node scripts/sincronizar-expedicao-site.cjs` mantém o portal ativo
autossuficiente no projeto vizinho `partsseals-site`, cuja Netlify publica
o domínio principal. O site antigo de expedição continua redirecionando as
etiquetas antigas; não substituir esse redirecionador pela cópia autônoma.
Arquivos e registros das rotas anteriores permanecem como histórico; eles
não fazem parte do novo fluxo de confirmação de chegada.

## Build deste projeto

O portal fica em /expedicao e a função em netlify/functions/expedicao-api.
O build node tools/build_site.cjs reúne os arquivos públicos em dist e a
Netlify empacota a função à parte. As variáveis SUPABASE_URL,
SUPABASE_ANON_KEY e KURU_SEGREDO_SESSAO continuam apenas no servidor.
TABELA_ORDENS é opcional. As campanhas usam /js/campaign.js e os assets do
próprio institucional. Os códigos de QR anteriores continuam válidos.
