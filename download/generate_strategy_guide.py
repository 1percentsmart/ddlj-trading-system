#!/usr/bin/env python3
"""
DDLJ Trading System v9.1.0 — Strategy Guide
Day-by-Day Operator's Manual

A practical, actionable guide for daily operation of the DDLJ Trading System.
Uses ReportLab with TocDocTemplate + multiBuild for auto TOC.
"""

import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, Flowable, NextPageTemplate, PageTemplate,
    Frame, ListFlowable, ListItem,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate

# ─── Fonts ───────────────────────────────────────────────────────────────────
pdfmetrics.registerFont(TTFont('LiberationSerif', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif-Bold', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-Bold', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSansMono', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))

pdfmetrics.registerFontFamily(
    'LiberationSerif',
    normal='LiberationSerif',
    bold='LiberationSerif-Bold',
)
pdfmetrics.registerFontFamily(
    'Carlito',
    normal='Carlito',
    bold='Carlito-Bold',
)

# ─── Color Palette (MANDATORY) ───────────────────────────────────────────────
ACCENT       = colors.HexColor('#26728c')
TEXT_PRIMARY  = colors.HexColor('#232220')
TEXT_MUTED    = colors.HexColor('#87827b')
BG_SURFACE   = colors.HexColor('#e1dcd6')
BG_PAGE      = colors.HexColor('#edebe9')
TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = BG_SURFACE

# Semantic colors
PROFIT  = colors.HexColor('#22c55e')
LOSS    = colors.HexColor('#ef4444')
WARNING = colors.HexColor('#f59e0b')

# ─── Page geometry ────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
MARGIN_LEFT   = 72
MARGIN_RIGHT  = 72
MARGIN_TOP    = 60
MARGIN_BOTTOM = 60
CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT

# ─── Styles ───────────────────────────────────────────────────────────────────
sTitle = ParagraphStyle(
    'DocTitle', fontName='Carlito-Bold', fontSize=26, leading=32,
    textColor=ACCENT, alignment=TA_CENTER, spaceAfter=6,
)
sSubtitle = ParagraphStyle(
    'DocSubtitle', fontName='Carlito', fontSize=14, leading=18,
    textColor=TEXT_MUTED, alignment=TA_CENTER, spaceAfter=30,
)
sH1 = ParagraphStyle(
    'H1', fontName='Carlito-Bold', fontSize=20, leading=26,
    textColor=ACCENT, spaceBefore=22, spaceAfter=10,
    keepWithNext=1,
)
sH2 = ParagraphStyle(
    'H2', fontName='Carlito-Bold', fontSize=14, leading=18,
    textColor=ACCENT, spaceBefore=14, spaceAfter=6,
    keepWithNext=1,
)
sH3 = ParagraphStyle(
    'H3', fontName='Carlito-Bold', fontSize=12, leading=15,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=4,
    keepWithNext=1,
)
sBody = ParagraphStyle(
    'Body', fontName='LiberationSerif', fontSize=10.5, leading=15,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=6,
)
sBodyBold = ParagraphStyle(
    'BodyBold', parent=sBody, fontName='Carlito-Bold',
)
sBullet = ParagraphStyle(
    'Bullet', parent=sBody, leftIndent=18, bulletIndent=6,
    spaceAfter=3,
)
sMuted = ParagraphStyle(
    'Muted', fontName='Carlito', fontSize=9, leading=12,
    textColor=TEXT_MUTED, alignment=TA_CENTER,
)
sTableHeader = ParagraphStyle(
    'TH', fontName='Carlito-Bold', fontSize=9.5, leading=12,
    textColor=TABLE_HEADER_TEXT, alignment=TA_CENTER,
)
sTableCell = ParagraphStyle(
    'TC', fontName='LiberationSerif', fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER,
)
sTableCellLeft = ParagraphStyle(
    'TCL', fontName='LiberationSerif', fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
)
sTableCellBold = ParagraphStyle(
    'TCB', fontName='Carlito-Bold', fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER,
)
sProfitCell = ParagraphStyle(
    'ProfitCell', fontName='Carlito-Bold', fontSize=9, leading=12,
    textColor=PROFIT, alignment=TA_CENTER,
)
sLossCell = ParagraphStyle(
    'LossCell', fontName='Carlito-Bold', fontSize=9, leading=12,
    textColor=LOSS, alignment=TA_CENTER,
)
sWarningCell = ParagraphStyle(
    'WarningCell', fontName='Carlito-Bold', fontSize=9, leading=12,
    textColor=WARNING, alignment=TA_CENTER,
)
sFooter = ParagraphStyle(
    'Footer', fontName='Carlito', fontSize=8, leading=10,
    textColor=TEXT_MUTED, alignment=TA_CENTER,
)
sMonoCell = ParagraphStyle(
    'MonoCell', fontName='DejaVuSansMono', fontSize=8.5, leading=11,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER,
)
sMonoCellLeft = ParagraphStyle(
    'MonoCellLeft', fontName='DejaVuSansMono', fontSize=8.5, leading=11,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
)

# ─── Helper: Accent Rule ─────────────────────────────────────────────────────
class AccentRule(Flowable):
    """A thin colored horizontal rule."""
    def __init__(self, width, thickness=1.5, color=ACCENT):
        Flowable.__init__(self)
        self.width = width
        self.height = thickness + 4
        self.thickness = thickness
        self.color = color

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 2, self.width, 2)


# ─── Helper: make_table ──────────────────────────────────────────────────────
def make_table(headers, rows, col_widths=None):
    """Build a styled table with Paragraph-wrapped cells. Every cell is a Paragraph instance."""
    data = []
    header_row = [Paragraph(h, sTableHeader) for h in headers]
    data.append(header_row)
    for row in rows:
        data_row = []
        for i, cell in enumerate(row):
            if isinstance(cell, Paragraph):
                data_row.append(cell)
            elif isinstance(cell, str):
                data_row.append(Paragraph(cell, sTableCell))
            else:
                data_row.append(Paragraph(str(cell), sTableCell))
        data.append(data_row)

    if col_widths is None:
        col_widths = [CONTENT_W / len(headers)] * len(headers)

    t = Table(data, colWidths=col_widths, repeatRows=1, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('FONTNAME', (0, 0), (-1, 0), 'Carlito-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#c8c3bc')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t


# ─── TocDocTemplate ──────────────────────────────────────────────────────────
class TocDocTemplate(BaseDocTemplate):
    """DocTemplate that supports auto TOC via multiBuild."""
    def __init__(self, filename, **kw):
        BaseDocTemplate.__init__(self, filename, **kw)
        frame = Frame(
            MARGIN_LEFT, MARGIN_BOTTOM,
            CONTENT_W, PAGE_H - MARGIN_TOP - MARGIN_BOTTOM,
            id='main', showBoundary=0,
        )
        template = PageTemplate(id='main', frames=[frame], onPage=self._page_bg)
        self.addPageTemplates([template])

    def _page_bg(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(BG_PAGE)
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        # header accent line
        canvas.setStrokeColor(ACCENT)
        canvas.setLineWidth(1.2)
        canvas.line(MARGIN_LEFT, PAGE_H - MARGIN_TOP + 14, PAGE_W - MARGIN_RIGHT, PAGE_H - MARGIN_TOP + 14)
        # footer
        canvas.setFont('Carlito', 8)
        canvas.setFillColor(TEXT_MUTED)
        canvas.drawCentredString(PAGE_W / 2, 28, "DDLJ Trading System v9.1.0 — Strategy Guide")
        canvas.drawRightString(PAGE_W - MARGIN_RIGHT, 28, f"Page {doc.page}")
        canvas.restoreState()

    def afterFlowable(self, flowable):
        """Register TOC entries from headings."""
        if isinstance(flowable, Paragraph):
            style = flowable.style.name
            text = flowable.getPlainText()
            if style == 'H1':
                self.notify('TOCEntry', (0, text, self.page))
            elif style == 'H2':
                self.notify('TOCEntry', (1, text, self.page))


# ─── Title & TOC ─────────────────────────────────────────────────────────────
def build_title():
    elements = []
    elements.append(Spacer(1, 60))
    elements.append(AccentRule(CONTENT_W, 2.5, ACCENT))
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("DDLJ Trading System v9.1.0", sTitle))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("Strategy Guide", sTitle))
    elements.append(Spacer(1, 16))
    elements.append(Paragraph("Day-by-Day Operator's Manual", sSubtitle))
    elements.append(Spacer(1, 10))
    elements.append(AccentRule(CONTENT_W, 2.5, ACCENT))
    elements.append(Spacer(1, 30))

    meta_style = ParagraphStyle('MetaInfo', fontName='Carlito', fontSize=10, leading=14,
                                textColor=TEXT_MUTED, alignment=TA_CENTER, spaceAfter=4)
    elements.append(Paragraph("Version 9.1.0  |  April 2026", meta_style))
    elements.append(Paragraph("Platform: Zerodha Kite  |  Instruments: BankNifty, Nifty Options", meta_style))
    elements.append(Spacer(1, 30))

    intro_box = ParagraphStyle('IntroBox', fontName='LiberationSerif', fontSize=10.5, leading=15,
                               textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=6)
    elements.append(Paragraph(
        "This is your practical, day-to-day operator's manual for the DDLJ Trading System. Where the system "
        "documentation explains what each module does and how it works internally, this guide tells you exactly "
        "what to do: which buttons to press, which fields to fill, which numbers to watch, and what to do when "
        "things go wrong. Keep this guide open alongside your dashboard every trading day. It is designed to be "
        "scanned quickly in the heat of a live session, with clear tables and checklists that you can follow "
        "step by step without guessing. If you are new to DDLJ, start with Section 1 and work through in order. "
        "If you are an experienced operator, jump to the section you need using the Table of Contents.",
        intro_box
    ))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(
        "Every section follows a consistent format: a brief explanation of the topic, a practical table or "
        "checklist with concrete actions, and notes on what to watch out for. The guide uses 'Do this, then "
        "that happens' language throughout. No theory, no deep-dive code explanations — just the operational "
        "steps you need to run the system profitably and safely. Think of this as the quick-start card that "
        "comes with a new appliance: it does not explain how the motor works, it tells you which button to "
        "press to start it.",
        intro_box
    ))
    elements.append(PageBreak())
    return elements


