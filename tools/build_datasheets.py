from __future__ import annotations

import io
import json
import shutil
import unicodedata
from pathlib import Path

import fitz
from PIL import Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = (ROOT / "assets" / "DataSheets").resolve()
SOURCE_DIR = (DATA_DIR / "_originais").resolve()
PROTECTED_DIR = (DATA_DIR / "_protegidos_pdf").resolve()
WEB_DIR = (ROOT / "assets" / "datasheets-view").resolve()
LOGO_PATH = (ROOT / "assets" / "logo.png").resolve()

RED = colors.HexColor("#cf1f2d")
DARK = colors.HexColor("#151922")
MUTED = colors.HexColor("#5f6670")
LIGHT = colors.HexColor("#f3f4f6")


def assert_in_workspace(path: Path) -> None:
    path.resolve().relative_to(ROOT)


for directory in (DATA_DIR, SOURCE_DIR, PROTECTED_DIR, WEB_DIR):
    assert_in_workspace(directory)
    directory.mkdir(parents=True, exist_ok=True)


def normalized(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return " ".join(ascii_value.lower().replace("_", " ").split())


def migrate_new_pdfs() -> None:
    for pdf_path in DATA_DIR.glob("*.pdf"):
        destination = SOURCE_DIR / pdf_path.name
        assert_in_workspace(pdf_path)
        assert_in_workspace(destination)
        if destination.exists():
            raise FileExistsError(
                f"Já existe um original com o nome {destination.name}. "
                "Renomeie o novo arquivo antes de processar."
            )
        shutil.move(str(pdf_path), str(destination))


def register_fonts() -> tuple[str, str]:
    regular_candidates = [
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/calibri.ttf"),
    ]
    bold_candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf"),
        Path("C:/Windows/Fonts/calibrib.ttf"),
    ]
    regular = next((path for path in regular_candidates if path.exists()), None)
    bold = next((path for path in bold_candidates if path.exists()), None)
    if regular and bold:
        pdfmetrics.registerFont(TTFont("PartsRegular", str(regular)))
        pdfmetrics.registerFont(TTFont("PartsBold", str(bold)))
        return "PartsRegular", "PartsBold"
    return "Helvetica", "Helvetica-Bold"


FONT_REGULAR, FONT_BOLD = register_fonts()


