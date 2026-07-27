# Biblioteca protegida de datasheets

Os PDFs originais ficam em `_originais/` e não são publicados no repositório.
As cópias PDF com marca d'água ficam em `_protegidos_pdf/`, também fora da
publicação. O site exibe somente páginas rasterizadas e marcadas em
`assets/datasheets-view/`.

Para adicionar um novo documento:

1. Coloque o PDF diretamente em `assets/DataSheets/`.
2. Execute `python tools/build_datasheets.py`.
3. Cadastre a nova ficha na página de materiais.

O processo move o original para a área privada local, aplica a marca d'água
repetida da Parts Seals e gera imagens WebP para o visualizador do site.