def build_toc():
    elements = []
    elements.append(Paragraph("Table of Contents", sH1))
    elements.append(AccentRule(CONTENT_W, 1.2, ACCENT))
    elements.append(Spacer(1, 12))
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle('TOC0', fontName='Carlito-Bold', fontSize=12, leading=18,
                       textColor=ACCENT, spaceBefore=8, spaceAfter=2, leftIndent=0),
        ParagraphStyle('TOC1', fontName='LiberationSerif', fontSize=10.5, leading=16,
                       textColor=TEXT_PRIMARY, spaceBefore=2, spaceAfter=2, leftIndent=24),
    ]
    elements.append(toc)
    elements.append(PageBreak())
    return elements


# ─── Section 1: Getting Started ──────────────────────────────────────────────
def section_1():
    e = []
    e.append(Paragraph("1. Getting Started — Your First Trade", sH1))
    e.append(AccentRule(CONTENT_W, 1, ACCENT))
    e.append(Spacer(1, 8))

    e.append(Paragraph(
        "Before you can place your first trade with DDLJ, you need to set up a few prerequisites and walk through "
        "a one-time configuration process. This section covers everything you need to do from a fresh install to "
        "seeing your first signal on the dashboard. The entire setup takes about 15 minutes if you already have "
        "your Zerodha account and API credentials ready. If you do not have these yet, obtaining them may take "
        "1-2 business days. Do not skip any step — each one is essential for the system to function correctly. "
        "Attempting to trade with incomplete setup will result in errors, missed signals, or worse, incorrect "
        "position sizing that could risk more capital than you intended.",
        sBody
    ))

    e.append(Paragraph("1.1 Prerequisites Checklist", sH2))
    e.append(Paragraph(
        "Verify each item below before proceeding. If any item is missing, resolve it first. You cannot run the "
        "system safely without all of these in place.",
        sBody
    ))

    prereq_headers = ["Item", "What You Need", "How to Get It"]
    prereq_rows = [
        ["Zerodha Account", "Active trading account with Kite access", "Register at zerodha.com and complete KYC"],
        ["API Key", "Kite API key (starts with 'kitefront')", "Create at developers.kite.trade"],
        ["API Secret", "Secret key paired with your API key", "Shown once when you create the API app"],
        ["Capital", "Minimum Rs 50,000 in trading account", "Transfer funds via Kite dashboard"],
        ["Python 3.10+", "Python runtime on your server/machine", "Download from python.org or use your package manager"],
        ["DDLJ Package", "Installed and verified DDLJ v9.1.0", "pip install ddlj-trading==9.1.0"],
        ["Browser", "Modern browser for the dashboard", "Chrome 90+ or Firefox 90+ recommended"],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(prereq_headers, prereq_rows,
                        col_widths=[90, 170, 190]))
    e.append(Spacer(1, 10))

    e.append(Paragraph("1.2 Step-by-Step First-Time Setup", sH2))
    e.append(Paragraph(
        "Follow these seven steps in order. Each step builds on the previous one, so do not skip ahead. After "
        "completing Step 7, your system will be ready to generate its first signal. You should run the system "
        "in paper-trading mode for at least 5 trading days before switching to live mode — this gives you time "
        "to verify that signals are appearing correctly and that the dashboard is updating as expected.",
        sBody
    ))

    setup_headers = ["Step", "Action", "What to Do", "Expected Result"]
    setup_rows = [
        ["1", "Install",
         Paragraph("Run: <font face='DejaVuSansMono'>pip install ddlj-trading==9.1.0</font>", sTableCellLeft),
         "Package installs without errors"],
        ["2", "Configure API",
         Paragraph("Enter your API key and secret in the dashboard Settings page. Click 'Test Connection'.", sTableCellLeft),
         Paragraph("Green 'Connected' badge appears", sProfitCell)],
        ["3", "Set Capital",
         Paragraph("Enter your trading capital (e.g., 50000). This is the amount in your Zerodha account that you are allocating to DDLJ.", sTableCellLeft),
         "Capital displayed in dashboard header"],
        ["4", "Choose Index",
         Paragraph("Select 'BankNifty' or 'Nifty' from the Index dropdown. BankNifty has higher volatility; Nifty is more stable.", sTableCellLeft),
         "Selected index shown in engine status bar"],
        ["5", "Select Option Type",
         Paragraph("Choose ITM, ATM, or OTM. ITM is recommended for beginners because it moves more predictably with the index.", sTableCellLeft),
         "Option type saved in config panel"],
        ["6", "Set Risk %",
         Paragraph("Set daily risk to 2% and per-trade risk to 1% for your first week. You can increase later once you are comfortable.", sTableCellLeft),
         Paragraph("Risk limits shown in Risk Management panel", sWarningCell)],
        ["7", "Start Engine",
         Paragraph("Toggle the engine switch to ON. Confirm the mode is 'PAPER' first. The engine will begin fetching data and generating bias readings.", sTableCellLeft),
         Paragraph("Green 'Running' indicator, bias appears within 1 minute", sProfitCell)],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(setup_headers, setup_rows,
                        col_widths=[35, 60, 230, 125]))
    e.append(Spacer(1, 10))

    e.append(Paragraph(
        "After completing these steps, wait for the next 15-minute candle to close. The system will calculate bias "
        "on the 60-minute chart and begin scanning for entry signals on the 15-minute chart. If the bias is NEUTRAL, "
        "no signals will fire — this is normal. The system only trades when it has a clear directional bias. Your "
        "first signal may take anywhere from 15 minutes to several hours depending on market conditions. Patience "
        "is not just a virtue here; it is a requirement built into the system by design.",
        sBody
    ))
    e.append(PageBreak())
    return e


