# Área do Cliente (`/cliente`)

Clientes se cadastram no site, a equipe aprova no Kuru (Comercial > Site >
Cadastros de clientes) e, depois de aprovados, acompanham os pedidos da
empresa: situação, previsão, notas fiscais, rastreio e entrega.

O banco (tabelas e funções) é criado pelo Kuru, no arquivo
`sql/141_site_area_cliente.sql` daquele repositório. Este projeto não cria
tabela nem função: só chama as quatro funções abaixo.

## Como funciona

A entrada `/cliente` é um hub de ferramentas, disponível após a validação
do cadastro aprovado. A primeira ferramenta é **Status do meu pedido**,
que abre a consulta em `/cliente#pedidos`. O link **Todas as ferramentas**
retorna ao hub; empresa, período, busca e filtro são preservados durante
a navegação da sessão. Perfis em análise ou sem acesso mantêm suas telas
próprias e não consultam pedidos pelo hub.

Os seletores de empresa e período têm painel escuro, opção selecionada
identificada e suporte a setas, Home/End, Enter, Escape, Tab e digitação.
As opções usam apenas as empresas devolvidas pela API.

Todas as páginas da Área do Cliente carregam `js/campaign.js`, o mesmo do
site principal. Setembro Amarelo, Outubro Rosa, Novembro Azul e Natal
(dezembro) mudam automaticamente os destaques, botões e seletores; as
campanhas de conscientização também usam suas logos. Natal combina verde
com a logo vermelha original. A prévia aceita `?campanha=outubro-rosa`,
`novembro-azul`, `setembro-amarelo`, `natal` ou `nenhuma`. O selo flutuante
fica no site principal para não cobrir os formulários ou ferramentas.

Teste de interface sem rede e sem conta real: `tests/cliente-interface.cjs`.
Usa Happy DOM apenas no ambiente de teste, instalado fora do projeto;
`PS_HAPPY_DOM` aponta para o `lib/index.js` desse pacote. Não é dependência
da publicação. Esta alteração não exige SQL novo.

O acompanhamento mostra quatro passos: **Pedido recebido → Em produção →
Pronto → Despachado**. Os estados do banco `em_rota`, `com_transportadora`
e `entregue` aparecem como Despachado no site, inclusive nos itens, no resumo
e no filtro. `aguardando_retirada` continua em aberto até existir saída.
O método de entrega, as notas e o rastreio continuam disponíveis. Quando há
registro de recebimento, sua data e a pessoa que recebeu são exibidas como
recebimento; essa data não vira uma data de despacho. Esta mudança é apenas
de apresentação e não exige SQL novo.

### KPIs por pedido de compra (OC)

Os cartões mostram o número do cliente (`pedido_cliente`) como título:
`Pedido 6292`, sem exibir a requisição interna `28227`. A busca usa somente
o número do cliente. Quando ele não está informado, o título é **Pedido
sem número informado**; não usa o número interno como substituto. Zeros
iniciais são preservados. Datas, itens e acompanhamento mantêm os vínculos
internos existentes.

**Correção do banco (03/11/2026):** executar no Supabase o
`sql/144_site_pedido_cliente_integral.sql` do Kuru, após o 143. A função antiga
descartava o número quando coincidia com parte da requisição ou continha
REP, mesmo com a coluna PEDIDO preenchida. O 144 preserva `30914(P.I)`,
`30913 EST`, `30984(PV)`, `REP 30955` e números iguais à requisição. Esses
valores também devem participar dos KPIs e da busca. Não remove sufixos,
não altera cadastros e mantém a consulta otimizada. Os SQLs 141–143 do Kuru
também foram corrigidos para instalações futuras. Para o banco já instalado,
aplicar o 144; atualizar os arquivos do site sozinho não corrige essa função.

Os KPIs contam a OC (`pedido_cliente` da API), uma vez por empresa e período.
Várias requisições ou itens da mesma OC não multiplicam os totais. Se uma
requisição ainda está em produção, a OC fica em produção; se todas passaram
dessa fase, mas alguma aguarda retirada, fica aguardando retirada; Despachado
exige que todas tenham saído. O mesmo número de OC em empresas diferentes
continua sendo contado separadamente.

