# Google Analytics 4 — configuração e relatórios

O site já está preparado para o GA4 (gratuito). Falta só criar a conta e colar o
ID de medição. Enquanto o ID estiver vazio, nada é carregado e nenhum aviso de
cookies aparece. Publicar antes de ter o ID não causa problema.

## O que já está pronto no site

| Item | Onde |
|---|---|
| Script do GA4, carregado **só depois do "Aceitar"** | `js/analytics.js` |
| Aviso de cookies (PT/EN/ES) e link "Preferências de cookies" no rodapé | `js/analytics.js` + `css/style.css` |
| CSP liberando apenas os domínios do Google Analytics | `<meta http-equiv="Content-Security-Policy">` de cada página |
| Política de Privacidade atualizada (seções 2, 3, 4, 5, 6 e 7) | `politica-de-privacidade.html`, `privacy.html`, `privacidad.html` |
| `/expedicao` **não** é medido | regra no `js/analytics.js` |

Eventos enviados automaticamente:

| Evento | Quando | Parâmetros |
|---|---|---|
| `page_view` | cada página aberta | página, idioma |
| `generate_lead` | clique em qualquer link de WhatsApp | `method`, `link_location` (cabecalho, rodape, botao_flutuante, pagina), `product` |
| `clique_whatsapp` | igual ao acima (nome em português, para facilitar a leitura) | idem |
| `clique_telefone` | clique em `tel:` | `link_location` |
| `clique_email` | clique em `mailto:` | `link_location`, `email_to` |
| `file_download` | clique em PDF (folder, "Sobre nós") | `file_name` |

Além disso, o GA4 já mede sozinho rolagem, cliques de saída e tempo de engajamento
(“Medição otimizada”, ligada por padrão).

## Passo a passo (uma vez só, ~15 minutos)

### 1. Criar a conta e a propriedade

1. Acesse <https://analytics.google.com> com a conta Google da empresa
   (de preferência uma conta da Parts Seals, não pessoal).
2. **Começar a medir** → Nome da conta: `Parts Seals`.
3. Propriedade: nome `parts-seals.com.br`, fuso horário **(GMT-03:00) Brasil – São Paulo**,
   moeda **Real brasileiro (R$)**. Isso é importante: os relatórios por hora usam esse fuso.
4. Detalhes da empresa: setor “Industrial e manufatura”, tamanho real da empresa.
5. Objetivos: marque **“Gerar leads”** e **“Entender o tráfego da Web”**.
6. Plataforma: **Web** → URL `https://parts-seals.com.br`, nome `Site Parts Seals`.
   Deixe a **Medição otimizada** ligada.
7. Copie o **ID da métrica** (formato `G-XXXXXXXXXX`).

### 2. Colar o ID no site

Em `js/analytics.js`, troque:

```js
var GA_MEASUREMENT_ID = '';
```

por:

```js
var GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';
```

Faça o commit e publique na Netlify. (Ou mande o ID para o Claude fazer isso.)

> Não use a opção “Instalar manualmente” que o Google mostra (o bloco `<script>` com
> gtag). O site já faz isso pelo `js/analytics.js`, respeitando o consentimento.
> Colar o bloco do Google no HTML seria bloqueado pela CSP e ignoraria o aviso de cookies.

### 3. Ajustes recomendados no painel (Administrador ⚙️)

1. **Coleta e modificação de dados → Retenção de dados** → *Retenção de dados de eventos*:
   **14 meses** (o padrão é 2 meses, o que limita as análises anuais). A política de
   privacidade já informa 14 meses.
2. **Coleta e modificação de dados → Coleta de dados** → deixe **Sinais do Google
   desativado** (o site também desliga pelo código; a política diz que não usamos).
   Ali mesmo, em *Coleta de dados granulares de localização e dispositivo*, deixe
   **ativado** — sem isso o GA4 não mostra **cidade**.
3. **Exibição de dados → Eventos** → depois que o evento `generate_lead` aparecer
   (até 24 h após o primeiro clique no WhatsApp), marque a estrela **“Marcar como evento-chave”**.
   Faça o mesmo com `clique_telefone` e `clique_email` se quiser contá-los como contatos.