# ─── Section 2: Daily Operating Procedure ────────────────────────────────────
def section_2():
    e = []
    e.append(Paragraph("2. Daily Operating Procedure", sH1))
    e.append(AccentRule(CONTENT_W, 1, ACCENT))
    e.append(Spacer(1, 8))

    e.append(Paragraph(
        "Once your system is set up, each trading day follows a predictable routine. This section outlines the "
        "exact steps to follow before, during, and after market hours. Treat this as your daily checklist — print "
        "it, bookmark it, or keep it open on a second monitor. The goal is to ensure that nothing is missed and "
        "that you catch problems early, before they affect your trading. The entire morning routine takes less "
        "than 5 minutes once you are familiar with it. The end-of-day routine takes about 10 minutes and is "
        "arguably the most important part of your day because it builds the discipline and journal habit that "
        "separates profitable traders from gamblers.",
        sBody
    ))

    e.append(Paragraph("2.1 Morning Routine (Before Market Open)", sH2))
    e.append(Paragraph(
        "Complete these checks between 9:00 AM and 9:15 AM IST, before the market opens. If any check fails, "
        "do not start the engine until it is resolved. Trading with an expired token or stale configuration "
        "can cause the engine to miss signals or place incorrect orders.",
        sBody
    ))

    morning_headers = ["Check", "Action", "What to Look For"]
    morning_rows = [
        ["1. Token Validity",
         Paragraph("Open the dashboard. Look at the connection status indicator in the top-right corner.", sTableCellLeft),
         Paragraph("Green dot = token is valid. Red dot = token expired — generate a new one from Zerodha Kite and paste it into the Settings page.", sTableCellLeft)],
        ["2. Config Review",
         Paragraph("Open Settings. Verify: capital amount, risk %, index selection, and lot size match today's plan.", sTableCellLeft),
         Paragraph("All values should reflect your intended configuration. If you changed anything yesterday, confirm the changes persisted.", sTableCellLeft)],
        ["3. Bias Preview",
         Paragraph("Look at the Bias Engine panel on the dashboard. It should show a bias reading from the previous session.", sTableCellLeft),
         Paragraph("You will see BULLISH, BEARISH, or NEUTRAL. This is the starting bias for today — it may change after the first 60m candle closes.", sTableCellLeft)],
        ["4. Open Positions",
         Paragraph("Check the Positions panel. Are there any carry-over positions from yesterday?", sTableCellLeft),
         Paragraph("If yes, verify the stop-loss and target levels are still valid. Check if the engine is managing them (green 'Managed' tag).", sTableCellLeft)],
        ["5. News & Events",
         Paragraph("Check an economic calendar for scheduled events today (RBI policy, Fed minutes, earnings).", sTableCellLeft),
         Paragraph("High-impact events may warrant reducing position size or switching to paper mode for the event period.", sTableCellLeft)],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(morning_headers, morning_rows,
                        col_widths=[90, 195, 165]))
    e.append(Spacer(1, 10))

    e.append(Paragraph("2.2 Market Open Checklist (9:15 AM)", sH2))
    e.append(Paragraph(
        "At 9:15 AM when the market opens, verify these five items before the engine starts actively scanning "
        "for signals. The engine starts automatically, but you need to confirm it is working correctly.",
        sBody
    ))

    open_headers = ["Item", "Verify", "If Failed"]
    open_rows = [
        ["Engine Status",
         Paragraph("Green 'Running' indicator on dashboard", sProfitCell),
         Paragraph("Click the engine toggle OFF then ON again", sTableCellLeft)],
        ["Live Data",
         "Candle chart is updating with new 15m bars",
         Paragraph("Check internet connection, then refresh the dashboard", sTableCellLeft)],
        ["Bias Active",
         "Bias reading is not 'OFFLINE' or 'ERROR'",
         Paragraph("Wait 2 minutes; if still offline, check API token", sTableCellLeft)],
        ["Risk Limits",
         "Daily loss limit and max drawdown are displayed correctly",
         Paragraph("Re-enter values in Settings and save", sTableCellLeft)],
        ["Position Capacity",
         "Max positions setting allows at least 1 new trade",
         Paragraph("Close stale positions or increase max positions", sTableCellLeft)],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(open_headers, open_rows,
                        col_widths=[100, 175, 175]))
    e.append(Spacer(1, 10))

    e.append(Paragraph("2.3 During Market Hours", sH2))
    e.append(Paragraph(
        "During market hours (9:15 AM to 3:30 PM IST), the system operates autonomously. It detects signals, "
        "places orders, manages positions, and exits trades without manual intervention. Your job during this "
        "time is monitoring, not micromanaging. Resist the urge to manually close positions or override signals "
        "unless there is a genuine emergency (see Section 6). The system's edge comes from its discipline — "
        "manual interference usually hurts more than it helps. Check the dashboard every 30-60 minutes. Focus "
        "on three things: (1) Are all positions being managed correctly? Look for the 'Managed' tag. (2) Is "
        "the daily P&L within your risk limits? The progress bar should not be near 100% of your daily loss "
        "limit. (3) Has the bias changed? If bias flips from BULLISH to BEARISH mid-day, the system will "
        "handle it automatically by exiting existing positions and waiting for new signals in the new direction.",
        sBody
    ))

    e.append(Paragraph("2.4 End of Day (After 3:30 PM)", sH2))
    e.append(Paragraph(
        "After the market closes, spend 10 minutes on this routine. The journal step is non-negotiable — it "
        "is how you build the data to improve your configuration over time. Without journaling, you are flying "
        "blind and cannot identify patterns in your trading performance.",
        sBody
    ))

    eod_headers = ["Time", "Action", "Purpose"]
    eod_rows = [
        ["3:30 PM", "Stop the engine (toggle OFF)", "Prevents any accidental after-hours orders"],
        ["3:35 PM", "Review all trades in the Signal Log", "Understand why each trade was taken and how it exited"],
        ["3:45 PM", "Check final Day P&L on dashboard", "Verify the number matches your Zerodha ledger"],
        ["3:50 PM", "Record a journal entry", "Note market conditions, your emotions, any anomalies, and lessons learned"],
        ["4:00 PM", "Check for open positions (should be zero)", "If any remain, they will be force-closed automatically, but verify"],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(eod_headers, eod_rows,
                        col_widths=[65, 195, 190]))
    e.append(Spacer(1, 10))

    e.append(Paragraph(
        "At the end of each trading week (Friday close), add one more step: review your weekly P&L and compare "
        "it against your expected performance based on backtesting. If the actual performance deviates significantly "
        "from backtested results (more than 30% difference in win rate or net P&L), investigate whether market "
        "conditions have changed or whether your configuration needs adjustment. This weekly review is your "
        "feedback loop — without it, you cannot improve.",
        sBody
    ))
    e.append(PageBreak())
    return e


# ─── Section 3: Understanding Your Dashboard ─────────────────────────────────
def section_3():
    e = []
    e.append(Paragraph("3. Understanding Your Dashboard", sH1))
    e.append(AccentRule(CONTENT_W, 1, ACCENT))
    e.append(Spacer(1, 8))

    e.append(Paragraph(
        "The dashboard is your command center. Every piece of information you need to monitor the system is "
        "displayed on a single screen. This section explains what each element means, what a healthy reading "
        "looks like, and what to do when something looks wrong. Do not just glance at the dashboard — learn "
        "to read it fluently. A skilled operator can diagnose most problems in under 30 seconds just by "
        "looking at the dashboard layout. The dashboard is organized into four main areas: the KPI cards "
        "at the top, the equity curve in the middle, the daily P&L chart below that, and the signal log "
        "at the bottom. Each area tells you something different about the system's state.",
        sBody
    ))

    e.append(Paragraph("3.1 KPI Cards", sH2))
    kpi_headers = ["KPI Card", "What It Shows", "Healthy Range", "Red Flag"]
    kpi_rows = [
        ["Capital",
         Paragraph("Current available capital after all realized gains and losses", sTableCellLeft),
         Paragraph("Should match your Zerodha balance (minus any non-DDLJ positions)", sTableCellLeft),
         Paragraph("Significantly different from Zerodha balance indicates a sync issue", sLossCell)],
        ["Day P&L",
         Paragraph("Net profit or loss for the current trading day, including open position mark-to-market", sTableCellLeft),
         Paragraph("Fluctuates during the day; check direction rather than exact number", sTableCellLeft),
         Paragraph("Near your daily loss limit (the progress bar is 80%+ red)", sLossCell)],
        ["Total P&L",
         Paragraph("Cumulative net profit or loss since you started using the system", sTableCellLeft),
         Paragraph("Should trend upward over weeks and months", sTableCellLeft),
         Paragraph("Declining consistently for 5+ trading days suggests config issues", sWarningCell)],
        ["Win Rate",
         Paragraph("Percentage of trades that closed in profit out of all closed trades", sTableCellLeft),
         Paragraph("45-55% is normal for trend-following; above 60% is excellent", sTableCellLeft),
         Paragraph("Below 35% for 20+ trades means your config needs review", sLossCell)],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(kpi_headers, kpi_rows,
                        col_widths=[65, 155, 130, 100]))
    e.append(Spacer(1, 10))

    e.append(Paragraph("3.2 Equity Curve", sH2))
    e.append(Paragraph(
        "The equity curve is the single most important chart on your dashboard. It plots your cumulative P&L "
        "over time, with each point representing the close of a trading day. A healthy equity curve rises "
        "steadily from left to right with small, manageable drawdowns along the way. Think of it like a "
        "staircase going up: each step up is a winning day, and each small dip between steps is a losing "
        "day. What you do not want to see is a cliff — a sharp, vertical drop that takes your equity down "
        "by more than 5% in a single day. That indicates your risk parameters are too aggressive or your "
        "circuit breakers are not triggering correctly. If the equity curve is flat or declining over a "
        "period of 2+ weeks, the market conditions may not be suitable for trend-following, and you should "
        "consider reducing position size or switching to paper mode until conditions improve.",
        sBody
    ))

    e.append(Paragraph("3.3 Daily P&L Chart", sH2))
    e.append(Paragraph(
        "The daily P&L chart shows a bar for each trading day. Green bars represent profitable days and red "
        "bars represent losing days. The height of each bar indicates the magnitude of the gain or loss. In a "
        "healthy system, green bars should be taller and more frequent than red bars. However, occasional large "
        "red bars are normal — trend-following systems typically have a win rate around 50%, which means you "
        "will have losing days roughly half the time. The key is that your average green bar should be larger "
        "than your average red bar, so that over time the net result is positive. If you see a cluster of 4+ "
        "consecutive red bars, it usually means the market is range-bound and the trend-following approach is "
        "struggling. The system's NEUTRAL bias should protect you during these periods by not taking new trades.",
        sBody
    ))

    e.append(Paragraph("3.4 Signal Log", sH2))
    e.append(Paragraph(
        "The signal log is a chronological list of everything the engine has done: entries, exits, bias changes, "
        "circuit breaker triggers, and system events. Each entry has a timestamp, an event type, and details. "
        "Learn to read these entries quickly. An 'ENTRY' event means the system found a signal and opened a "
        "position. An 'EXIT' event means a position was closed — the reason column tells you why (see Section "
        "8 for a full explanation of exit reasons). A 'BIAS_CHANGE' event means the 60-minute bias shifted "
        "direction. A 'CIRCUIT_BREAKER' event means a safety limit was hit and trading was paused. Review the "
        "signal log at the end of every day to understand the system's decision-making process. Over time, you "
        "will start to see patterns in when and why the system takes trades, which builds your confidence in "
        "the engine and helps you tune the configuration more effectively.",
        sBody
    ))

    e.append(Paragraph("3.5 Engine Status Indicators", sH2))
    status_headers = ["Indicator", "Green", "Red", "Yellow"]
    status_rows = [
        ["Connection", Paragraph("API token valid, receiving data", sProfitCell),
         Paragraph("Token expired or API unreachable", sLossCell),
         Paragraph("Connecting or intermittent connection", sWarningCell)],
        ["Engine", Paragraph("Running, scanning for signals", sProfitCell),
         Paragraph("Stopped or crashed", sLossCell),
         Paragraph("Paused (circuit breaker active)", sWarningCell)],
        ["Bias", Paragraph("Active bias (BULLISH or BEARISH)", sProfitCell),
         Paragraph("Error in bias calculation", sLossCell),
         Paragraph("NEUTRAL — no directional conviction", sWarningCell)],
        ["Position", Paragraph("Open position being managed", sProfitCell),
         Paragraph("Position in loss beyond expected range", sLossCell),
         Paragraph("Position near stop-loss", sWarningCell)],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(status_headers, status_rows,
                        col_widths=[70, 145, 130, 115]))
    e.append(Spacer(1, 10))
    e.append(PageBreak())
    return e