Requisições sem OC não recebem um número de compra inventado: continuam na
listagem, mas ficam fora dos KPIs, com a quantidade informada abaixo deles.

Diagnóstico somente de leitura em 03/11/2026: a Usina Sertãozinho tem um
registro com previsão de 03/03/2026, já despachado. Fica fora de Últimos 6
meses e do filtro Em aberto. Último ano + Todos ou Despachado mostra o
registro; cadastro, vínculo e nome usados nas ordens estão corretos. A tela
vazia explica o período e os filtros, sem ampliar consultas automaticamente.

```text
navegador ── /cliente/api/* ──> função Netlify cliente-api ──┬─> Supabase Auth        (chave anon)
   (cookies HttpOnly)                                         └─> 4 funções site_cliente_* (service_role)
```

- Páginas: `/cliente` (painel), `/cliente/entrar`, `/cliente/cadastro` e
  `/cliente/nova-senha` (destino do link de nova senha). Arquivos em
  `cliente/`; todas com `noindex` e fora do `sitemap.xml`.
- API: `netlify/functions/cliente-api/`.
  - `supabase-auth.cjs`: cadastro, entrar, renovar, usuário, sair, recuperar
    e trocar senha no Supabase Auth, **só com a chave anon**.
  - `supabase-servico.cjs`: o **único** lugar com a service_role. Só chama
    `site_cliente_registrar`, `site_cliente_meu_cadastro`,
    `site_cliente_registrar_acesso` e `site_cliente_meus_pedidos` (lista fixa;
    qualquer outro nome é recusado) e apaga usuário órfão do Auth.
  - `validacao.cjs`: regras do cadastro (CNPJ com dígitos verificadores,
    e-mail, WhatsApp com DDD, nome com sobrenome, idade de 16 a 100 anos,
    senha de 8 a 72 caracteres, aceite da política).
- A expedição (`expedicao-api`) continua com a anon e nunca importa a
  service_role (há teste que confere isso).

### Sessão

- `access_token` e `refresh_token` do Supabase Auth ficam em cookies
  `HttpOnly; Secure; SameSite=Lax; Path=/cliente` (`ps_cli_at`, `ps_cli_rt`).
  Nada vai para `localStorage`.
- Toda chamada autenticada confere o token em `/auth/v1/user` e usa o id do
  token como `p_auth_user_id`. Id vindo do navegador é ignorado.
- Token vencido é renovado com o refresh token, sem o cliente perceber.
- `ps_cli_ua` guarda o horário do último registro de acesso: o
  `site_cliente_registrar_acesso` roda no máximo uma vez por hora.
- POST exige o cabeçalho `X-Cliente: 1` (fecha CSRF junto com o SameSite).

### Cadastro

1. Valida tudo no servidor, mais um campo isca escondido e um tempo mínimo de
   preenchimento de 3 segundos (contra robôs).
2. `POST /auth/v1/signup` (e-mail + senha, com confirmação de e-mail).
3. `site_cliente_registrar` com o id do Auth. O aceite da política é gravado
   pelo banco com a data e a hora do registro (`consentimento_lgpd_em`).
4. Se o registro falhar, confere com `site_cliente_meu_cadastro` se o login já
   tinha cadastro. Só apaga o login do Auth quando o banco confirma que não
   tinha: nunca apaga a conta de quem já estava cadastrado e clicou duas vezes.
5. E-mail que já existe recebe a mensagem neutra "Se este e-mail já tiver
   cadastro, use Entrar ou Esqueci minha senha".

Limite de tentativas: são os do próprio Supabase Auth (Authentication > Rate
Limits). Não há tabela de tentativas própria.

## Variáveis de ambiente (Netlify)

Site configuration > Environment variables, com escopo **Functions**:

| Variável | Para quê |
|---|---|
| `SUPABASE_URL` | já existe (expedição) |
| `SUPABASE_ANON_KEY` | já existe; aqui só para o Supabase Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | **nova**. Só para as 4 funções e a exclusão de órfão |
| `SITE_CLIENTE_URL` | opcional; padrão `https://parts-seals.com.br/cliente` (base dos links dos e-mails) |

