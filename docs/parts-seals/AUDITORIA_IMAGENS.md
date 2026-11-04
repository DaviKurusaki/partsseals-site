# Auditoria das imagens do site — 03/11/2026

## Escopo e resultado

Foram conferidas as imagens visíveis da home PT/EN/ES, da biblioteca de materiais, da Área do Cliente e da entrada de Expedição, além dos arquivos de compartilhamento. As 11 cenas publicitárias anteriores em `assets/img/` (23 arquivos com versões JPG/WebP e a imagem social) apresentavam composição e iluminação típicas de imagem gerada e não possuíam origem fotográfica verificável. Foram retiradas da publicação e do repositório. Isso inclui o antigo visual da home, oito cards de produto, a consultoria e a galeria.

| Cena anterior (JPG + WebP, salvo indicação) | Uso anterior | Avaliação |
| --- | --- | --- |
| `hero-industrial` | Hero | Bancada encenada; sem fonte da fotografia |
| `manufacturing-gallery` | Raspadores e galeria | Máquinas e peças com composição artificial uniforme |
| `seals-components` | Gaxetas e galeria | Peças sem origem verificável |
| `technical-analysis` | Consultoria e galeria | Medição encenada; sem origem verificável |
| `product-aneis-guia` | Card Anéis guia | Cena de produto sem origem verificável |
| `product-dp-dh` | Card DP e DH | Cena de produto sem origem verificável |
| `product-backup-padroes` | Card back-up | Cena de produto sem origem verificável |
| `product-gaxetas-compactas` | Card gaxetas compactas | Cena de produto sem origem verificável |
| `product-pecas-tecnicas` | Card peças técnicas | Cena de produto sem origem verificável |
| `product-amostra-desenho` | Card por amostra/desenho | Cena de produto sem origem verificável |
| `product-vedacoes-pneumaticas` | Arquivo sem uso na home | Mesmo conjunto visual, removido para evitar reutilização |
| `og-parts-seals.jpg` | Compartilhamento social | Montagem baseada na cena anterior, substituída |

| Conjunto | Decisão | Onde aparece |
| --- | --- | --- |
| Fotografia de usinagem | Foto documental real de terceiro, marcada como ilustrativa | Hero PT/EN/ES e arte de compartilhamento |
| Fotografia de medição | Foto documental real de terceiro, marcada como ilustrativa | Consultoria técnica PT/EN/ES |
| Oito perfis vetoriais | Esquemas genéricos, sem escala e sem alegar retratar peça específica | Cards de produto e seção de perfis PT/EN/ES |
| 19 prévias WebP de datasheets | Mantidas: são páginas de documentos técnicos, não cenas fotográficas | Biblioteca de materiais |
| Logos, ícones PWA e versões das campanhas | Mantidos: identidade visual da empresa | Cabeçalho, rodapé, Área do Cliente, Expedição e metadados |

## Fotografias e licença

- `assets/img/foto-usinagem-ilustrativa.jpg`: [Daniel Smyth, Pexels, foto 10406128](https://www.pexels.com/photo/close-up-photo-of-metal-tool-10406128/). Câmera e data da captura estão na página do fotógrafo. O enquadramento mostra usinagem metálica; **não mostra a fábrica nem um produto Parts Seals**.
- `assets/img/foto-medicao-ilustrativa.jpg`: [Emirhan Çetin, Pexels, foto 38051238](https://www.pexels.com/photo/close-up-of-mechanic-using-digital-caliper-38051238/). Mostra medição de uma peça automotiva; **não mostra a equipe nem os produtos Parts Seals**.
- A [licença Pexels](https://www.pexels.com/license/) permite uso em sites e edição; proíbe sugerir endosso por marcas/pessoas retratadas. Por isso, os avisos visíveis e os textos alternativos as identificam como ilustrativas. O crédito é preservado aqui, embora a licença não o exija.
- `assets/img/og-parts-seals-real.jpg` combina a primeira foto e a logo da empresa, com a marcação “FOTO ILUSTRATIVA”. Tem 1200 × 630 px para prévia social.

## Perfis técnicos

`assets/img/perfis/` reúne oito esquemas de seções genéricas. Os SVGs são fontes editáveis; os PNGs de 1400 × 933 px derivados deles são publicados para renderização previsível em navegadores. A paleta vermelho/preto e a apresentação remetem ao catálogo técnico existente `assets/folder-parts-seals.pdf`; os desenhos **não são extrações de perfis oficiais nem fichas dimensionais**. A nota visível acima dos produtos informa que a geometria final depende da aplicação. O gerador dos SVGs é `tools/gerar_imagens_tecnicas.cjs`.

## Limite restante

O repositório e os arquivos locais pesquisados não contêm fotografias originais de produtos, processos ou pessoas da Parts Seals adequadas à publicação. O PDF institucional `assets/sobre-nos-parts-seals.pdf` possui uma fotografia da fachada, mas a imagem embutida é pequena e fortemente colorida, inadequada para ampliação profissional. A equipe confirmou não ter fotos disponíveis neste momento. Fotografias reais da própria empresa continuam pendentes; substituir as duas imagens ilustrativas e os esquemas quando houver arquivos com autoria, resolução e autorização verificáveis. Não foi criada galeria de fábrica ou de funcionários.