# ─── Section 4: Configuration Walkthrough ────────────────────────────────────
def section_4():
    e = []
    e.append(Paragraph("4. Configuration Walkthrough", sH1))
    e.append(AccentRule(CONTENT_W, 1, ACCENT))
    e.append(Spacer(1, 8))

    e.append(Paragraph(
        "The DDLJ system comes with sensible defaults that work well for most market conditions. However, "
        "no single configuration is optimal all the time. This section walks you through each configuration "
        "group, explains what each parameter does in practical terms, and tells you when and why you might "
        "want to change it. The most important rule of configuration changes: change one parameter at a time "
        "and observe the results for at least 5 trading days before changing another. Changing multiple "
        "parameters simultaneously makes it impossible to know which change caused the improvement or "
        "deterioration in performance. Always backtest a new configuration before applying it live.",
        sBody
    ))

    e.append(Paragraph("4.1 Trading Index", sH2))
    e.append(Paragraph(
        "Choose BankNifty if you want higher volatility and larger moves — the system will generate more signals "
        "and each trade will have a wider profit/loss range. Choose Nifty if you prefer a calmer instrument with "
        "more gradual trends and lower slippage. As a rule of thumb, if your account size is below Rs 1 lakh, "
        "Nifty is safer because BankNifty's lot size and premium levels require more capital per trade. If your "
        "account is above Rs 2 lakhs, BankNifty's higher volatility can generate better returns. You can switch "
        "indices at any time, but the change only takes effect from the next trading day — do not switch mid-session.",
        sBody
    ))

    e.append(Paragraph("4.2 EMA Settings", sH2))
    e.append(Paragraph(
        "The EMA (Exponential Moving Average) is the backbone of the DDLJ system. Two EMA periods matter: the "
        "bias EMA (on the 60-minute chart) and the signal EMA pair (fast and slow, on the 15-minute chart). "
        "The bias EMA default is 21 periods, which provides a smooth directional reading on the hourly chart. "
        "Increasing it (e.g., to 34) makes the bias slower to change — good in choppy markets to avoid whipsaws. "
        "Decreasing it (e.g., to 13) makes the bias more responsive — good in strong trending markets where you "
        "want to catch reversals earlier. The signal EMA pair default is 9/21. The fast EMA (9) reacts to recent "
        "price changes, while the slow EMA (21) provides the baseline. When the fast crosses above the slow, it "
        "signals a bullish entry. When it crosses below, a bearish entry. Do not change these unless you have "
        "backtested the new values over at least 3 months of historical data.",
        sBody
    ))

    e.append(Paragraph("4.3 Risk Management Parameters", sH2))
    e.append(Paragraph(
        "Risk parameters control how much of your capital is at stake. The daily risk percentage sets the maximum "
        "amount you can lose in a single day before the circuit breaker triggers and halts trading. The per-trade "
        "risk percentage sets how much capital you risk on each individual trade. The max positions setting limits "
        "how many trades can be open simultaneously. For beginners, the recommended settings are: 2% daily risk, "
        "1% per-trade risk, and max 2 positions. These conservative values ensure that even on a very bad day, "
        "you lose no more than 2% of your capital — a manageable amount that you can recover from. As you gain "
        "experience and confidence, you may increase per-trade risk to 1.5% and max positions to 3, but never "
        "exceed 3% daily risk or 4 simultaneous positions — the system was not designed for that level of exposure.",
        sBody
    ))

    e.append(Paragraph("4.4 Position Management", sH2))
    e.append(Paragraph(
        "Position management parameters control what happens after you enter a trade. The breakeven trigger moves "
        "your stop-loss to the entry price once the trade moves a certain percentage in your favor — this ensures "
        "that a winning trade never turns into a losing one. The default breakeven trigger is 50%, meaning if the "
        "price moves halfway to your target, the stop-loss moves to entry. The trailing stop tightens the stop-loss "
        "as the trade moves further into profit, locking in gains progressively. The default trailing step is 1 ATR, "
        "meaning the stop-loss moves up by 1 ATR for every 1 ATR the price moves in your favor. The max holding "
        "hours parameter forces an exit if a position has been open too long — the default is 5 hours, which prevents "
        "overnight risk and ensures you are not stuck in a stagnant trade that is consuming margin without moving.",
        sBody
    ))

    e.append(Paragraph("4.5 Signal Filters", sH2))
    e.append(Paragraph(
        "Signal filters reject low-quality signals before they become trades. The RSI threshold prevents entries "
        "when the market is overbought (RSI above 70) or oversold (RSI below 30) — in these extreme zones, "
        "reversals are more likely than continuations. The VIX threshold prevents entries when volatility is "
        "too high (VIX above 25) because spreads widen and slippage increases dramatically. The ATR minimum "
        "filter rejects signals when the market is too quiet — if ATR is below the threshold, there is not "
        "enough movement to generate a profitable trade. Adjust the VIX threshold based on your index: BankNifty "
        "typically has a higher VIX reading than Nifty, so you may need to set the threshold 2-3 points higher "
        "for BankNifty.",
        sBody
    ))

    e.append(Paragraph("4.6 Options Settings", sH2))
    e.append(Paragraph(
        "Options settings control how the system selects which option contract to trade. The strike selection mode "
        "(ITM, ATM, or OTM) determines how far from the current spot price the option strike will be. ITM options "
        "cost more but move more predictably with the index — recommended for beginners. ATM options are cheapest "
        "but have the highest time decay — they can lose value rapidly if the market does not move quickly. OTM "
        "options are speculative and should only be used by experienced operators who are willing to accept a lower "
        "probability of profit in exchange for a higher potential return. The strike offset controls how many strikes "
        "away from ATM the system will select — an offset of 1 with ITM mode means 1 strike in-the-money. The lot "
        "size determines how many lots to trade per signal. Start with 1 lot and increase only after you have "
        "demonstrated consistent profitability over 20+ trades.",
        sBody
    ))

    e.append(Paragraph("4.7 Configuration Reference Table", sH2))
    config_headers = ["Parameter", "Default", "Range", "When to Change"]
    config_rows = [
        ["Primary Index", Paragraph("BankNifty", sTableCellBold), "BankNifty / Nifty",
         "Switch to Nifty if capital < Rs 1L or market is very choppy"],
        ["Bias EMA Period", "21", "13 - 34",
         "Increase in choppy markets; decrease in strong trends"],
        ["Signal EMA Fast", "9", "5 - 13",
         "Decrease for faster entries; increase for fewer false signals"],
        ["Signal EMA Slow", "21", "15 - 34",
         "Increase for smoother signals; decrease for responsiveness"],
        ["Daily Risk %", "2%", "1% - 3%",
         Paragraph("Decrease during high VIX; increase only after 50+ profitable trades", sWarningCell)],
        ["Per-Trade Risk %", "1%", "0.5% - 2%",
         Paragraph("Never exceed 2% — this is your single-trade safety net", sLossCell)],
        ["Max Positions", "2", "1 - 4",
         "Start at 1; increase to 2 after 2 weeks of consistent performance"],
        ["Breakeven Trigger", "50%", "30% - 70%",
         "Lower to protect profits sooner; raise to give trades more room"],
        ["Trailing Stop Step", "1 ATR", "0.5 - 2 ATR",
         "Tighten in volatile markets; loosen in trending markets"],
        ["Max Holding Hours", "5", "3 - 7",
         "Reduce to 3 for scalping; increase to 7 for patient trend trades"],
        ["RSI Overbought", "70", "65 - 80",
         "Lower to filter out more risky long entries"],
        ["RSI Oversold", "30", "20 - 35",
         "Raise to filter out more risky short entries"],
        ["VIX Threshold", "25", "18 - 30",
         Paragraph("Lower during calm periods; raise during volatile weeks", sWarningCell)],
        ["ATR Minimum", "0.5", "0.3 - 1.0",
         "Lower if system is missing valid signals; raise if too many false entries"],
        ["Strike Selection", Paragraph("ITM", sTableCellBold), "ATM / ITM / DEEP_ITM",
         "Use ITM for safety; ATM for lower cost; DEEP_ITM for delta exposure"],
        ["Strike Offset", "1", "0 - 5",
         "Increase for deeper ITM/OTM; 0 means exact ATM"],
        ["Lot Size", "1", "1 - 10",
         Paragraph("Increase only after 20+ profitable trades at current lot size", sWarningCell)],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(config_headers, config_rows,
                        col_widths=[95, 60, 85, 210]))
    e.append(Spacer(1, 10))
    e.append(PageBreak())
    return e