REFERENCE_SHEETS = [
    {
        "filename": "Ficha Técnica de Referência - PTFE Virgem - Parts Seals 2026.pdf",
        "title": "PROPRIEDADES DO PTFE VIRGEM",
        "subtitle": "Politetrafluoretileno não aditivado",
        "description": (
            "Material de baixíssimo atrito, elevada inércia química e ampla faixa térmica. "
            "Indicado para anéis de vedação, sedes, back-ups, guias e componentes em contato "
            "com fluidos agressivos."
        ),
        "properties": [
            ("Densidade", "2,15 g/cm³", "DIN EN ISO 1183"),
            ("Resistência à tração", "22 MPa", "ASTM D 4894"),
            ("Alongamento na ruptura", "220%", "ASTM D 4894"),
            ("Resistência à compressão", "5 MPa a 1% de deformação", "ASTM D 695"),
            ("Dureza", "55 Shore D", "ASTM D 2240"),
            ("Temperatura de serviço", "Até 260 °C, curta e longa duração", "Referência do grau"),
            ("Condutividade térmica", "0,20 W/(m·K)", "ASTM C 177"),
            ("Absorção de água", "0,01%", "ASTM D 570"),
        ],
        "applications": "Anéis de vedação, sedes de válvula, back-ups, buchas, guias e isoladores.",
        "source": "Ensinger - TECAFLON PTFE natural",
        "source_url": "https://www.ensingerplastics.com/en-gb/shapes/tecaflon-ptfe-natural",
    },
    {
        "filename": "Ficha Técnica de Referência - PTFE Grafite - Parts Seals 2026.pdf",
        "title": "PROPRIEDADES DO PTFE COM GRAFITE",
        "subtitle": "Referência para composto com aproximadamente 15% de grafite",
        "description": (
            "Composto de PTFE com maior condutividade térmica e comportamento de atrito "
            "aprimorado. Indicado para componentes deslizantes, especialmente quando a "
            "superfície contraposta não deve receber uma carga muito abrasiva."
        ),
        "properties": [
            ("Densidade", "2,14 g/cm³", "DIN EN ISO 1183-1"),
            ("Absorção de água", "0,05%", "DIN EN ISO 62"),
            ("Tensão de escoamento", "16 MPa", "DIN EN ISO 527"),
            ("Alongamento na ruptura", "180%", "DIN EN ISO 527"),
            ("Condutividade térmica", "0,75 W/(m·K)", "DIN 52612-2"),
            ("Temperatura de serviço", "260 °C contínua / 300 °C curta", "Referência do grau"),
            ("Flamabilidade", "V-0 a 3 mm", "UL 94"),
            ("Resistividade volumétrica", "10⁷ Ω·cm", "IEC 60093"),
        ],
        "applications": "Anéis de vedação, juntas, sedes, buchas e componentes de deslizamento.",
        "source": "Amsler & Frey AG - PTFE 15% Graphite",
        "source_url": "https://www.shop.amsler-frey.ch/en?category=54&cmd=generate_datasheet",
    },
    {
        "filename": "Ficha Técnica de Referência - PTFE Molibdenio - Parts Seals 2026.pdf",
        "title": "PROPRIEDADES DO PTFE COM MOLIBDÊNIO",
        "subtitle": "Referência para composto com 3% de dissulfeto de molibdênio - MoS2",
        "description": (
            "A adição de MoS2 reforça o PTFE, reduz o atrito e melhora resistência ao "
            "desgaste, compressão e fluência. É aplicada especialmente em movimentos "
            "dinâmicos secos ou intermitentes."
        ),
        "properties": [
            ("Densidade", "2,20 a 2,25 g/cm³", "ASTM D 792"),
            ("Absorção de água", "0,03%", "ASTM D 570"),
            ("Resistência à tração", "≥ 25 MPa", "ASTM D 4745"),
            ("Alongamento", "≥ 250%", "ASTM D 4745"),
            ("Dureza", "≥ 55 Shore D", "ASTM D 2240"),
            ("Deformação sob carga", "9 a 12%", "ASTM D 621"),
            ("Coeficiente de atrito", "0,08-0,10 estático / 0,06-0,08 dinâmico", "ASTM D 1894"),
            ("Condutividade térmica", "0,25 W/(m·K)", "ASTM C 177"),
        ],
        "applications": "Vedações dinâmicas, buchas, guias e peças para movimento seco ou intermitente.",
        "source": "Diflon Technology - PTFE 3% MoS2",
        "source_url": "https://www.diflon.it/en/products/virgin-ptfe/ptfe-materials/3-percent-mos2",
    },
    {
        "filename": "Ficha Técnica de Referência - PEAD - Parts Seals 2026.pdf",
        "title": "PROPRIEDADES DO PEAD",
        "subtitle": "Polietileno de alta densidade - PE 300",
        "description": (
            "Termoplástico leve, tenaz e de baixa absorção de umidade, com excelente "
            "resistência química e boa usinabilidade para componentes de baixa e média carga."
        ),
        "properties": [
            ("Densidade", "0,96 g/cm³", "Referência do grau"),
            ("Resistência à tração na ruptura", "25 MPa", "ASTM D 638"),
            ("Alongamento na ruptura", "50%", "ASTM D 638"),
            ("Dureza", "64 Shore D", "ASTM D 2240"),
            ("Resistência à compressão", "27 MPa", "ASTM D 695"),
            ("Módulo de flexão", "2.060 MPa", "ASTM D 790"),
            ("Temperatura de serviço", "-50 a +80 °C", "Referência do grau"),
            ("Absorção de água", "0,03 a 0,04%", "ASTM D 570"),
        ],
        "applications": "Guias, espaçadores, placas de desgaste, buchas leves e componentes químicos.",
        "source": "Ensinger Brasil - TECAFINE PE 300 natural",
        "source_url": "https://www.ensingerplastics.com/pt-br/semiacabados/produtos/tecafine-pe-natural",
    },
    {
        "filename": "Ficha Técnica de Referência - Celeron - Parts Seals 2026.pdf",
        "title": "PROPRIEDADES DO CELERON",
        "subtitle": "Laminado fenólico com tecido de algodão - referência NEMA C",
        "description": (
            "Compósito laminado para aplicações mecânicas e estruturais. Possui boa "
            "usinabilidade, resistência ao impacto e comportamento favorável em buchas, "
            "guias e componentes sujeitos a desgaste."
        ),
        "properties": [
            ("Densidade relativa", "1,37", "ASTM D 792"),
            ("Dureza", "100 Rockwell M", "ASTM D 785"),
            ("Absorção de umidade", "3,50%", "ASTM D 570"),
            ("Resistência à flexão", "124,1 / 117,2 MPa (L/T)", "ASTM D 790"),
            ("Módulo de flexão", "11,0 / 10,3 GPa (L/T)", "ASTM D 790"),
            ("Resistência à tração", "82,7 / 66,9 MPa (L/T)", "ASTM D 638"),
            ("Resistência à compressão", "234,4 MPa, perpendicular", "ASTM D 695"),
            ("Resistência ao cisalhamento", "96,5 MPa", "ASTM D 732"),
        ],
        "applications": "Engrenagens, polias, roletes, guias, buchas, mancais e isoladores mecânicos.",
        "source": "Norplex-Micarta - NP310 Technical Data Bulletin",
        "source_url": "https://www.norplex-micarta.com/wp-content/uploads/2017/07/TDB_NP310.pdf",
    },
    {
        "filename": "Ficha Técnica de Referência - PA6 - Parts Seals 2026.pdf",
        "title": "PROPRIEDADES DO NYLON PA6",
        "subtitle": "Poliamida 6 natural",
        "description": (
            "Poliamida de engenharia com alta tenacidade, boa resistência mecânica, "
            "amortecimento de impacto e resistência à abrasão. A absorção de umidade deve "
            "ser considerada no dimensionamento."
        ),
        "properties": [
            ("Densidade", "1,14 g/cm³", "Referência do grau"),
            ("Resistência à tração", "70 MPa", "ASTM D 638"),
            ("Alongamento na ruptura", "40%", "ASTM D 638"),
            ("Módulo de tração", "2.800 MPa", "ASTM D 638"),
            ("Resistência à compressão", "81 MPa", "ASTM D 695"),
            ("Dureza", "72 Shore D", "ASTM D 2240"),
            ("Temperatura de serviço", "100 °C contínua / 160 °C curta", "Referência do grau"),
            ("Absorção de água", "1,00 a 2,02%", "ASTM D 570"),
        ],
        "applications": "Buchas, roldanas, engrenagens, guias, anéis de apoio e raspadores rígidos.",
        "source": "Ensinger Brasil - TECAMID 6 natural",
        "source_url": "https://www.ensingerplastics.com/pt-br/semiacabados/pa6-tecamid-6-natural",
    },
    {
        "filename": "Ficha Técnica de Referência - PA66 - Parts Seals 2026.pdf",
        "title": "PROPRIEDADES DO NYLON PA66",
        "subtitle": "Poliamida 6.6 natural",
        "description": (
            "Poliamida de maior rigidez e dureza, com boa estabilidade térmica e resistência "
            "ao desgaste. A absorção de umidade pode alterar dimensões e deve ser avaliada."
        ),
        "properties": [
            ("Densidade", "1,15 g/cm³", "Referência do grau"),
            ("Resistência à tração", "86 MPa", "ASTM D 638"),
            ("Alongamento na ruptura", "30%", "ASTM D 638"),
            ("Módulo de tração", "3.200 MPa", "ASTM D 638"),
            ("Resistência à compressão", "99 MPa", "ASTM D 695"),
            ("Dureza", "80 Shore D", "ASTM D 2240"),
            ("Temperatura de serviço", "100 °C contínua / 170 °C curta", "Referência do grau"),
            ("Absorção de água", "0,57 a 1,09%", "ASTM D 570"),
        ],
        "applications": "Guias, buchas, engrenagens, arruelas, anéis de apoio e componentes rígidos.",
        "source": "Ensinger Brasil - TECAMID 66 natural",
        "source_url": "https://www.ensingerplastics.com/pt-br/semiacabados/pa66-tecamid-66-natural",
    },
    {
        "filename": "Ficha Técnica de Referência - PEEK - Parts Seals 2026.pdf",
        "title": "PROPRIEDADES DO PEEK",
        "subtitle": "Poli-éter-éter-cetona não aditivado",
        "description": (
            "Termoplástico de alto desempenho para temperatura, carga e ambientes químicos "
            "severos, com elevada estabilidade dimensional e resistência à fluência."
        ),
        "properties": [
            ("Densidade", "1,31 g/cm³", "Referência do grau"),
            ("Resistência à tração", "116 MPa", "DIN EN ISO 527-2"),
            ("Alongamento na ruptura", "15%", "DIN EN ISO 527-2"),
            ("Resistência à flexão", "175 MPa", "DIN EN ISO 178"),
            ("Módulo de flexão", "4.200 MPa", "DIN EN ISO 178"),
            ("Dureza", "89 Shore D", "DIN EN ISO 868"),
            ("Temperatura de serviço", "260 °C contínua / 300 °C curta", "Referência do grau"),
            ("Absorção de água", "0,02 a 0,03%", "DIN EN ISO 62"),
        ],
        "applications": "Back-ups, sedes de válvula, anéis de pistão, bombas e compressores.",
        "source": "Ensinger Brasil - TECAPEEK natural",
        "source_url": "https://www.ensingerplastics.com/pt-br/semiacabados/peek-tecapeek-natural",
    },
]