A `SUPABASE_SERVICE_ROLE_KEY` ignora todas as regras do banco. Ela fica
**somente** na Netlify, no escopo Functions (nunca Builds, nunca em arquivo,
commit ou HTML). Sem ela, a API responde "A Área do Cliente ainda não foi
configurada" e a expedição segue funcionando normalmente.

## Configuração do Supabase Auth

1. **Authentication > Sign In / Providers > Email**: ligado, com
   **Confirm email** ligado.
2. **Authentication > URL Configuration**:
   - Site URL: `https://parts-seals.com.br/cliente`
   - Redirect URLs: `https://parts-seals.com.br/cliente/entrar` e
     `https://parts-seals.com.br/cliente/nova-senha` (para testar uma prévia
     da Netlify, acrescente as URLs da prévia).
3. **Authentication > Emails > Templates**, em português, por exemplo:
   - *Confirm signup* — assunto "Confirme seu e-mail — Área do Cliente Parts
     Seals"; corpo: "Olá! Para concluir seu cadastro na Área do Cliente da
     Parts Seals, confirme seu e-mail: `{{ .ConfirmationURL }}`. Depois disso,
     nossa equipe confere os dados e libera seu acesso."
   - *Reset password* — assunto "Criar nova senha — Área do Cliente Parts
     Seals"; corpo: "Recebemos um pedido para criar uma nova senha. Para
     continuar, abra: `{{ .ConfirmationURL }}`. Se não foi você, ignore este
     e-mail."
4. Para enviar e-mail de verdade em produção, configure um SMTP próprio em
   **Authentication > Emails > SMTP Settings** (o SMTP de teste do Supabase
   tem limite baixo por hora).

O link de confirmação volta para `/cliente/entrar` (a página mostra "E-mail
confirmado") e o de nova senha para `/cliente/nova-senha`, que lê o token do
fragmento da URL, limpa a barra de endereço e chama `/cliente/api/nova-senha`.

## Roteiro de teste ponta a ponta com o Kuru

Pré-requisitos: `sql/141_site_area_cliente.sql` aplicado no Supabase, as
variáveis acima na Netlify e o Supabase Auth configurado.

1. Abra `https://parts-seals.com.br/cliente/cadastro` no celular e cadastre
   um contato de teste com o CNPJ de um cliente real.
2. Confirme o e-mail pelo link recebido. Entre em `/cliente/entrar`: o painel
   mostra "Seu cadastro está em análise" e nenhum pedido.
3. No Kuru, abra Comercial > Site > Cadastros de clientes. O cadastro aparece
   em Pendentes; confira a sugestão de vínculo pelo CNPJ (rode antes
   "Importar clientes do ARGUS" se a lista estiver vazia) e clique Aprovar.
4. O contato recebe o WhatsApp de acesso liberado (sai pelo WhatsApp do
   Pós-venda, no PC da estação de jobs).
5. Recarregue `/cliente`: aparece "Olá, {nome}" com os pedidos do cliente.
   Confira o resumo, a busca, os filtros, o período, a linha do tempo, NF,
   rastreio e os itens.
6. No Kuru, bloqueie o cadastro e recarregue: a tela muda para "Acesso
   indisponível" e nenhum pedido aparece. Reative para voltar.
7. Teste "Esqueci minha senha" e a troca de senha pelo link do e-mail.

## Testes locais (sem banco real)

```text
node tools/build_site.cjs
node tests/site-build.cjs
node tests/expedicao-api.cjs
node tests/cliente-api.cjs
node tests/cliente-regras.cjs
```

`tests/cliente-api.cjs` simula o Supabase Auth e as quatro funções: cadastro
válido e inválidos, e-mail repetido sem login órfão, órfão apagado quando o
registro falha, telas de pendente/recusado/bloqueado sem pedidos, pedidos
pelo id do token, cookie inválido, renovação automática, limite de 730 dias e
o uso da service_role só onde é permitido.