# ─── Section 5: Risk Management Rules ────────────────────────────────────────
def section_5():
    e = []
    e.append(Paragraph("5. Risk Management Rules", sH1))
    e.append(AccentRule(CONTENT_W, 1, ACCENT))
    e.append(Spacer(1, 8))

    e.append(Paragraph(
        "Risk management is the single most important part of operating the DDLJ system. The system has three "
        "built-in circuit breakers that automatically halt trading when losses exceed safe thresholds. These are "
        "not suggestions — they are hard limits enforced by the engine. You cannot override a triggered circuit "
        "breaker during the current trading day. This is by design: the circuit breakers exist to protect you "
        "from the most dangerous trading behavior, which is revenge trading after a loss. When a circuit breaker "
        "triggers, the right response is to stop, review, and come back the next day with fresh eyes. The system "
        "makes this the only option, removing the temptation to 'just one more trade' your way out of a hole.",
        sBody
    ))

    e.append(Paragraph("5.1 The Three Circuit Breakers", sH2))
    cb_headers = ["Circuit Breaker", "Default Threshold", "What It Does", "How to Resume"]
    cb_rows = [
        ["Daily Loss Limit",
         Paragraph("2% of capital", sLossCell),
         Paragraph("Halts all new trades for the rest of the day. Open positions are managed normally (stop-loss and target remain active) but no new entries are taken.", sTableCellLeft),
         "Resets automatically at 9:15 AM the next trading day"],
        ["Max Drawdown",
         Paragraph("5% from equity peak", sLossCell),
         Paragraph("Same as Daily Loss Limit, but based on cumulative drawdown from your all-time equity high. If your account has grown to Rs 110,000 and then drops to Rs 104,500, the 5% drawdown limit is hit.", sTableCellLeft),
         "Resets automatically when equity reaches a new high"],
        ["Capital Floor",
         Paragraph("90% of initial capital", sLossCell),
         Paragraph("The hardest stop. If your total capital drops below 90% of what you started with, the engine stops completely and will not restart automatically. This prevents catastrophic account blow-up.", sTableCellLeft),
         Paragraph("Manual restart required after review. You must acknowledge the loss and re-configure risk parameters before the engine will start again.", sTableCellLeft)],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(cb_headers, cb_rows,
                        col_widths=[85, 75, 180, 110]))
    e.append(Spacer(1, 10))

    e.append(Paragraph("5.2 What Happens When a Circuit Breaker Triggers", sH2))
    e.append(Paragraph(
        "When any circuit breaker triggers, the dashboard displays a prominent red banner at the top of the screen "
        "with the name of the circuit breaker that was hit. The engine status indicator changes from green to yellow "
        "(paused). No new entry signals are processed. Any open positions continue to be managed with their existing "
        "stop-loss and target levels — the circuit breaker does not force-close open positions, because that could "
        "lock in losses unnecessarily. If you want to force-close a position during a circuit breaker pause, you can "
        "do so manually through the Positions panel (see Section 6). All circuit breaker events are logged in the "
        "signal log with a 'CIRCUIT_BREAKER' entry, including the threshold that was hit and the current loss amount. "
        "Review these entries carefully during your end-of-day journal routine to understand what went wrong.",
        sBody
    ))

    e.append(Paragraph("5.3 Adjusting Risk by Market Condition", sH2))
    e.append(Paragraph(
        "Market conditions change, and your risk parameters should adapt accordingly. The table below provides "
        "suggested risk settings for three broad market regimes based on India VIX. These are guidelines, not "
        "rules — use your judgment and always err on the side of caution. The key principle is: when uncertainty "
        "is high, reduce exposure; when conditions are favorable and you have a proven edge, you can increase "
        "exposure modestly. Never double your risk because of a winning streak, and never increase risk to "
        "recover losses — both are classic behavioral traps that destroy trading accounts.",
        sBody
    ))

    risk_headers = ["Parameter", "Low VIX (< 14)", "Normal VIX (14-22)", "High VIX (> 22)"]
    risk_rows = [
        ["Daily Risk %",
         Paragraph("2% — markets are calm, trends are clean", sProfitCell),
         "2% — standard setting",
         Paragraph("1% — reduce exposure, expect whipsaws", sWarningCell)],
        ["Per-Trade Risk %",
         Paragraph("1% — normal risk per trade", sProfitCell),
         "1% — standard setting",
         Paragraph("0.5% — cut risk in half for safety", sWarningCell)],
        ["Max Positions",
         "2 — can handle multiple positions in clean trends",
         "2 — standard setting",
         Paragraph("1 — limit to single position only", sWarningCell)],
        ["Lot Size",
         "1-2 — can increase if capital permits",
         "1 — standard setting",
         Paragraph("1 — do not increase lot size in volatile markets", sLossCell)],
        ["Strike Selection",
         "ITM — normal selection",
         "ITM — standard setting",
         Paragraph("DEEP_ITM — more delta, less gamma risk", sWarningCell)],
        ["Breakeven Trigger",
         "50% — standard protection",
         "50% — standard setting",
         Paragraph("30% — lock in profits earlier", sWarningCell)],
        ["VIX Threshold",
         Paragraph("Not needed (VIX already low)", sMuted),
         "25 — standard threshold",
         Paragraph("30 — allow trading in elevated VIX", sWarningCell)],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(risk_headers, risk_rows,
                        col_widths=[90, 125, 125, 110]))
    e.append(Spacer(1, 10))
    e.append(PageBreak())
    return e


# ─── Section 6: When Things Go Wrong ─────────────────────────────────────────
def section_6():
    e = []
    e.append(Paragraph("6. When Things Go Wrong", sH1))
    e.append(AccentRule(CONTENT_W, 1, ACCENT))
    e.append(Spacer(1, 8))

    e.append(Paragraph(
        "No system runs perfectly forever. Tokens expire, connections drop, configurations get misaligned, "
        "and positions sometimes get stuck. This section tells you exactly what to do in each common failure "
        "scenario. The most important rule when something goes wrong is: do not panic. The system is designed "
        "with multiple safety layers, and in most cases, your capital is protected even when the software "
        "malfunctions. The second most important rule is: fix the problem before restarting the engine. "
        "Restarting without fixing the root cause usually makes the problem recur, potentially causing more "
        "damage. Take a deep breath, identify the issue using the table below, follow the solution steps, "
        "and then resume trading.",
        sBody
    ))

    e.append(Paragraph("6.1 Common Problems and Solutions", sH2))
    prob_headers = ["Problem", "Symptoms", "Solution", "Prevention"]
    prob_rows = [
        ["Token Expired",
         Paragraph("Red connection indicator; 'Token Expired' error in signal log; no new candle data", sLossCell),
         Paragraph("1. Go to Settings. 2. Click 'Generate New Token' (redirects to Zerodha login). 3. Login and authorize. 4. Paste the new token. 5. Click 'Test Connection' — should show green.", sTableCellLeft),
         Paragraph("Tokens expire daily at 6:00 AM IST. Make token renewal part of your morning routine. The dashboard shows a warning 30 minutes before expiry.", sTableCellLeft)],
        ["Engine Stopped",
         Paragraph("Engine status shows red; no signal processing; dashboard frozen", sLossCell),
         Paragraph("1. Check the signal log for the last event before the stop. 2. If it says 'CIRCUIT_BREAKER', see Section 5. 3. If it says 'ERROR', note the error message. 4. Fix the underlying issue (usually token or config). 5. Toggle engine OFF then ON.", sTableCellLeft),
         Paragraph("Monitor the dashboard every 30-60 minutes during market hours. Set up browser notifications for engine status changes if available.", sTableCellLeft)],
        ["Position Stuck",
         Paragraph("Open position not being managed; stop-loss not updating; 'Unmanaged' tag in Positions panel", sLossCell),
         Paragraph("1. Click the position in the Positions panel. 2. Click 'Force Close' button. 3. Confirm the close. 4. The order will be placed at market price. 5. Verify the position is closed in Zerodha.", sTableCellLeft),
         Paragraph("Check the Positions panel every hour. Unmanaged positions are dangerous because stop-losses are not being trailed. If you see 'Unmanaged', investigate immediately.", sTableCellLeft)],
        ["Wrong Config",
         Paragraph("System taking trades with wrong lot size, wrong index, or unexpected risk levels", sWarningCell),
         Paragraph("1. Toggle engine OFF immediately. 2. Go to Settings and correct the parameter. 3. Click 'Save and Apply'. 4. Verify the new values are displayed. 5. Toggle engine ON.", sTableCellLeft),
         Paragraph("Always review config during morning routine. Take a screenshot of your Settings page at the start of each week for reference.", sTableCellLeft)],
        ["Connection Lost",
         Paragraph("Dashboard shows 'Connecting...'; no data updates; last candle timestamp is old", sWarningCell),
         Paragraph("1. Check your internet connection. 2. Refresh the browser page. 3. If still failing, check if Zerodha's API status page reports an outage. 4. If your connection is fine but Zerodha is down, wait for restoration.", sTableCellLeft),
         Paragraph("Use a wired internet connection instead of Wi-Fi. Keep a mobile hotspot as backup. The system's circuit breakers protect open positions even during disconnections.", sTableCellLeft)],
        ["Zerodha Outage",
         Paragraph("Cannot place orders; Kite website also down; API returns 5xx errors", sWarningCell),
         Paragraph("1. Do not attempt to place manual orders. 2. Wait for Zerodha to restore service. 3. The engine will reconnect automatically when the API is available. 4. Check open positions once service resumes.", sTableCellLeft),
         Paragraph("Cannot be prevented. Ensure stop-loss orders are always placed via the exchange (not just locally). DDLJ places SL orders on the exchange for this reason.", sTableCellLeft)],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(prob_headers, prob_rows,
                        col_widths=[70, 110, 150, 120]))
    e.append(Spacer(1, 10))

    e.append(Paragraph("6.2 What Happens to Open Positions During Disconnection", sH2))
    e.append(Paragraph(
        "If the system loses its connection to the Zerodha API, any open positions are still protected by "
        "their stop-loss orders, which are placed on the exchange (not just tracked locally in the DDLJ system). "
        "This means that even if DDLJ crashes entirely, the exchange will still execute your stop-loss if the "
        "price hits the level. This is a critical safety feature. However, trailing stop adjustments and "
        "breakeven moves will not be processed while disconnected. When the connection is restored, the system "
        "will resynchronize and update any stop-loss levels that should have been moved. In the worst case "
        "scenario — a disconnection lasting hours — your original stop-loss remains in place, capping your "
        "maximum loss on the trade. This is why the system always places the initial stop-loss on the exchange "
        "immediately after entry: it is your safety net regardless of what happens to the software.",
        sBody
    ))
    e.append(PageBreak())
    return e