DOC_SPECS = [
    ("poliacetal - dados tecnicos", "poliacetal-dados", "Poliacetal - dados técnicos", "Ficha técnica"),
    ("bronze", "ptfe-bronze", "PTFE com bronze", "Certificado de inspeção"),
    ("fibra de carbono", "ptfe-carbono", "PTFE com fibra de carbono", "Certificado de inspeção"),
    ("fibra de vidro", "ptfe-vidro", "PTFE com fibra de vidro", "Certificado de inspeção"),
    ("viton", "fkm-viton", "FKM / Viton", "Certificado de inspeção"),
    ("propriedades nbr", "nbr", "NBR", "Certificado de qualidade"),
    ("polioximetileno", "pom-certificado", "POM / Polioximetileno", "Certificado de inspeção"),
    ("poliuretano", "poliuretano", "Poliuretano", "Certificado de inspeção"),
    ("technyl", "technyl", "Technyl PA6 / PA66", "Certificado de qualidade"),
    ("ptfe virgem", "ptfe-virgem", "PTFE virgem", "Ficha técnica de referência"),
    ("ptfe grafite", "ptfe-grafite", "PTFE com grafite", "Ficha técnica de referência"),
    ("ptfe molibdenio", "ptfe-molibdenio", "PTFE com molibdênio", "Ficha técnica de referência"),
    ("pead", "pead", "PEAD", "Ficha técnica de referência"),
    ("celeron", "celeron", "Celeron", "Ficha técnica de referência"),
    ("referencia - pa6 -", "pa6", "Nylon PA6", "Ficha técnica de referência"),
    ("referencia - pa66 -", "pa66", "Nylon PA66", "Ficha técnica de referência"),
    ("peek", "peek", "PEEK", "Ficha técnica de referência"),
]


