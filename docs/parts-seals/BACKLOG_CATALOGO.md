# Backlog — catálogo avançado (ADIADO)

Não há página pública nem geração de PDF nesta entrega. A biblioteca atual em `/materiais.html`, seu comparador e o seletor continuam sendo a fonte vigente.

## Arquitetura futura proposta

1. Curar no Kuru um catálogo versionado de **perfis oficiais**: código, família, aplicação, materiais permitidos, dimensões e revisões. Não reaproveitar descrições genéricas como regra de seleção de produto.
2. Disponibilizar leitura mínima por RPC/serviço server-side, com aprovação editorial de cada registro. O navegador só receberá os campos autorizados para a ficha em questão.
3. Guardar desenhos SVG dimensionais oficiais fora do diretório estático. Gerar a visualização por cotas do arquivo aprovado e versionado, com validação dos dados de entrada. Não derivar cotas de uma foto ou de um desenho ilustrativo.
4. Criar páginas de perfil e comparação somente após curadoria das fichas e análise de SEO, mantendo `/materiais.html` e links atuais.
5. Para PDF, emitir no servidor com marca d'água visível da Parts Seals e versão do conteúdo. O download exigirá sessão aprovada, URL temporária, limitação de uso e registro de auditoria. A marca d'água desencoraja redistribuição; não impede cópia, captura de tela ou vazamento.

## Contrato de dados sugerido

| Entidade | Campos essenciais | Permissão |
|---|---|---|
| `catalogo_perfis` | id, código único, família, aplicação, status editorial, revisão, validado_em | leitura pública apenas se aprovado; escrita da equipe autorizada |
| `catalogo_dimensoes` | perfil_id, nome da cota, unidade, valor/faixa, fonte, revisão | conforme o perfil; não expor dimensões proprietárias não liberadas |
| `catalogo_documentos` | id, perfil_id, tipo, hash, versão, nível de acesso, arquivo privado | somente metadados autorizados na API |
| `catalogo_auditoria` | usuário/empresa autorizados, perfil/documento, versão, horário, ação, resultado, origem | leitura somente administrativa; retenção definida pelo responsável |

Todas as tabelas privadas devem ter RLS e grants mínimos. A função server-side deve derivar o id do usuário do token validado, como `cliente-api` já faz, e verificar vínculo de empresa e status aprovado. Não aceitar usuário/empresa informados pelo navegador. O banco deve registrar a ação de geração/download de modo confiável; falha de auditoria impede entrega do PDF. A área administrativa precisa de filtro por período/usuário/documento e permissão própria.

## Telas e etapas futuras

1. Curadoria e autorização de fichas, cotas SVG e direitos de uso; definição do que é público e do que exige login.
2. Migration idempotente e reversível, RLS, auditoria e testes de isolamento.
3. Busca/catálogo por código, família, aplicação, material e dimensões, sem substituir o catálogo atual antes da aceitação.
4. Página de perfil e desenho cotado oficial, comparador de perfis e documentos aprovados.
5. Serviço de PDF com marca d'água, links temporários, rate limit e auditoria administrativa.
6. Revisão de segurança, UX, conteúdo e autorização comercial; somente então publicação.

## Critérios para liberar

- Todas as propriedades e cotas têm documento de origem, revisão e aprovador.
- Testes cobrem acesso negado, isolamento entre empresas, revogação, URL expirada, auditoria em sucesso/falha e rollback de migration.
- Nenhum PDF original ou SVG sigiloso está em `dist/` ou em URL permanente pública.
- Política de retenção/auditoria e texto LGPD foram aprovados.

**Dependências:** desenhos oficiais, conteúdo validado, autorização comercial, política de acesso e retenção, configuração de armazenamento privado. Sem esses itens, o catálogo e PDFs seguem adiados.