# ─── Section 7: Reading the Bias ─────────────────────────────────────────────
def section_7():
    e = []
    e.append(Paragraph("7. Reading the Bias", sH1))
    e.append(AccentRule(CONTENT_W, 1, ACCENT))
    e.append(Spacer(1, 8))

    e.append(Paragraph(
        "The bias is the foundation of every trade the DDLJ system takes. Understanding how to read the bias, "
        "what it means in practical terms, and how it affects the system's behavior is essential for any operator. "
        "The bias is displayed prominently on the dashboard with both a text label and a color indicator. It "
        "updates every time a new 60-minute candle closes, which happens 6 times during a typical trading day "
        "(at 10:15, 11:15, 12:15, 1:15, 2:15, and 3:15 IST). Between these updates, the bias does not change, "
        "regardless of what the 15-minute chart is doing. This stability is by design — it prevents the system "
        "from reacting to short-term noise on the hourly timeframe.",
        sBody
    ))

    e.append(Paragraph("7.1 BULLISH Bias", sH2))
    e.append(Paragraph(
        "When the bias is BULLISH, the system believes the market is in an uptrend. It will only look for "
        "buy signals — specifically, it will scan for EMA crosses where the fast EMA crosses above the slow "
        "EMA, and for continuation signals where price pulls back to the EMA and bounces upward. On the "
        "dashboard, a BULLISH bias is shown with an upward arrow icon and a green color. When the bias is "
        "BULLISH, the Options Engine will select Call Options (CE) for any signals that fire. No Put Options "
        "(PE) will be considered, even if the 15-minute chart briefly shows a bearish pattern. The bias "
        "filters out all counter-trend signals. If the bias strength is 'Strong' (all three bias signals agree), "
        "the system has high confidence and you should trust its signals. If the strength is 'Moderate', the "
        "system will still take signals, but you should be prepared for a potential bias flip.",
        sBody
    ))

    e.append(Paragraph("7.2 BEARISH Bias", sH2))
    e.append(Paragraph(
        "When the bias is BEARISH, the system believes the market is in a downtrend. It will only look for "
        "sell signals — EMA crosses where the fast EMA crosses below the slow EMA, and continuation signals "
        "where price pulls back to the EMA and bounces downward. The dashboard shows a BEARISH bias with a "
        "downward arrow icon and a red color. The Options Engine selects Put Options (PE) for all signals. "
        "No Call Options (CE) will be considered. The same strength levels apply: 'Strong' means all three "
        "bias signals agree (price below EMA, EMA falling, lower highs/lower lows), while 'Moderate' means "
        "only two of three agree. A moderate bearish bias often occurs at the start of a downtrend before "
        "market structure has fully confirmed the reversal. These early entries can be profitable but carry "
        "more risk of a false signal.",
        sBody
    ))

    e.append(Paragraph("7.3 NEUTRAL Bias", sH2))
    e.append(Paragraph(
        "When the bias is NEUTRAL, the system has no directional conviction. This happens when the three bias "
        "signals disagree — for example, price is above the EMA (bullish) but the EMA is falling (bearish) "
        "and market structure shows no clear pattern. It also happens when the price is overextended (more "
        "than 3x ATR from the EMA), which signals that a reversal is more likely than a continuation. When "
        "the bias is NEUTRAL, the system will not take any new trades. Period. No exceptions. This is the "
        "system's way of saying 'I do not know what is happening, and I would rather sit on my hands than "
        "guess.' A NEUTRAL bias is shown on the dashboard with a horizontal line icon and a yellow color. "
        "It is not a cause for concern — it is a sign that the system is exercising discipline. Many beginner "
        "operators become frustrated during NEUTRAL periods and try to manually override the system. Do not "
        "do this. The NEUTRAL bias protects you from choppy, range-bound markets that are the primary cause "
        "of losses in trend-following systems.",
        sBody
    ))

    e.append(Paragraph("7.4 Bias Strength and Confidence", sH2))
    bias_headers = ["Strength", "Bias Signals", "Confidence Level", "Operator Guidance"]
    bias_rows = [
        ["Strong",
         "All 3 agree (EMA Position + Slope + Structure)",
         Paragraph("High", sProfitCell),
         "Trust the system fully. Signals in strong-bias direction are high-probability."],
        ["Moderate",
         "2 of 3 agree (must include EMA Position)",
         Paragraph("Medium", sWarningCell),
         "Take signals but monitor closely. A bias flip is more likely."],
        ["Weak",
         "Signals disagree or overextension detected",
         Paragraph("Low / NEUTRAL", sLossCell),
         "No new trades. Wait for clarity. Do not override."],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(bias_headers, bias_rows,
                        col_widths=[60, 140, 90, 160]))
    e.append(Spacer(1, 10))

    e.append(Paragraph("7.5 Bias Flip Mid-Trade", sH2))
    e.append(Paragraph(
        "One of the most important events to understand is the bias flip — when the bias changes direction while "
        "you have an open position. For example, you entered a bullish trade with a CE option, and then the bias "
        "flips to BEARISH. When this happens, the system automatically triggers a BIAS_FLIP exit on the existing "
        "position. This is not optional — the position is closed at market price, regardless of whether it is in "
        "profit or loss. The reasoning is simple: if the directional thesis of the trade has changed, there is no "
        "reason to hold the position. The market has told you that the trend is no longer in your favor, and "
        "continuing to hold would be gambling, not trading. A bias flip exit is always logged as 'BIAS_FLIP' in "
        "the signal log. It may feel frustrating when a flip closes a position that was nearly at target, but over "
        "hundreds of trades, bias flip exits save far more money than they cost by preventing large reversals.",
        sBody
    ))
    e.append(PageBreak())
    return e


