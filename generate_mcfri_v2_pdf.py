import os
import sys
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(45, A4[1] - 30, "AI SafeRoute | Multi-Catchment Flood Risk Index (MCFRI-V2) Specification")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(45, A4[1] - 35, A4[0] - 45, A4[1] - 35)
        
        # Footer
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(A4[0] - 45, 30, footer_text)
        self.drawString(45, 30, "CONFIDENTIAL & PROPRIETARY — AI SAFEROUTE DISASTER ALERT PLATFORM")
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(45, 42, A4[0] - 45, 42)
        
        self.restoreState()


def build_pdf(filename="MCFRI_V2_Technical_Specification.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=45,
        rightMargin=45,
        topMargin=48,
        bottomMargin=48
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    primary_color = colors.HexColor("#1e3a8a")
    secondary_color = colors.HexColor("#2563eb")
    dark_slate = colors.HexColor("#0f172a")
    body_color = colors.HexColor("#334155")
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=primary_color,
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=secondary_color,
        spaceAfter=12
    )
    
    meta_style = ParagraphStyle(
        'MetaStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#475569")
    )
    
    h1_style = ParagraphStyle(
        'H1Style',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=primary_color,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )
    
    h2_style = ParagraphStyle(
        'H2Style',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=secondary_color,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        textColor=body_color,
        spaceAfter=6
    )
    
    body_bold = ParagraphStyle(
        'BodyBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )
    
    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=11.5,
        textColor=colors.HexColor("#0f172a")
    )
    
    formula_style = ParagraphStyle(
        'FormulaStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=15,
        alignment=1, # Center
        textColor=colors.HexColor("#0f172a")
    )
    
    table_text = ParagraphStyle(
        'TableText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=body_color
    )
    
    table_text_bold = ParagraphStyle(
        'TableTextBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=dark_slate
    )
    
    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.white
    )
    
    story = []
    
    # -------------------------------------------------------------
    # 1. HEADER & METADATA
    # -------------------------------------------------------------
    story.append(Paragraph("MCFRI-V2: Multi-Catchment Flood Risk Index", title_style))
    story.append(Paragraph("Comprehensive Mathematical Specification, Variable Definitions & Developer Reference Guide", subtitle_style))
    
    meta_table_data = [
        [
            Paragraph("<b>Platform:</b> AI SafeRoute Disaster Alert System<br/><b>Document Class:</b> Mathematical Specification", meta_style),
            Paragraph("<b>Engine:</b> MCFRI-V2 (Normalized Non-Linear)<br/><b>Score Bounds:</b> S(t) ∈ [0, 200]", meta_style),
            Paragraph("<b>Status:</b> Unvalidated Defaults<br/><b>Date:</b> August 2026", meta_style),
        ]
    ]
    meta_table = Table(meta_table_data, colWidths=[170, 170, 165])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))
    
    # -------------------------------------------------------------
    # NOTICE BOX (Warning Callout)
    # -------------------------------------------------------------
    notice_text = (
        "<b>⚠️ UNVALIDATED DEVELOPMENT STATUS NOTICE:</b><br/>"
        "All mathematical equations, power exponents (α, β, γ, δ, ε, η), scaling constants (R₀, Q₀), component weights (w_RM, w_W, w_T, w_D), "
        "and classification thresholds documented herein are <b>UNVALIDATED DEVELOPMENT DEFAULTS</b>. They are engineered to establish strictly "
        "bounded mathematical behavior (S(t) ∈ [0, 200]) and verify system pipelines. <b>These values must undergo rigorous empirical calibration "
        "and statistical validation against historical meteorological and hydrological gauge datasets before operational field deployment.</b>"
    )
    notice_table = Table([[Paragraph(notice_text, table_text)]], colWidths=[505])
    notice_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#fffbeb")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#fcd34d")),
        ('LINELEFT', (0,0), (-1,-1), 4, colors.HexColor("#f59e0b")),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(notice_table)
    story.append(Spacer(1, 10))
    
    # -------------------------------------------------------------
    # 2. MASTER FORMULATION
    # -------------------------------------------------------------
    story.append(Paragraph("1. Theoretical Architecture & Master Equation", h1_style))
    story.append(Paragraph(
        "The Multi-Catchment Flood Risk Index Version 2 (MCFRI-V2) is a deterministic, normalized non-linear environmental risk calculation engine. "
        "It transforms multi-source meteorological, hydrologic, and geospatial telemetry into a strictly bounded risk score <b>S(t) ∈ [0, 200]</b>. "
        "Unlike linear models where flood risk accumulates proportionally to rainfall volume, MCFRI-V2 models asymptotic ground saturation, exponential moisture coupling, "
        "topographic basin attenuation, and rate-of-change cloudburst dynamics.",
        body_style
    ))
    
    # Master Equation Box
    eq_box_text = (
        "<font size=11><b>S(t) = 200 × [ w<sub>RM</sub> · F<sub>RM</sub> + w<sub>W</sub> · F<sub>W</sub> + w<sub>T</sub> · F<sub>T</sub> + w<sub>Δ</sub> · F<sub>Δ</sub> ]</b></font><br/><br/>"
        "<font size=8.5 color='#475569'>where w<sub>RM</sub> + w<sub>W</sub> + w<sub>T</sub> + w<sub>Δ</sub> = 1.0 &nbsp;&nbsp;|&nbsp;&nbsp; F<sub>RM</sub>, F<sub>W</sub>, F<sub>T</sub>, F<sub>Δ</sub> ∈ [0, 1] &nbsp;&nbsp;|&nbsp;&nbsp; S(t) ∈ [0, 200]</font>"
    )
    eq_table = Table([[Paragraph(eq_box_text, formula_style)]], colWidths=[505])
    eq_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f1f5f9")),
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor("#2563eb")),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(eq_table)
    story.append(Spacer(1, 10))
    
    # -------------------------------------------------------------
    # 3. FOUR NON-LINEAR SUB-COMPONENTS
    # -------------------------------------------------------------
    story.append(Paragraph("2. The Four Non-Linear Sub-Components", h1_style))
    story.append(Paragraph(
        "Every sub-component isolates a distinct physical hazard channel, evaluates non-linear kinetics, and returns a value bounded in [0, 1]:",
        body_style
    ))
    
    comp_data = [
        [
            Paragraph("<b>1. Rainfall-Moisture Coupling (F<sub>RM</sub>)</b> &nbsp; [Weight: w<sub>RM</sub> = 0.40]<br/>"
                      "<b>Equation:</b> F<sub>RM</sub> = r<sup>α</sup> · [ (exp(β·m) - 1) / (exp(β) - 1) ]<br/>"
                      "<b>Physics:</b> Models asymptotic rain saturation coupled exponentially with antecedent soil moisture (m). Dry soil absorbs rainfall; saturated soil produces rapid runoff.<br/>"
                      "<b>Parameters:</b> r = R / (R + 150) (Michaelis-Menten) | α = 1.5 | β = 2.0", table_text),
            Paragraph("<b>2. Water Proximity & Drainage (F<sub>W</sub>)</b> &nbsp; [Weight: w<sub>W</sub> = 0.25]<br/>"
                      "<b>Equation:</b> F<sub>W</sub> = p<sup>γ</sup> · (1 - d)<sup>δ</sup><br/>"
                      "<b>Physics:</b> Quantifies vulnerability based on physical distance to riverbanks/coastlines (p) compounded by municipal culvert and drainage deficit (1 - d).<br/>"
                      "<b>Parameters:</b> p = raw_proximity / 5 | d ∈ [0, 1] | γ = 2.0 | δ = 1.5", table_text)
        ],
        [
            Paragraph("<b>3. Topography & Land-Use (F<sub>T</sub>)</b> &nbsp; [Weight: w<sub>T</sub> = 0.20]<br/>"
                      "<b>Equation:</b> F<sub>T</sub> = (1 - h)<sup>ε</sup> · (1 - l)<br/>"
                      "<b>Physics:</b> Structural risk from low topographic elevation (1 - h) (Height Above Nearest Drainage basin exposure) and urban concrete impermeability (1 - l).<br/>"
                      "<b>Parameters:</b> h = (elev - 1) / 4 ∈ [0, 1] | l ∈ [0, 1] | ε = 2.0", table_text),
            Paragraph("<b>4. Flash Flood Acceleration (F<sub>Δ</sub>)</b> &nbsp; [Weight: w<sub>D</sub> = 0.15]<br/>"
                      "<b>Equation:</b> F<sub>Δ</sub> = q<sup>η</sup><br/>"
                      "<b>Physics:</b> Half-wave rectified rate-of-change factor isolating sudden cloudburst surges (dR/dt). Receding or steady rain produces exactly zero flash acceleration.<br/>"
                      "<b>Parameters:</b> q = max(0, ΔR) / (max(0, ΔR) + 50) | η = 1.2", table_text)
        ]
    ]
    comp_table = Table(comp_data, colWidths=[250, 250])
    comp_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(comp_table)
    story.append(Spacer(1, 10))
    
    # -------------------------------------------------------------
    # 4. COMPLETE VARIABLE GLOSSARY TABLE
    # -------------------------------------------------------------
    story.append(Paragraph("3. Complete Variable Definitions & Glossary Table", h1_style))
    
    var_headers = ["Symbol", "Variable Name", "Physical Interpretation", "Units", "Domain", "Development Default"]
    var_rows = [
        ["R", "rainfall", "Accumulated precipitation volume", "mm", "[0, ∞)", "Dynamic (0 - 300 mm)"],
        ["R0", "R0", "Rainfall half-saturation constant (r = 0.5 at R = R0)", "mm", "(0, ∞)", "150 mm"],
        ["r", "norm.rainfall", "Normalized rainfall saturation ratio", "Ratio", "[0, 1)", "r = R / (R + 150)"],
        ["m", "soilMoisture", "Antecedent soil saturation index", "Index", "[0.0, 1.0]", "0.5 (0 = dry, 1 = saturated)"],
        ["p", "waterProximity", "Proximity exposure to surface water bodies", "Index", "[0.0, 1.0]", "raw_rating (1-5) / 5"],
        ["d", "drainage", "Culvert & municipal drainage capacity", "Index", "[0.0, 1.0]", "0.5 (0 = clogged, 1 = optimal)"],
        ["h", "handExposure", "Topographic elevation safety factor (HAND)", "Index", "[0.0, 1.0]", "h = (elev - 1) / 4 (0=basin, 1=crest)"],
        ["l", "permeability", "Ground surface infiltration porousness", "Index", "[0.0, 1.0]", "0.5 (0 = paved, 1 = forest)"],
        ["ΔR", "deltaR", "Positive rate of rainfall accumulation change", "mm/event", "[0, ∞)", "max(0, R_t - R_t-1)"],
        ["Q0", "Q0", "Rainfall rate half-saturation constant", "mm/event", "(0, ∞)", "50 mm/event"],
        ["q", "norm.rainfallRate", "Normalized cloudburst acceleration ratio", "Ratio", "[0, 1)", "q = max(0, ΔR) / (max(0, ΔR) + 50)"],
        ["α...η", "exponents", "Non-linear power & curvature exponents", "Params", "(0, ∞)", "α=1.5, β=2, γ=2, δ=1.5, ε=2, η=1.2"],
        ["wi", "weights", "Component contribution weights (Σ wi = 1.0)", "Weights", "[0.0, 1.0]", "wRM=0.40, wW=0.25, wT=0.20, wD=0.15"],
        ["S(t)", "riskScore", "Catchment Flood Risk Index composite score", "Score", "[0, 200]", "Scaled & clamped output"]
    ]
    
    table_data = [[Paragraph(f"<b>{h}</b>", table_header) for h in var_headers]]
    for row in var_rows:
        table_data.append([
            Paragraph(f"<b>{row[0]}</b>", table_text_bold),
            Paragraph(f"<code>{row[1]}</code>", table_text),
            Paragraph(row[2], table_text),
            Paragraph(row[3], table_text),
            Paragraph(row[4], table_text),
            Paragraph(row[5], table_text),
        ])
    
    var_table = Table(table_data, colWidths=[40, 75, 150, 45, 60, 135])
    var_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(var_table)
    story.append(Spacer(1, 10))
    
    # -------------------------------------------------------------
    # 5. RISK CLASSIFICATION TIERS TABLE
    # -------------------------------------------------------------
    story.append(Paragraph("4. Operational Risk Classification Tiers", h1_style))
    
    tier_headers = ["Tier", "Score Range", "UI Color", "Hydrologic Status", "Operational Emergency Action"]
    tier_rows = [
        ["SAFE", "0 ≤ S < 80", "Green (#22c55e)", "Infiltration capacity exceeds rain rate; culverts clear.", "Standard municipal monitoring; all evacuation routes open."],
        ["WARNING", "80 ≤ S ≤ 140", "Amber (#f59e0b)", "Soil nearing saturation; localized street waterlogging.", "Stage rescue crews; issue advisory alerts; pack emergency kits."],
        ["DANGER", "S > 140", "Red (#ef4444)", "Severe flood inundation; channel overflow; rapid flash surge.", "Mandatory evacuation; roads in zone blacklisted; SOS triage priority."]
    ]
    
    tier_table_data = [[Paragraph(f"<b>{h}</b>", table_header) for h in tier_headers]]
    for row in tier_rows:
        tier_table_data.append([
            Paragraph(f"<b>{row[0]}</b>", table_text_bold),
            Paragraph(row[1], table_text),
            Paragraph(row[2], table_text),
            Paragraph(row[3], table_text),
            Paragraph(row[4], table_text),
        ])
    
    tier_table = Table(tier_table_data, colWidths=[65, 75, 80, 135, 150])
    tier_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(tier_table)
    story.append(Spacer(1, 10))
    
    # -------------------------------------------------------------
    # 6. SECONDARY PROCESSING PIPELINE
    # -------------------------------------------------------------
    story.append(Paragraph("5. Multi-Stage Secondary Processing Pipeline", h1_style))
    story.append(Paragraph(
        "Following primary score calculation, the engine executes five downstream operational transformations:",
        body_style
    ))
    
    pipe_text = (
        "<b>1. Shelter Protection Mitigation:</b> Zones within 800m of fortified shelters receive inverse-distance risk deduction (up to -40 pts), followed by 0.80 dampening: S_mit = (S_raw - Bonus) × 0.80.<br/>"
        "<b>2. Flood Spillover Bleed:</b> Danger catchments (S > 140) propagate 10% excess flood risk volume to adjacent zones within 2000m: ΔS_j = Σ S_i × 0.10 × (1 - dist/2000m).<br/>"
        "<b>3. Dynamic Visual Radius:</b> Map footprint expands dynamically with risk severity: R_vis = R_base × (1 + S / 200).<br/>"
        "<b>4. Future Horizon Projection:</b> Predicts risk evolution over 1–6 hours: S_future = min(200, S + (R/50)·t_h + 10·p·t_h).<br/>"
        "<b>5. Adaptive FIFO Memory:</b> 5-step rolling historical buffer adjusts rainfall sensitivity weights (±0.01) during rapid upward surges."
    )
    pipe_table = Table([[Paragraph(pipe_text, table_text)]], colWidths=[505])
    pipe_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(pipe_table)
    story.append(Spacer(1, 10))
    
    # -------------------------------------------------------------
    # 7. WORKED NUMERICAL EXAMPLE
    # -------------------------------------------------------------
    story.append(Paragraph("6. Step-by-Step Worked Numerical Example (UNVALIDATED)", h1_style))
    
    example_text = (
        "<b>Sample Input Telemetry:</b> R = 200 mm, m = 0.70, p = 0.80, d = 0.30, h = 0.20, l = 0.30, ΔR = 100 mm/event<br/>"
        "<b>Constants & Defaults:</b> R₀ = 150 mm, Q₀ = 50 mm/ev | α = 1.5, β = 2.0, γ = 2.0, δ = 1.5, ε = 2.0, η = 1.2 | w = [0.40, 0.25, 0.20, 0.15]<br/><br/>"
        "<b>Step 1: Normalization:</b><br/>"
        "• r = 200 / (200 + 150) = 4/7 ≈ <b>0.5714</b> &nbsp;&nbsp;|&nbsp;&nbsp; • q = 100 / (100 + 50) = 2/3 ≈ <b>0.6667</b><br/>"
        "• (1 - d) = 0.70 &nbsp;&nbsp;|&nbsp;&nbsp; • (1 - h) = 0.80 &nbsp;&nbsp;|&nbsp;&nbsp; • (1 - l) = 0.70<br/><br/>"
        "<b>Step 2: Sub-Component Evaluations:</b><br/>"
        "• F<sub>RM</sub> = (0.5714)<sup>1.5</sup> × [ (e<sup>1.4</sup> - 1) / (e<sup>2.0</sup> - 1) ] = 0.4320 × 0.4782 = <b>0.2066</b><br/>"
        "• F<sub>W</sub> = (0.80)<sup>2.0</sup> × (0.70)<sup>1.5</sup> = 0.6400 × 0.5857 = <b>0.3748</b><br/>"
        "• F<sub>T</sub> = (0.80)<sup>2.0</sup> × (0.70) = 0.6400 × 0.7000 = <b>0.4480</b><br/>"
        "• F<sub>Δ</sub> = (0.6667)<sup>1.2</sup> = <b>0.6147</b><br/><br/>"
        "<b>Step 3: Weighted Linear Aggregation & Scaling:</b><br/>"
        "• Weighted Sum = (0.40 × 0.2066) + (0.25 × 0.3748) + (0.20 × 0.4480) + (0.15 × 0.6147)<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= 0.0826 + 0.0937 + 0.0896 + 0.0922 = <b>0.3581</b><br/>"
        "• S<sub>raw</sub> = 200 × 0.3581 = <b>71.62</b> → Final Integer Score: <b>72</b> &nbsp;&nbsp;[Classification: <b>SAFE (&lt; 80)</b>]<br/>"
        "<i>(With structural shelter dampening 0.80: S = 57)</i>"
    )
    example_table = Table([[Paragraph(example_text, table_text)]], colWidths=[505])
    example_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(example_table)
    story.append(Spacer(1, 10))
    
    # -------------------------------------------------------------
    # 8. VERIFICATION MATRIX
    # -------------------------------------------------------------
    story.append(Paragraph("7. Automated Test Suite Verification Results", h1_style))
    
    test_headers = ["Test ID", "Test Scenario", "Target Verification Condition", "Automated Status"]
    test_rows = [
        ["TEST_A", "Safe Baseline", "Low rain (10mm), dry soil (0.1), good drainage (0.9) → S < 40", "PASSED (Score: 3)"],
        ["TEST_B", "Severe Inundation", "High rain (280mm), saturated soil (0.95), poor drainage (0.1) → S > 120", "PASSED (Score: 139)"],
        ["TEST_C", "Flash Cloudburst", "Rapid acceleration (ΔR = +200mm) → F_Δ > 0.30", "PASSED (F_Δ = 0.765)"],
        ["TEST_D", "Drainage Mitigation", "Optimal drainage (d = 0.95) → F_W < 0.05", "PASSED (F_W = 0.011)"],
        ["TEST_E", "Paved Imperviousness", "Impervious (l=0.05) vs Permeable (l=0.90) → 9.5x vulnerability ratio", "PASSED (9.5x Ratio)"],
        ["TEST_F", "Receding Rain Filter", "Falling rainfall (ΔR = -50mm) → F_Δ = 0.000 exactly", "PASSED (F_Δ = 0.000)"],
        ["TEST_G", "Boundary Clamping", "Extreme out-of-bounds (R=9999, d=-1) → S ∈ [0, 200] strictly", "PASSED (Bounded)"],
        ["TEST_H", "Weight Sum Unity", "Sum of component weights = 1.0 ± 10^-6", "PASSED (Sum = 1.000000)"],
        ["TEST_I", "Schema Sanity", "140 numeric fields checked across all zones; 0 NaN/Infinity values", "PASSED (100% Valid)"]
    ]
    
    test_table_data = [[Paragraph(f"<b>{h}</b>", table_header) for h in test_headers]]
    for row in test_rows:
        test_table_data.append([
            Paragraph(f"<b>{row[0]}</b>", table_text_bold),
            Paragraph(row[1], table_text),
            Paragraph(row[2], table_text),
            Paragraph(f"<font color='#10b981'><b>{row[3]}</b></font>", table_text_bold),
        ])
    
    test_table = Table(test_table_data, colWidths=[65, 110, 210, 120])
    test_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(test_table)
    story.append(Spacer(1, 10))
    
    # -------------------------------------------------------------
    # 9. STANDALONE REFERENCE CODE
    # -------------------------------------------------------------
    story.append(Paragraph("8. Implementation Reference Code (JavaScript & Python)", h1_style))
    
    code_text = (
        "<b>JavaScript Reference Implementation:</b><br/>"
        "<code>function computeMCFRIV2({ R = 200, m = 0.7, p = 0.8, d = 0.3, h = 0.2, l = 0.3, deltaR = 100 }) {<br/>"
        "&nbsp;&nbsp;const r = R / (R + 150);<br/>"
        "&nbsp;&nbsp;const mNorm = Math.max(0, Math.min(1, m)), pNorm = Math.max(0, Math.min(1, p));<br/>"
        "&nbsp;&nbsp;const dNorm = Math.max(0, Math.min(1, d)), hNorm = Math.max(0, Math.min(1, h)), lNorm = Math.max(0, Math.min(1, l));<br/>"
        "&nbsp;&nbsp;const q = Math.max(0, deltaR) / (Math.max(0, deltaR) + 50);<br/>"
        "&nbsp;&nbsp;const FRM = Math.pow(r, 1.5) * ((Math.exp(2.0 * mNorm) - 1) / (Math.exp(2.0) - 1));<br/>"
        "&nbsp;&nbsp;const FW = Math.pow(pNorm, 2.0) * Math.pow(1 - dNorm, 1.5);<br/>"
        "&nbsp;&nbsp;const FT = Math.pow(1 - hNorm, 2.0) * (1 - lNorm);<br/>"
        "&nbsp;&nbsp;const FDelta = Math.pow(q, 1.2);<br/>"
        "&nbsp;&nbsp;const rawScore = 200 * (0.40 * FRM + 0.25 * FW + 0.20 * FT + 0.15 * FDelta);<br/>"
        "&nbsp;&nbsp;return { finalScore: Math.max(0, Math.min(200, Math.round(rawScore))), components: { FRM, FW, FT, FDelta } };<br/>"
        "}</code>"
    )
    code_table = Table([[Paragraph(code_text, code_style)]], colWidths=[505])
    code_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#0f172a")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#334155")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(code_table)
    
    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated {filename}")

if __name__ == "__main__":
    out_pdf = "c:/Users/Admin/Documents/BrCE (project)/project 1/MCFRI_V2_Technical_Specification.pdf"
    if len(sys.argv) > 1:
        out_pdf = sys.argv[1]
    build_pdf(out_pdf)