4. **Coleta e modificação de dados → Fluxos de dados → Site Parts Seals →
   Configurar definições da tag → Listar referências indesejadas**: adicione
   `wa.me` e `api.whatsapp.com`, para que a volta do WhatsApp não vire “nova origem”.
5. **Exibição de dados → Definições personalizadas → Criar dimensão personalizada**
   (escopo *Evento*): `link_location` e `product`. Assim os relatórios mostram de qual
   botão e de qual produto veio cada clique no WhatsApp.
6. **Contas → Gerenciamento de acesso**: adicione quem mais deve ver os números
   (papel “Leitor”).

### 4. Conferir se está funcionando

1. Abra o site numa aba anônima, clique **Aceitar** no aviso.
2. No GA4: **Relatórios → Tempo real**. Você deve aparecer em segundos, com a cidade.
3. Clique no WhatsApp do site e veja `generate_lead` aparecer no cartão de eventos do Tempo real.

## Onde ver cada número

| Pergunta | Onde no GA4 |
|---|---|
| Quem está no site **agora** e de onde | **Relatórios → Tempo real** (últimos 30 min, com mapa e cidade) |
| Acessos e pessoas **por dia / semana / mês** | **Relatórios → Visão geral dos relatórios** (gráfico “Usuários”); mude o período no canto superior direito e use “Comparar” para mês contra mês |
| Acessos **por hora do dia** | **Explorar → Em branco** → Dimensões: `Hora` (e `Dia da semana`) → Métricas: `Usuários ativos`, `Sessões`, `Visualizações` → Técnica “Forma livre”, `Hora` em Linhas. Para ver o padrão hora × dia, coloque `Dia da semana` em Colunas (vira um mapa de calor) |
| **Regiões**: país, estado, cidade | **Relatórios → Usuário → Atributos do usuário → Detalhes demográficos** → troque a dimensão de “País” para **“Região”** (estado) ou **“Cidade”** |
| De onde vieram (Google, direto, LinkedIn…) | **Relatórios → Ciclo de vida → Aquisição → Aquisição de tráfego** |
| Páginas mais vistas e idioma (PT/EN/ES) | **Relatórios → Engajamento → Páginas e telas** |
| Quantos cliques no WhatsApp / telefone / e-mail | **Relatórios → Engajamento → Eventos** (`generate_lead`, `clique_*`) e **Eventos-chave** |
| Celular x computador | **Relatórios → Tecnologia → Visão geral da tecnologia** |

Termos do GA4: **Usuários** ≈ pessoas diferentes; **Sessões** ≈ acessos (visitas);
**Visualizações** = páginas abertas.

### Painel pronto (opcional, gratuito)

Para um painel único com tudo (visitantes por dia/mês, mapa por estado e cidade,
gráfico por hora, cliques no WhatsApp) que pode ser compartilhado por link:
<https://lookerstudio.google.com> → **Criar → Relatório → Google Analytics** → escolha a
propriedade `parts-seals.com.br`. Também é possível receber por e-mail um resumo semanal
(no Looker Studio: *Compartilhar → Programar entrega*).

O app **Google Analytics** para celular (Android/iOS) mostra Tempo real e os relatórios.

## Limitações a conhecer

- **Só conta quem clica em “Aceitar”.** Quem recusa ou ignora o aviso não aparece.
  Isso é exigência da LGPD para cookies de estatística. Na prática, os números do GA4
  ficam abaixo do total real de visitas; use-os para tendências e comparações.
- **Não há histórico retroativo.** A contagem começa no dia em que o ID for publicado.
- **Localização é aproximada** (estimada pelo IP). Acessos por rede móvel ou VPN
  costumam aparecer na cidade da operadora (ex.: São Paulo). Com poucos acessos, o GA4
  pode agrupar cidades como “(not set)”.
- Os relatórios padrão podem levar **24–48 h** para consolidar; o Tempo real é imediato.

## Se precisar desligar

Volte `GA_MEASUREMENT_ID` para `''` e publique. O aviso some e nada mais é coletado.
Lembre de ajustar a Política de Privacidade (seções 2 a 7) nos três idiomas.