def wrap_paragraph(text: str, style: ParagraphStyle, width: float, height: float) -> Paragraph:
    paragraph = Paragraph(text, style)
    paragraph.wrap(width, height)
    return paragraph


def create_reference_sheet(spec: dict, output_path: Path) -> None:
    width, height = A4
    pdf = canvas.Canvas(str(output_path), pagesize=A4)
    pdf.setTitle(spec["title"].title())
    pdf.setAuthor("Parts Seals Vedações Industriais")
    pdf.setSubject("Ficha técnica de referência de material")

    pdf.setFillColor(DARK)
    pdf.rect(0, height - 13 * mm, width, 13 * mm, fill=1, stroke=0)
    pdf.setFillColor(RED)
    pdf.rect(0, height - 16 * mm, width, 3 * mm, fill=1, stroke=0)
    pdf.drawImage(str(LOGO_PATH), 18 * mm, height - 35 * mm, width=50 * mm, height=14 * mm, mask="auto", preserveAspectRatio=True)

    pdf.setStrokeColor(RED)
    pdf.setLineWidth(1.2)
    pdf.line(18 * mm, height - 39 * mm, width - 18 * mm, height - 39 * mm)

    title_style = ParagraphStyle(
        "title",
        fontName=FONT_BOLD,
        fontSize=14,
        leading=17,
        alignment=TA_CENTER,
        textColor=DARK,
    )
    subtitle_style = ParagraphStyle(
        "subtitle",
        fontName=FONT_REGULAR,
        fontSize=9,
        leading=11,
        alignment=TA_CENTER,
        textColor=MUTED,
    )
    body_style = ParagraphStyle(
        "body",
        fontName=FONT_REGULAR,
        fontSize=8.2,
        leading=11,
        alignment=TA_LEFT,
        textColor=DARK,
    )
    small_style = ParagraphStyle(
        "small",
        fontName=FONT_REGULAR,
        fontSize=6.7,
        leading=8.5,
        alignment=TA_LEFT,
        textColor=MUTED,
    )

    title = wrap_paragraph(spec["title"], title_style, width - 40 * mm, 25 * mm)
    title.drawOn(pdf, 20 * mm, height - 53 * mm)
    subtitle = wrap_paragraph(spec["subtitle"], subtitle_style, width - 40 * mm, 15 * mm)
    subtitle.drawOn(pdf, 20 * mm, height - 61 * mm)

    pdf.setFillColor(colors.HexColor("#fff0f1"))
    pdf.roundRect(37 * mm, height - 72 * mm, width - 74 * mm, 7 * mm, 2 * mm, fill=1, stroke=0)
    pdf.setFillColor(RED)
    pdf.setFont(FONT_BOLD, 7.4)
    pdf.drawCentredString(width / 2, height - 69.5 * mm, "FICHA TÉCNICA DE REFERÊNCIA - NÃO É CERTIFICADO DE LOTE")

    description = wrap_paragraph(spec["description"], body_style, width - 36 * mm, 30 * mm)
    description.drawOn(pdf, 18 * mm, height - 94 * mm)

    y = height - 99 * mm
    pdf.setStrokeColor(RED)
    pdf.line(18 * mm, y, width - 18 * mm, y)
    pdf.setFont(FONT_BOLD, 9)
    pdf.setFillColor(DARK)
    pdf.drawCentredString(width / 2, y - 6 * mm, "PROPRIEDADES TÍPICAS DE REFERÊNCIA")

    data = [["Propriedade", "Valor típico", "Método / observação"]] + [
        [item[0], item[1], item[2]] for item in spec["properties"]
    ]
    table = Table(data, colWidths=[58 * mm, 55 * mm, 57 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), RED),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
                ("FONTNAME", (0, 1), (-1, -1), FONT_REGULAR),
                ("FONTSIZE", (0, 0), (-1, -1), 7.2),
                ("LEADING", (0, 0), (-1, -1), 8.7),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#c9cdd3")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    table_width, table_height = table.wrap(width - 36 * mm, 95 * mm)
    table_y = y - 11 * mm - table_height
    table.drawOn(pdf, (width - table_width) / 2, table_y)

    application_y = table_y - 14 * mm
    pdf.setStrokeColor(RED)
    pdf.line(18 * mm, application_y + 8 * mm, width - 18 * mm, application_y + 8 * mm)
    pdf.setFont(FONT_BOLD, 8.5)
    pdf.setFillColor(DARK)
    pdf.drawString(18 * mm, application_y + 2.5 * mm, "APLICAÇÕES TÍPICAS")
    applications = wrap_paragraph(spec["applications"], body_style, width - 36 * mm, 20 * mm)
    applications.drawOn(pdf, 18 * mm, application_y - 8 * mm)

    note_text = (
        "Valores típicos do grau de referência citado e não valores de especificação do material "
        "fornecido pela Parts Seals. Propriedades variam conforme fabricante, formulação, "
        "processamento, condição de ensaio, umidade e lote. A seleção final exige validação da "
        "aplicação e, quando necessário, certificado do lote efetivamente fornecido."
    )
    note = wrap_paragraph(note_text, small_style, width - 36 * mm, 30 * mm)
    note.drawOn(pdf, 18 * mm, 42 * mm)

    source_text = f"<b>Fonte de referência:</b> {spec['source']}<br/>{spec['source_url']}<br/>Consulta: 27/07/2026"
    source = wrap_paragraph(source_text, small_style, width - 36 * mm, 25 * mm)
    source.drawOn(pdf, 18 * mm, 25 * mm)

    pdf.setFillColor(RED)
    pdf.rect(0, 0, width, 19 * mm, fill=1, stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setFont(FONT_BOLD, 11)
    pdf.drawString(18 * mm, 12 * mm, "PartsSeals")
    pdf.setFont(FONT_REGULAR, 6.8)
    pdf.drawString(18 * mm, 7.5 * mm, "Vedações Industriais")
    pdf.drawString(70 * mm, 12 * mm, "Contatos")
    pdf.drawString(70 * mm, 7.5 * mm, "(19) 3626-3552 | (19) 98301-1817 | vendas@parts-seals.com.br")
    pdf.drawString(136 * mm, 12 * mm, "Santa Bárbara d'Oeste - SP")
    pdf.drawString(136 * mm, 7.5 * mm, "CNPJ 30.705.918/0001-05")

    pdf.showPage()
    pdf.save()


def generate_reference_sheets() -> None:
    for spec in REFERENCE_SHEETS:
        output_path = SOURCE_DIR / spec["filename"]
        assert_in_workspace(output_path)
        create_reference_sheet(spec, output_path)


def make_watermark_png() -> bytes:
    logo = Image.open(LOGO_PATH).convert("RGBA")
    logo.thumbnail((520, 150))
    alpha = logo.getchannel("A").point(lambda value: int(value * 0.10))
    logo.putalpha(alpha)
    rotated = logo.rotate(18, expand=True, resample=Image.Resampling.BICUBIC)
    buffer = io.BytesIO()
    rotated.save(buffer, format="PNG")
    return buffer.getvalue()


def locate_source(needle: str) -> Path:
    matches = [path for path in SOURCE_DIR.glob("*.pdf") if needle in normalized(path.name)]
    if len(matches) != 1:
        raise RuntimeError(f"Esperado um PDF para '{needle}', encontrados: {[p.name for p in matches]}")
    return matches[0]


def protect_pdf(source_path: Path, destination: Path, watermark: bytes) -> None:
    if destination.exists():
        assert_in_workspace(destination)
        destination.unlink()
    source = fitz.open(source_path)
    protected = fitz.open()
    protected.insert_pdf(source)
    protected.set_metadata(source.metadata)

    for page in protected:
        page_width = page.rect.width
        page_height = page.rect.height
        tile_width = 158
        tile_height = 62
        row = 0
        y = -18
        while y < page_height:
            x = -45 if row % 2 == 0 else 45
            while x < page_width:
                rect = fitz.Rect(x, y, x + tile_width, y + tile_height)
                page.insert_image(rect, stream=watermark, overlay=True, keep_proportion=True)
                x += 180
            y += 88
            row += 1

    permissions = fitz.PDF_PERM_PRINT | fitz.PDF_PERM_ACCESSIBILITY
    protected.save(
        destination,
        garbage=4,
        deflate=True,
        encryption=fitz.PDF_ENCRYPT_AES_256,
        owner_pw="parts-seals-protected",
        user_pw="",
        permissions=permissions,
    )
    protected.close()
    source.close()


def render_web_pages(pdf_path: Path, slug: str) -> list[str]:
    document = fitz.open(pdf_path)
    page_paths: list[str] = []
    for index, page in enumerate(document):
        pixmap = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        filename = f"{slug}-p{index + 1}.webp"
        output_path = WEB_DIR / filename
        image.save(output_path, "WEBP", quality=88, method=6)
        page_paths.append(f"assets/datasheets-view/{filename}")
    document.close()
    return page_paths


def build_library() -> None:
    for stale in WEB_DIR.glob("*.webp"):
        assert_in_workspace(stale)
        stale.unlink()

    watermark = make_watermark_png()
    manifest = []
    for needle, slug, title, document_type in DOC_SPECS:
        source = locate_source(needle)
        protected_path = PROTECTED_DIR / f"{slug}.pdf"
        protect_pdf(source, protected_path, watermark)
        pages = render_web_pages(protected_path, slug)
        manifest.append(
            {
                "slug": slug,
                "title": title,
                "type": document_type,
                "pages": pages,
            }
        )

    manifest_path = WEB_DIR / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Biblioteca gerada: {len(manifest)} documentos em {WEB_DIR}")


if __name__ == "__main__":
    migrate_new_pdfs()
    generate_reference_sheets()
    build_library()