# ─── Section 8: Understanding Trade Entries & Exits ──────────────────────────
def section_8():
    e = []
    e.append(Paragraph("8. Understanding Trade Entries and Exits", sH1))
    e.append(AccentRule(CONTENT_W, 1, ACCENT))
    e.append(Spacer(1, 8))

    e.append(Paragraph(
        "Every trade the DDLJ system takes follows a strict entry and exit process. Understanding this process "
        "helps you interpret what you see in the signal log and on the dashboard. When a trade is entered, you "
        "will see an ENTRY event in the signal log with the option contract details, entry price, stop-loss, "
        "and target. When a trade is exited, you will see an EXIT event with the exit price, P&L, and the "
        "exit reason. The exit reason is particularly important — it tells you why the trade was closed and "
        "whether the outcome was expected or unusual. This section walks you through the complete lifecycle "
        "of a trade from entry to exit, with practical guidance on interpreting each exit reason.",
        sBody
    ))

    e.append(Paragraph("8.1 Entry Process (Step by Step)", sH2))
    entry_headers = ["Step", "What Happens", "Dashboard Indicator", "Time"]
    entry_rows = [
        ["1. Bias Check",
         "Bias Engine reads 60m chart and determines direction",
         "Bias indicator shows BULLISH or BEARISH",
         "At each 60m candle close"],
        ["2. Signal Detection",
         "Signal Engine scans 15m chart for entry pattern matching bias",
         "No visible indicator until signal confirmed",
         "Every 15 minutes"],
        ["3. Filter Pass",
         "Signal passes through RSI, VIX, ATR, body size, and RR filters",
         "No visible indicator — filters run internally",
         "Instant (< 1 second)"],
        ["4. Options Selection",
         "Options Engine picks strike, type (CE/PE), and calculates premium",
         "No visible indicator — selection runs internally",
         "Instant (< 1 second)"],
        ["5. Order Placement",
         "System places a market order via Zerodha API",
         Paragraph("New position appears in Positions panel with 'Managed' tag", sProfitCell),
         "1-3 seconds"],
        ["6. SL Order Placement",
         "System places stop-loss order on the exchange immediately",
         "SL price shown in Positions panel",
         "1-2 seconds after entry"],
        ["7. Entry Logged",
         "Trade recorded in signal log with all details",
         Paragraph("ENTRY event appears in Signal Log", sProfitCell),
         "Immediate"],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(entry_headers, entry_rows,
                        col_widths=[70, 170, 135, 85]))
    e.append(Spacer(1, 10))

    e.append(Paragraph("8.2 Exit Reasons Explained", sH2))
    exit_headers = ["Exit Reason", "What Happened", "Is It Good or Bad?", "What to Do"]
    exit_rows = [
        ["TARGET_HIT",
         Paragraph("Price reached the target level (swing high/low). Trade closed in profit.", sTableCellLeft),
         Paragraph("Good — this is the ideal outcome. The system identified a target and the market reached it.", sProfitCell),
         "Nothing. Celebrate. Move on to the next trade."],
        ["STOP_LOSS",
         Paragraph("Price hit the stop-loss level. Trade closed at a loss limited to your per-trade risk.", sTableCellLeft),
         Paragraph("Neutral — losses are a normal part of trend-following. The SL did its job by capping the loss.", sWarningCell),
         "Check if the SL was reasonable (2x ATR from entry). If SL is being hit too often, the market may be choppy."],
        ["NEAR_TARGET",
         Paragraph("Price came within 10% of the target but did not quite reach it. System exits to lock in profit.", sTableCellLeft),
         Paragraph("Good — the system secured profit instead of risking a reversal. A near-miss target is still a win.", sProfitCell),
         "Nothing. Consider if the target was set too aggressively if this happens frequently."],
        ["BIAS_FLIP",
         Paragraph("The 60m bias changed direction while the position was open. System exits immediately.", sTableCellLeft),
         Paragraph("Mixed — the original thesis changed. Exiting protects capital, but the trade may have been profitable if held.", sWarningCell),
         "Review why the bias flipped. Was it a genuine trend change or a temporary whipsaw?"],
        ["TIME_EXIT",
         Paragraph("Position was open longer than the max holding hours (default 5 hours). System exits at market price.", sTableCellLeft),
         Paragraph("Neutral — the trade did not reach target or SL within the allowed time, suggesting the trade thesis is not playing out.", sWarningCell),
         "Review if max holding hours is too short for your trading style. Consider increasing to 6-7 hours."],
        ["FORCE_CLOSE",
         Paragraph("Operator manually clicked 'Force Close' on the position, or end-of-day cleanup closed it.", sTableCellLeft),
         Paragraph("Context-dependent — manual exits should be rare and only for emergencies.", sLossCell),
         "Review why you force-closed. If it was a system issue, see Section 6. If it was an emotional decision, reconsider."],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(exit_headers, exit_rows,
                        col_widths=[75, 155, 110, 110]))
    e.append(Spacer(1, 10))

    e.append(Paragraph(
        "The most common exit reason in a well-tuned system is TARGET_HIT, followed by STOP_LOSS. A healthy "
        "ratio is approximately 1:1 in terms of frequency (since the win rate is around 50%), but the average "
        "profit on TARGET_HIT exits should be 1.5x or more the average loss on STOP_LOSS exits. This is the "
        "mathematical edge that makes the system profitable over time: you lose small and win big, even though "
        "you win roughly half the time. If you see an increasing frequency of BIAS_FLIP exits, it suggests the "
        "market is in a transitional phase with no clear trend. The system will naturally shift to NEUTRAL bias "
        "in these conditions, reducing the number of trades and protecting your capital.",
        sBody
    ))
    e.append(PageBreak())
    return e


# ─── Section 9: Backtesting Your Configuration ──────────────────────────────
def section_9():
    e = []
    e.append(Paragraph("9. Backtesting Your Configuration", sH1))
    e.append(AccentRule(CONTENT_W, 1, ACCENT))
    e.append(Spacer(1, 8))

    e.append(Paragraph(
        "Before deploying any configuration change to live trading, you must backtest it. Backtesting runs your "
        "configuration against historical market data to simulate what would have happened if you had traded with "
        "those settings over the past several months. The DDLJ dashboard includes a built-in backtesting module "
        "that makes this process straightforward. This section explains how to run a backtest, how to read the "
        "results, and which metrics to prioritize when comparing different configurations. Backtesting is not a "
        "guarantee of future performance, but it is the best tool available for estimating whether a configuration "
        "change is likely to improve or harm your results. Never skip backtesting — a 10-minute backtest can save "
        "you weeks of live losses from a bad configuration.",
        sBody
    ))

    e.append(Paragraph("9.1 How to Run a Backtest", sH2))
    e.append(Paragraph(
        "From the dashboard, click the 'Backtest' tab in the navigation bar. You will see the backtesting "
        "configuration panel. Select the date range (minimum recommended: 3 months, ideal: 6-8 months), "
        "choose the index, and confirm the configuration parameters you want to test. The backtester uses "
        "the same engine logic as live trading but replays historical candles instead of live data. Click "
        "'Run Backtest' and wait for the results — this typically takes 30-90 seconds depending on the date "
        "range. The results will appear on the same page with a summary dashboard and detailed trade list. "
        "You can export the trade list as a CSV file for further analysis in a spreadsheet.",
        sBody
    ))

    e.append(Paragraph("9.2 Reading Backtest Results", sH2))
    metrics_headers = ["Metric", "What It Measures", "Good Range", "Critical If"]
    metrics_rows = [
        ["Win Rate",
         "Percentage of trades that closed in profit",
         "45% - 55%",
         Paragraph("Below 35% (system is entering too many losing trades)", sLossCell)],
        ["Net P&L",
         "Total profit or loss over the backtest period after all costs",
         Paragraph("Positive and growing over time", sProfitCell),
         Paragraph("Negative (system is losing money with this configuration)", sLossCell)],
        ["Max Drawdown",
         "Largest peak-to-trough decline in equity during the period",
         "Below 10%",
         Paragraph("Above 15% (risk is too high for the expected return)", sLossCell)],
        ["Sharpe Ratio",
         "Risk-adjusted return (higher = more return per unit of risk)",
         "Above 1.0",
         Paragraph("Below 0.5 (returns do not justify the risk taken)", sWarningCell)],
        ["Profit Factor",
         "Total profits divided by total losses",
         "Above 1.5",
         Paragraph("Below 1.2 (barely profitable, small changes could make it unprofitable)", sWarningCell)],
        ["Avg Trade P&L",
         "Average profit or loss per trade",
         Paragraph("Positive and meaningful (not just Rs 10 per trade)", sProfitCell),
         Paragraph("Near zero (system is generating friction, not profits)", sWarningCell)],
        ["Max Consecutive Losses",
         "Most losing trades in a row during the period",
         "3 - 5",
         Paragraph("7+ (psychologically very difficult to endure; may indicate config issues)", sLossCell)],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(metrics_headers, metrics_rows,
                        col_widths=[100, 145, 110, 95]))
    e.append(Spacer(1, 10))

    e.append(Paragraph("9.3 Which Metrics Matter Most", sH2))
    e.append(Paragraph(
        "If you had to look at only two numbers, they should be Net P&L and Max Drawdown. Net P&L tells you "
        "whether the configuration is profitable overall. Max Drawdown tells you whether the path to that "
        "profit is survivable — a system that makes Rs 50,000 but has a 30% drawdown along the way will "
        "cause most traders to abandon it before the profits materialize. The Profit Factor is the next most "
        "important metric because it tells you how efficient the system is: a profit factor of 2.0 means the "
        "system earns Rs 2 for every Rs 1 it loses. Win rate, while popular, is actually the least important "
        "metric because trend-following systems can be highly profitable with a 40% win rate if the average "
        "win is much larger than the average loss. Do not optimize for win rate at the expense of profit factor.",
        sBody
    ))

    e.append(Paragraph("9.4 Comparing Configurations", sH2))
    e.append(Paragraph(
        "When comparing two configurations, always use the same date range and the same index. Different "
        "date ranges can produce wildly different results because market conditions vary. After running "
        "backtests on both configurations, compare the key metrics side by side. Pay special attention to "
        "Max Drawdown — a configuration with slightly lower Net P&L but significantly lower Max Drawdown "
        "is usually preferable because it is easier to trade psychologically and less likely to trigger "
        "circuit breakers. Also compare the number of trades: a configuration that takes 200 trades in 6 "
        "months versus one that takes 50 trades are fundamentally different approaches. More trades means "
        "more statistical significance but also more transaction costs and more screen time. Fewer trades "
        "means lower costs but less data to evaluate performance.",
        sBody
    ))

    e.append(Paragraph("9.5 Paper Trading vs. Live Trading", sH2))
    e.append(Paragraph(
        "After backtesting, the next step is paper trading — running the system in live market conditions with "
        "simulated orders instead of real ones. Paper trading validates that the backtested performance "
        "translates to live conditions, where slippage, latency, and real-time decision-making differ from "
        "the backtest environment. Paper trade for a minimum of 5 trading days (ideally 2 weeks) before "
        "switching to live mode. Compare paper trading results to backtest results for the same period — if "
        "they are within 20% of each other, the configuration is likely sound. If paper results are "
        "significantly worse, investigate slippage, order execution timing, and whether the market conditions "
        "during the paper period were unusual. Only switch to live trading when you have confidence in both "
        "the backtest and the paper trading results.",
        sBody
    ))
    e.append(PageBreak())
    return e


# ─── Section 10: Going Live Checklist ────────────────────────────────────────
def section_10():
    e = []
    e.append(Paragraph("10. Going Live Checklist", sH1))
    e.append(AccentRule(CONTENT_W, 1, ACCENT))
    e.append(Spacer(1, 8))

    e.append(Paragraph(
        "Switching from paper trading to live trading is a significant step. Real money introduces emotions "
        "that do not exist in paper trading, and emotions are the enemy of systematic trading. This section "
        "provides a comprehensive checklist to complete before you go live, recommended starting parameters "
        "for your first week, and guidelines for when to scale up or step back. Do not skip any item on the "
        "pre-live checklist — each one exists because someone, at some point, lost money by not checking it. "
        "Going live is not a race; it is a transition that should be made deliberately and with full preparation.",
        sBody
    ))

    e.append(Paragraph("10.1 Pre-Live Checklist (10 Items)", sH2))
    live_headers = ["#", "Check Item", "How to Verify", "Pass Criteria"]
    live_rows = [
        ["1", "Backtest is profitable",
         Paragraph("Run backtest over 6+ months with current config", sTableCellLeft),
         Paragraph("Net P&L > 0, Max Drawdown < 10%, Profit Factor > 1.5", sProfitCell)],
        ["2", "Paper trading validated",
         Paragraph("Run 5+ days of paper trading with live market data", sTableCellLeft),
         Paragraph("Paper results within 20% of backtest expectations", sProfitCell)],
        ["3", "Zerodha account funded",
         Paragraph("Check account balance in Kite dashboard", sTableCellLeft),
         Paragraph("Balance >= Rs 50,000 (minimum) or your planned starting capital", sProfitCell)],
        ["4", "API token is fresh",
         Paragraph("Generate a new token on the day you go live", sTableCellLeft),
         Paragraph("Green connection indicator, no expiry warning", sProfitCell)],
        ["5", "Config matches your plan",
         Paragraph("Open Settings and verify every parameter against your written plan", sTableCellLeft),
         Paragraph("Every value matches; no surprises; no stale overrides", sProfitCell)],
        ["6", "Risk limits are conservative",
         Paragraph("Verify daily risk <= 2%, per-trade risk <= 1%", sTableCellLeft),
         Paragraph("Values are at or below recommended starting levels", sProfitCell)],
        ["7", "Engine mode is set to LIVE",
         Paragraph("Check the mode toggle on the dashboard", sTableCellLeft),
         Paragraph("Mode shows 'LIVE' (not 'PAPER') — but only after all other checks pass", sProfitCell)],
        ["8", "Stop-loss orders will be placed on exchange",
         Paragraph("Verify in Config that exchange_sl_order is set to true", sTableCellLeft),
         Paragraph("Setting is enabled — this protects you even if DDLJ crashes", sProfitCell)],
        ["9", "Journal template is ready",
         Paragraph("Have a notebook, spreadsheet, or Notion page ready for daily journaling", sTableCellLeft),
         Paragraph("You have a consistent format for recording trades, emotions, and observations", sProfitCell)],
        ["10", "Emergency plan is clear",
         Paragraph("You know how to force-close positions and stop the engine manually", sTableCellLeft),
         Paragraph("You have read Section 6 and can execute the steps without referring to the guide", sProfitCell)],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(live_headers, live_rows,
                        col_widths=[20, 100, 175, 155]))
    e.append(Spacer(1, 10))

    e.append(Paragraph("10.2 Recommended Starting Capital and Risk Settings", sH2))
    e.append(Paragraph(
        "For your first week of live trading, use the most conservative settings possible. The goal is not "
        "to maximize profits — it is to build confidence in the system and in yourself. Starting capital of "
        "Rs 50,000 is the minimum, but Rs 1,00,000 is recommended because it gives you more room to absorb "
        "the inevitable losing streaks that every trend-following system experiences. Use these settings for "
        "Week 1: daily risk 1.5%, per-trade risk 0.75%, max positions 1, lot size 1, index Nifty (less "
        "volatile than BankNifty). These settings limit your maximum daily loss to approximately Rs 750, "
        "which is a manageable amount that will not cause emotional distress. You can always increase later, "
        "but you can never undo a large loss from an overly aggressive start.",
        sBody
    ))

    start_headers = ["Parameter", "Week 1", "Week 2-3", "After 1 Month"]
    start_rows = [
        ["Daily Risk %",
         Paragraph("1.5%", sProfitCell),
         "2%", "2% (or 2.5% if profitable)"],
        ["Per-Trade Risk %",
         Paragraph("0.75%", sProfitCell),
         "1%", "1% (or 1.5% if profitable)"],
        ["Max Positions",
         "1", "2", "2 (or 3 if comfortable)"],
        ["Lot Size",
         "1", "1", Paragraph("1-2 (only if equity has grown)", sWarningCell)],
        ["Index",
         Paragraph("Nifty", sProfitCell),
         "Nifty or BankNifty", "Your choice based on results"],
        ["Strike Mode",
         Paragraph("ITM", sProfitCell),
         "ITM", "ITM or DEEP_ITM"],
    ]
    e.append(Spacer(1, 4))
    e.append(make_table(start_headers, start_rows,
                        col_widths=[100, 110, 120, 120]))
    e.append(Spacer(1, 10))

    e.append(Paragraph("10.3 First Week Monitoring Plan", sH2))
    e.append(Paragraph(
        "During your first week of live trading, increase your monitoring frequency compared to normal operation. "
        "Check the dashboard every 15-30 minutes instead of every hour. After each trade closes, review the "
        "entry and exit details immediately rather than waiting for end-of-day. Pay attention to your emotional "
        "state — if you feel anxious, excited, or fearful during trades, note it in your journal. These emotions "
        "are normal for new live traders, but they should diminish over time as you build trust in the system. "
        "If they do not diminish after 2 weeks, you may be risking too much — reduce your position size until "
        "you can watch a trade play out without excessive stress. The system is designed to be boring. If live "
        "trading feels like gambling, your risk is too high. Adjust downward until it feels manageable.",
        sBody
    ))

    e.append(Paragraph("10.4 When to Increase Lot Size", sH2))
    e.append(Paragraph(
        "Increase your lot size only when all three conditions are met: (1) You have completed at least 20 live "
        "trades at your current lot size. (2) Your net P&L over those 20 trades is positive. (3) You are "
        "emotionally comfortable with the current lot size — you can watch a losing trade without panic and a "
        "winning trade without excessive excitement. When you increase, go up by only 1 lot at a time. Do not "
        "double your lot size in a single step. After increasing, stay at the new level for at least another "
        "20 trades before considering another increase. This gradual approach ensures that your confidence and "
        "risk tolerance grow in proportion to your actual experience, not your perceived experience.",
        sBody
    ))

    e.append(Paragraph("10.5 When to Stop Trading and Review", sH2))
    e.append(Paragraph(
        "Stop trading and conduct a full review if any of the following conditions occur: (1) You hit the "
        "Capital Floor circuit breaker (capital dropped below 90% of initial). (2) You experience 5 consecutive "
        "losing days. (3) Your actual performance deviates from backtested performance by more than 30% over "
        "20+ trades. (4) Market conditions have fundamentally changed (e.g., a major regulatory event, a "
        "crash, or a prolonged period of extremely low volatility). When you stop for review, switch to paper "
        "trading mode and spend at least 3 days analyzing what went wrong. Review your signal log, compare "
        "your trades to what the backtest would have done, and check whether the issue is with the configuration, "
        "the market conditions, or your own emotional interference. Do not resume live trading until you have "
        "identified the root cause and made a specific, testable change to address it.",
        sBody
    ))
    e.append(PageBreak())
    return e


# ─── Build Document ──────────────────────────────────────────────────────────
def main():
    output_path = '/home/z/my-project/download/ddlj-strategy-guide.pdf'

    doc = TocDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN_LEFT,
        rightMargin=MARGIN_RIGHT,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
        title="DDLJ Trading System v9.1.0 — Strategy Guide",
        author="DDLJ Trading Systems",
    )

    elements = []
    elements.extend(build_title())
    elements.extend(build_toc())
    elements.extend(section_1())
    elements.extend(section_2())
    elements.extend(section_3())
    elements.extend(section_4())
    elements.extend(section_5())
    elements.extend(section_6())
    elements.extend(section_7())
    elements.extend(section_8())
    elements.extend(section_9())
    elements.extend(section_10())

    doc.multiBuild(elements)
    print(f"PDF generated: {output_path}")

    # Report file size
    size_bytes = os.path.getsize(output_path)
    if size_bytes > 1024 * 1024:
        size_str = f"{size_bytes / (1024 * 1024):.2f} MB"
    else:
        size_str = f"{size_bytes / 1024:.1f} KB"
    print(f"File size: {size_str}")


if __name__ == '__main__':
    main()
