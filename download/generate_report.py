#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — 8-Month Backtest Comprehensive Analysis Report
Generated: April 27, 2026
"""

import json
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, KeepTogether, CondPageBreak,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Font Registration ──
pdfmetrics.registerFont(TTFont('LiberationSerif', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif-Bold', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-Bold', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('LiberationSerif', normal='LiberationSerif', bold='LiberationSerif-Bold')
registerFontFamily('Carlito', normal='Carlito', bold='Carlito-Bold')

# ── Palette (auto-generated) ──
ACCENT       = colors.HexColor('#3597b8')
TEXT_PRIMARY  = colors.HexColor('#1b1c1d')
TEXT_MUTED    = colors.HexColor('#7e858b')
BG_SURFACE   = colors.HexColor('#dee3e7')
BG_PAGE      = colors.HexColor('#f1f3f4')
TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = BG_SURFACE

# ── Styles ──
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'CustomTitle', fontName='LiberationSerif', fontSize=22, leading=28,
    textColor=TEXT_PRIMARY, spaceAfter=12, alignment=TA_LEFT,
)
h1_style = ParagraphStyle(
    'CustomH1', fontName='LiberationSerif', fontSize=18, leading=24,
    textColor=ACCENT, spaceBefore=18, spaceAfter=10, alignment=TA_LEFT,
)
h2_style = ParagraphStyle(
    'CustomH2', fontName='LiberationSerif', fontSize=14, leading=20,
    textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=8, alignment=TA_LEFT,
)
h3_style = ParagraphStyle(
    'CustomH3', fontName='LiberationSerif', fontSize=12, leading=16,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6, alignment=TA_LEFT,
)
body_style = ParagraphStyle(
    'CustomBody', fontName='LiberationSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceAfter=8, alignment=TA_JUSTIFY,
)
caption_style = ParagraphStyle(
    'CustomCaption', fontName='LiberationSerif', fontSize=9, leading=13,
    textColor=TEXT_MUTED, spaceAfter=6, alignment=TA_CENTER,
)
header_cell_style = ParagraphStyle(
    'HeaderCell', fontName='LiberationSerif', fontSize=9.5, leading=13,
    textColor=TABLE_HEADER_TEXT, alignment=TA_CENTER,
)
cell_style = ParagraphStyle(
    'Cell', fontName='LiberationSerif', fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER,
)
cell_left_style = ParagraphStyle(
    'CellLeft', fontName='LiberationSerif', fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
)
bullet_style = ParagraphStyle(
    'CustomBullet', fontName='LiberationSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceAfter=4, alignment=TA_LEFT,
    leftIndent=18, bulletIndent=6,
)
callout_style = ParagraphStyle(
    'Callout', fontName='LiberationSerif', fontSize=10.5, leading=17,
    textColor=ACCENT, spaceAfter=8, alignment=TA_LEFT,
    leftIndent=12, borderWidth=0, borderPadding=6,
    backColor=colors.HexColor('#EBF5FB'),
)

# ── Load Results ──
with open('/home/z/my-project/download/v84_8month_results.json') as f:
    data = json.load(f)

# ── Page setup ──
page_width, page_height = A4
left_margin = 1.0 * inch
right_margin = 1.0 * inch
available_width = page_width - left_margin - right_margin

output_path = '/home/z/my-project/download/DDLJ_v84_8Month_Backtest_Analysis.pdf'

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=left_margin,
    rightMargin=right_margin,
    topMargin=0.8 * inch,
    bottomMargin=0.8 * inch,
)

story = []

# ══════════════════════════════════════════════════════════════════
# TITLE PAGE
# ══════════════════════════════════════════════════════════════════
story.append(Spacer(1, 80))
story.append(Paragraph('<b>DDLJ v8.4 Strategy</b>', ParagraphStyle(
    'BigTitle', fontName='LiberationSerif', fontSize=32, leading=40,
    textColor=ACCENT, alignment=TA_CENTER, spaceAfter=8,
)))
story.append(Paragraph('<b>8-Month Comprehensive Backtest Analysis</b>', ParagraphStyle(
    'SubTitle', fontName='LiberationSerif', fontSize=18, leading=24,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER, spaceAfter=24,
)))
story.append(Spacer(1, 20))

# Summary box
summary_data = [
    [Paragraph('<b>Parameter</b>', header_cell_style), Paragraph('<b>Value</b>', header_cell_style)],
    [Paragraph('Test Period', cell_left_style), Paragraph('Sep 1, 2025 - Apr 27, 2026 (8 months)', cell_left_style)],
    [Paragraph('Starting Capital', cell_left_style), Paragraph('Rs 50,000', cell_left_style)],
    [Paragraph('Max Daily Risk', cell_left_style), Paragraph('6%', cell_left_style)],
    [Paragraph('Max Open Positions', cell_left_style), Paragraph('2', cell_left_style)],
    [Paragraph('Risk Per Position', cell_left_style), Paragraph('OFF (No limit)', cell_left_style)],
    [Paragraph('Method A', cell_left_style), Paragraph('Full 8-month compounding', cell_left_style)],
    [Paragraph('Method B', cell_left_style), Paragraph('4 batches x 2 months, capital reset per batch', cell_left_style)],
    [Paragraph('Pricing Model', cell_left_style), Paragraph('Black-Scholes with real India VIX IV', cell_left_style)],
]
t = Table(summary_data, colWidths=[0.35 * available_width, 0.55 * available_width], hAlign='CENTER')
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
    ('BACKGROUND', (0, 1), (-1, 1), TABLE_ROW_EVEN),
    ('BACKGROUND', (0, 2), (-1, 2), TABLE_ROW_ODD),
    ('BACKGROUND', (0, 3), (-1, 3), TABLE_ROW_EVEN),
    ('BACKGROUND', (0, 4), (-1, 4), TABLE_ROW_ODD),
    ('BACKGROUND', (0, 5), (-1, 5), TABLE_ROW_EVEN),
    ('BACKGROUND', (0, 6), (-1, 6), TABLE_ROW_ODD),
    ('BACKGROUND', (0, 7), (-1, 7), TABLE_ROW_EVEN),
    ('BACKGROUND', (0, 8), (-1, 8), TABLE_ROW_ODD),
    ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
]))
story.append(t)
story.append(Spacer(1, 30))
story.append(Paragraph('April 27, 2026', ParagraphStyle(
    'DateLine', fontName='LiberationSerif', fontSize=12, leading=16,
    textColor=TEXT_MUTED, alignment=TA_CENTER,
)))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════
# SECTION 1: EXECUTIVE SUMMARY
# ══════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>1. Executive Summary</b>', h1_style))

story.append(Paragraph(
    'This report presents the results of an exhaustive 8-month backtest of the DDLJ v8.4 options trading '
    'strategy, covering the period from September 1, 2025 through April 27, 2026. The strategy was tested '
    'across 10 unique configurations spanning two instruments (BankNifty and Nifty), multiple timeframe '
    'combinations, and varying signal parameters. Each configuration was evaluated under two distinct testing '
    'methodologies to provide a comprehensive understanding of strategy performance under both compounding '
    'and batch-reset conditions.',
    body_style
))

story.append(Paragraph(
    'The backtest reveals that the DDLJ v8.4 strategy demonstrates strong performance when deployed on '
    'BankNifty with the 15-minute entry and 60-minute bias timeframe, generating returns of +568% under '
    'full compounding (Method A) and +503% under batch-reset conditions (Method B). However, the analysis '
    'also uncovers critical vulnerabilities: approximately 68% of total profits are concentrated in the '
    'March-April 2026 high-volatility period, the 5-minute timeframe leads to consistent capital destruction '
    'due to overtrading, and a capital protection bug allows account balances to go negative under extreme '
    'conditions. These findings are detailed extensively in the sections that follow.',
    body_style
))

story.append(Paragraph('<b>Key Finding: Best Configuration</b>', callout_style))
story.append(Paragraph(
    'BankNifty 15m entry x 60m bias, SL=2.0 ATR, RR=1.5, ITM options: Rs 283,979 (+568%) Method A, '
    'Rs 251,390 (+503%) Method B. All 4 batches were profitable in Method B, confirming consistency.',
    bullet_style
))

story.append(Paragraph('<b>Critical Bug: Negative Capital</b>', callout_style))
story.append(Paragraph(
    'Nifty 15x15 configuration ended with negative capital (-Rs 1,892). Position sizing does not prevent '
    'losses from exceeding available capital when two positions lose simultaneously in a high-VIX environment. '
    'This is a priority fix for v8.5.',
    bullet_style
))

# ══════════════════════════════════════════════════════════════════
# SECTION 2: PERFORMANCE OVERVIEW
# ══════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>2. Performance Overview</b>', h1_style))

story.append(Paragraph('<b>2.1 Method A: Full 8-Month Compounding</b>', h2_style))
story.append(Paragraph(
    'Under Method A, starting capital of Rs 50,000 is allowed to compound across the entire 8-month test '
    'period. This method demonstrates the maximum potential of the strategy but also exposes the full impact '
    'of drawdowns, as losses in early periods reduce the capital base available for recovery. The top four '
    'configurations all belong to BankNifty, confirming its superiority as the primary instrument for this '
    'strategy. The table below summarizes the performance of all 10 configurations tested.',
    body_style
))

# Performance table
sorted_a = sorted(data['method_a_full_compounding'].items(), key=lambda x: x[1].get('net_pnl', 0), reverse=True)
perf_data = [
    [Paragraph('<b>Config</b>', header_cell_style),
     Paragraph('<b>Net P&L</b>', header_cell_style),
     Paragraph('<b>Return</b>', header_cell_style),
     Paragraph('<b>Win Rate</b>', header_cell_style),
     Paragraph('<b>PF</b>', header_cell_style),
     Paragraph('<b>Max DD</b>', header_cell_style),
     Paragraph('<b>Sharpe</b>', header_cell_style),
     Paragraph('<b>Trades</b>', header_cell_style)]
]
for label, r in sorted_a:
    if r.get('total_trades', 0) == 0:
        continue
    ret_str = f'{r["net_pnl_pct"]:+.1f}%'
    pnl_str = f'Rs {r["net_pnl"]:,.0f}'
    perf_data.append([
        Paragraph(label, cell_left_style),
        Paragraph(pnl_str, cell_style),
        Paragraph(ret_str, cell_style),
        Paragraph(f'{r["win_rate"]:.0f}%', cell_style),
        Paragraph(f'{r["profit_factor"]:.1f}', cell_style),
        Paragraph(f'{r["max_dd_pct"]:.1f}%', cell_style),
        Paragraph(f'{r["sharpe_approx"]:.1f}', cell_style),
        Paragraph(str(r['total_trades']), cell_style),
    ])

col_widths = [0.24 * available_width, 0.14 * available_width, 0.10 * available_width,
              0.10 * available_width, 0.08 * available_width, 0.10 * available_width,
              0.10 * available_width, 0.10 * available_width]
t = Table(perf_data, colWidths=col_widths, hAlign='CENTER')
style_cmds = [
    ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
    ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
]
for i in range(1, len(perf_data)):
    bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
    style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
t.setStyle(TableStyle(style_cmds))
story.append(Spacer(1, 6))
story.append(t)
story.append(Paragraph('Table 1: Method A Performance Summary (Full Compounding)', caption_style))
story.append(Spacer(1, 12))

# Method A chart
chart_path = '/home/z/my-project/download/chart_monthly_pnl_heatmap.png'
if os.path.exists(chart_path):
    img = Image(chart_path, width=available_width * 0.95, height=available_width * 0.45)
    story.append(img)
    story.append(Paragraph('Figure 1: Monthly P&L Heatmap Across Top Configurations (Method A)', caption_style))
    story.append(Spacer(1, 12))

# ══════════════════════════════════════════════════════════════════
# SECTION 2.2: Method B
# ══════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>2.2 Method B: 4 Batches of 2 Months (Capital Reset)</b>', h2_style))
story.append(Paragraph(
    'Under Method B, capital resets to Rs 50,000 at the start of each 2-month batch. This method evaluates '
    'the strategy\'s consistency by measuring performance in discrete windows rather than relying on the '
    'compounding effect. A strategy that performs well under both methods demonstrates genuine robustness, '
    'while a strategy that only works under compounding may be masking underlying inconsistency with the '
    'amplification effect of a growing capital base.',
    body_style
))

story.append(Paragraph(
    'The BankNifty configurations shine under Method B, with all four BN configs achieving profitability '
    'in all 4 batches (4/4 batch consistency). This is a strong signal that the strategy has genuine edge '
    'on BankNifty rather than relying on a single lucky period. The Nifty configurations, however, show '
    'inconsistency: only 1-2 out of 4 batches are profitable, with the Jan-Feb 2026 batch being particularly '
    'destructive for Nifty ITM strategies. The batch reset methodology reveals that Nifty strategies suffer '
    'from extended drawdown periods that are masked by the compounding recovery in Method A.',
    body_style
))

chart_path = '/home/z/my-project/download/chart_batch_performance.png'
if os.path.exists(chart_path):
    img = Image(chart_path, width=available_width * 0.95, height=available_width * 0.45)
    story.append(img)
    story.append(Paragraph('Figure 2: Batch-by-Batch Performance (Method B)', caption_style))
    story.append(Spacer(1, 12))

# ══════════════════════════════════════════════════════════════════
# SECTION 3: VIX ENVIRONMENT ANALYSIS
# ══════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>3. VIX Environment Analysis</b>', h1_style))

story.append(Paragraph(
    'The 8-month test period spans two dramatically different market volatility regimes. The India VIX, '
    'which serves as the primary volatility benchmark for Indian markets, averaged approximately 10-12 during '
    'September through December 2025, representing a calm, low-volatility environment. From January 2026, '
    'VIX began rising gradually, reaching 13-15 levels. The most significant shift occurred in March-April '
    '2026, when VIX surged to an average of 20-22, indicating a high-volatility regime change. This dramatic '
    'shift in market conditions has profound implications for the strategy\'s performance.',
    body_style
))

story.append(Paragraph('<b>3.1 The VIX Bubble Effect</b>', h2_style))
story.append(Paragraph(
    'A critical finding is the disproportionate contribution of the high-VIX March-April period to overall '
    'returns. For the best configuration (BN 15x60 ITM), the March-April period contributed Rs 192,746, '
    'which represents 68% of the total 8-month profit. This concentration risk means that the impressive '
    'overall returns are heavily dependent on a specific market regime (high volatility with trending moves). '
    'If the same 8-month period had featured consistently low VIX (10-12 range), total returns would likely '
    'be far more modest, potentially in the range of +30-50% rather than +568%.',
    body_style
))

# VIX chart
chart_path = '/home/z/my-project/download/chart_vix_correlation.png'
if os.path.exists(chart_path):
    img = Image(chart_path, width=available_width * 0.95, height=available_width * 0.45)
    story.append(img)
    story.append(Paragraph('Figure 3: India VIX vs Monthly P&L Correlation', caption_style))
    story.append(Spacer(1, 12))

story.append(Paragraph(
    'The VIX-P&L correlation chart clearly shows that monthly P&L accelerates as VIX rises. This is '
    'mechanically expected: higher VIX means wider option premiums, which translates to larger absolute P&L '
    'per trade. However, the relationship is not linear. The strategy appears to benefit disproportionately '
    'from high VIX because: (1) trending moves become larger and more frequent, increasing the win rate on '
    'trend-following signals; (2) option premiums are larger, so winning trades produce bigger profits; and '
    '(3) the Black-Scholes pricing model with real VIX data captures the premium inflation accurately.',
    body_style
))

# VIX contribution table
vix_data_table = [
    [Paragraph('<b>Configuration</b>', header_cell_style),
     Paragraph('<b>Total P&L</b>', header_cell_style),
     Paragraph('<b>Mar-Apr P&L</b>', header_cell_style),
     Paragraph('<b>% of Total</b>', header_cell_style)]
]
for label, r in sorted_a:
    if r.get('total_trades', 0) == 0:
        continue
    mp = r.get('monthly_pnl', {})
    total = r.get('net_pnl', 0)
    mar_apr = mp.get('2026-03', 0) + mp.get('2026-04', 0)
    pct = f'{mar_apr / total * 100:.0f}%' if total != 0 else 'N/A'
    vix_data_table.append([
        Paragraph(label, cell_left_style),
        Paragraph(f'Rs {total:,.0f}', cell_style),
        Paragraph(f'Rs {mar_apr:,.0f}', cell_style),
        Paragraph(pct, cell_style),
    ])

col_widths2 = [0.34 * available_width, 0.20 * available_width, 0.22 * available_width, 0.16 * available_width]
t = Table(vix_data_table, colWidths=col_widths2, hAlign='CENTER')
style_cmds2 = [
    ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
    ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
]
for i in range(1, len(vix_data_table)):
    bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
    style_cmds2.append(('BACKGROUND', (0, i), (-1, i), bg))
t.setStyle(TableStyle(style_cmds2))
story.append(Spacer(1, 6))
story.append(t)
story.append(Paragraph('Table 2: Mar-Apr 2026 Contribution to Total Returns', caption_style))
story.append(Spacer(1, 12))

# ══════════════════════════════════════════════════════════════════
# SECTION 4: RISK ANALYSIS
# ══════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>4. Risk Analysis</b>', h1_style))

story.append(Paragraph('<b>4.1 Risk-Reward Profile</b>', h2_style))
story.append(Paragraph(
    'The risk-reward scatter plot below maps each configuration\'s maximum drawdown against its total return. '
    'The ideal position is the top-left quadrant (high return, low drawdown). BankNifty 15x60 ATM achieves '
    'the best risk-adjusted profile with only 16.5% maximum drawdown alongside +531% returns, yielding a '
    'return-to-drawdown ratio of 32:1. This is exceptional by any standard. Conversely, the 5-minute '
    'configurations occupy the bottom-right quadrant (high drawdown, negative returns), confirming that '
    'faster timeframes are inappropriate for this trend-following strategy.',
    body_style
))

chart_path = '/home/z/my-project/download/chart_risk_reward.png'
if os.path.exists(chart_path):
    img = Image(chart_path, width=available_width * 0.85, height=available_width * 0.55)
    story.append(img)
    story.append(Paragraph('Figure 4: Risk-Reward Profile (Return vs Max Drawdown)', caption_style))
    story.append(Spacer(1, 12))

story.append(Paragraph('<b>4.2 Daily Risk Limit Analysis</b>', h2_style))
story.append(Paragraph(
    'The 6% daily risk limit is designed to prevent catastrophic single-day losses. However, the backtest '
    'reveals that this limit is frequently breached in practice, particularly for the 5-minute timeframe '
    'configurations. The BankNifty 5x60 configuration hit the daily risk limit on 37 out of approximately '
    '100 trading days, meaning that on more than one-third of trading days, the strategy lost more than 6% '
    'of capital. Even the best-performing BN 15x60 ITM configuration hit the limit on 11 days. This occurs '
    'because the daily risk check happens before opening new positions, not after existing positions incur '
    'intraday losses. Once two positions are open, their combined loss can far exceed the 6% threshold.',
    body_style
))

story.append(Paragraph(
    'The root cause is that with options, the loss on a single trade can be many times the intended risk. '
    'A BankNifty ITM option with delta of 0.65 can lose Rs 3,000-8,000 per lot on a strong adverse move, '
    'even when the spot-level stop loss is only 2x ATR away. When two such positions are losing '
    'simultaneously, the daily loss can easily exceed Rs 10,000 (20% of a Rs 50,000 account). This is a '
    'fundamental flaw in the risk management architecture that must be addressed in the next version.',
    body_style
))

# ══════════════════════════════════════════════════════════════════
# SECTION 5: BUGS AND ISSUES
# ══════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>5. Bugs and Issues Identified</b>', h1_style))

story.append(Paragraph('<b>5.1 CRITICAL: Negative Capital Bug</b>', h2_style))
story.append(Paragraph(
    'The Nifty 15x15 ITM configuration ended with a final capital of <b>Rs -1,892</b>, meaning the account '
    'balance went below zero. This should never happen in a properly risk-managed system. The root cause is '
    'that position sizing in the options engine uses MAX_CAPITAL_PER_POSITION_PCT (40% of capital) to '
    'determine the number of lots, but does not account for the maximum potential loss on existing open '
    'positions. When two positions are open simultaneously and both hit their stop losses, the combined loss '
    'can exceed available capital. The fix requires implementing a pre-trade check that calculates the worst-case '
    'scenario (both existing positions hitting SL) before opening a new position, and rejecting the entry if '
    'the combined potential loss would reduce capital below a minimum threshold (e.g., 10% of starting capital).',
    body_style
))

story.append(Paragraph('<b>5.2 HIGH: Daily Risk Limit Ineffective with Multiple Positions</b>', h2_style))
story.append(Paragraph(
    'The 6% daily risk limit is checked before opening new positions but does not account for losses '
    'accumulating on already-open positions. With two simultaneous positions, the effective daily risk is '
    'approximately 12-20% rather than the intended 6%. The fix requires real-time tracking of unrealized P&L '
    'on open positions and incorporating this into the daily risk calculation. This would mean rejecting new '
    'entries when the combined realized + unrealized daily loss exceeds 6% of day-start capital, and '
    'potentially closing the worst-performing position proactively when the limit is breached.',
    body_style
))

story.append(Paragraph('<b>5.3 MEDIUM: Compounding Amplifies Drawdowns in Losing Streaks</b>', h2_style))
story.append(Paragraph(
    'The compounding effect in Method A amplifies both gains and losses. For losing configurations like '
    'NF_15x60_ITM, Method A produced -19.8% returns while Method B only lost -2.9%, a 586% worse outcome. '
    'This happens because compounding with losses reduces the capital base, making recovery increasingly '
    'difficult. The strategy would benefit from a "circuit breaker" that switches to reduced position sizing '
    'or pauses trading when capital falls below 80% of the starting value for any month.',
    body_style
))

story.append(Paragraph('<b>5.4 MEDIUM: 5-Minute Timeframe Overtrading</b>', h2_style))
story.append(Paragraph(
    'The 5-minute timeframe generates 200+ trades over 8 months, with stop loss hit rates of 57-67%. The '
    'high trade frequency combined with the transaction costs and bid-ask spreads creates a persistent drag '
    'that overwhelms any alpha from the signals. The signal quality on 5-minute candles is insufficient for '
    'the trend-following approach; the noise-to-signal ratio is too high, producing too many false entries. '
    'The recommendation is to deprecate the 5-minute entry timeframe entirely or require a much higher '
    'minimum body size filter (e.g., 0.5x ATR instead of 0.3x) to reduce false signals.',
    body_style
))

story.append(Paragraph('<b>5.5 LOW: Batch Boundary Not Aligned to Market Cycles</b>', h2_style))
story.append(Paragraph(
    'The 2-month batch boundaries in Method B are calendar-based and do not align with market volatility '
    'regimes. A volatility-adaptive batch system that resets when VIX crosses a threshold (e.g., VIX > 18 '
    'entering a high-volatility regime) would be more meaningful than calendar months. This would group '
    'similar market conditions together and provide more actionable performance metrics.',
    body_style
))

# ══════════════════════════════════════════════════════════════════
# SECTION 6: METHOD A vs METHOD B
# ══════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>6. Method A vs Method B Comparison</b>', h1_style))

story.append(Paragraph(
    'The comparison between Method A (compounding) and Method B (batch reset) reveals the true impact of '
    'compounding on the strategy. For profitable configurations, compounding adds a modest bonus of +6% to '
    '+20% over batch-reset returns. For losing configurations, however, compounding dramatically amplifies '
    'losses: NF_15x60_ITM loses -19.8% under compounding but only -2.9% under batch reset, a devastating '
    'difference. This asymmetry means that compounding is beneficial only when the strategy has a genuine '
    'positive edge; when the edge is marginal or negative, compounding acts as a loss multiplier.',
    body_style
))

chart_path = '/home/z/my-project/download/chart_method_comparison.png'
if os.path.exists(chart_path):
    img = Image(chart_path, width=available_width * 0.95, height=available_width * 0.50)
    story.append(img)
    story.append(Paragraph('Figure 5: Method A vs Method B Performance Comparison', caption_style))
    story.append(Spacer(1, 12))

# ══════════════════════════════════════════════════════════════════
# SECTION 7: DETAILED BATCH ANALYSIS
# ══════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>7. Detailed Batch Analysis (Best Config: BN 15x60 ITM)</b>', h1_style))

story.append(Paragraph(
    'This section provides a granular breakdown of the best-performing configuration (BankNifty 15m entry, '
    '60m bias, SL=2.0 ATR, RR=1.5, ITM options) across each of the four 2-month batches. Understanding '
    'batch-level performance is essential for evaluating strategy consistency and identifying market regime '
    'dependencies.',
    body_style
))

# Batch detail table
best_b = data['method_b_4batch_reset'].get('BN_15x60_sl2.0_RR1.5_ITM', {})
batch_stats = best_b.get('batch_stats', {})
dir_analysis = best_b.get('direction_analysis', {})
exit_analysis = best_b.get('exit_analysis', {})

batch_table_data = [
    [Paragraph('<b>Metric</b>', header_cell_style),
     Paragraph('<b>Batch 1: Sep-Oct</b>', header_cell_style),
     Paragraph('<b>Batch 2: Nov-Dec</b>', header_cell_style),
     Paragraph('<b>Batch 3: Jan-Feb</b>', header_cell_style),
     Paragraph('<b>Batch 4: Mar-Apr</b>', header_cell_style)]
]
batch_keys = ['2025_Batch5', '2025_Batch6', '2026_Batch1', '2026_Batch2']
metrics = [
    ('Total Trades', 'trades'),
    ('Win Rate', 'win_rate', '%'),
    ('Net P&L', 'net_pnl', 'Rs'),
    ('Avg P&L/Trade', 'avg_pnl', 'Rs'),
    ('Long P&L', 'long_pnl', 'Rs'),
    ('Short P&L', 'short_pnl', 'Rs'),
    ('Largest Win', 'largest_win', 'Rs'),
    ('Largest Loss', 'largest_loss', 'Rs'),
]
for metric_name, key, *unit in metrics:
    row = [Paragraph(f'<b>{metric_name}</b>', cell_left_style)]
    for bk in batch_keys:
        bs = batch_stats.get(bk, {})
        val = bs.get(key, 0)
        if unit and unit[0] == '%':
            row.append(Paragraph(f'{val:.0f}%', cell_style))
        elif unit and unit[0] == 'Rs':
            row.append(Paragraph(f'Rs {val:,.0f}', cell_style))
        else:
            row.append(Paragraph(str(val), cell_style))
    batch_table_data.append(row)

col_widths3 = [0.22 * available_width] + [0.195 * available_width] * 4
t = Table(batch_table_data, colWidths=col_widths3, hAlign='CENTER')
style_cmds3 = [
    ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
    ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
]
for i in range(1, len(batch_table_data)):
    bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
    style_cmds3.append(('BACKGROUND', (0, i), (-1, i), bg))
t.setStyle(TableStyle(style_cmds3))
story.append(Spacer(1, 6))
story.append(t)
story.append(Paragraph('Table 3: Batch-Level Performance (BN 15x60 ITM, Method B)', caption_style))
story.append(Spacer(1, 12))

story.append(Paragraph(
    'Batch 4 (Mar-Apr 2026) stands out dramatically with Rs 178,154 in profits, which is more than 3x the '
    'next best batch. The win rate in Batch 4 is 64%, significantly higher than the overall average of 50%. '
    'This batch coincides with the VIX surge to 20-22 levels, confirming that the strategy thrives in '
    'high-volatility trending environments. However, the lopsided distribution raises concerns about strategy '
    'viability during extended low-volatility periods like Batch 1 (Sep-Oct 2025) where profits were a '
    'modest Rs 4,277.',
    body_style
))

# ══════════════════════════════════════════════════════════════════
# SECTION 8: DIRECTION BIAS ANALYSIS
# ══════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>8. Direction Bias Analysis</b>', h1_style))

story.append(Paragraph(
    'The strategy shows significant direction-dependent performance, meaning that long and short trades '
    'perform differently depending on the market regime. During the Nov-Dec 2025 period (Batch 2), short '
    'trades on BankNifty achieved a 75% win rate versus 44% for longs. In contrast, during the Mar-Apr '
    '2026 period (Batch 4), long trades dominated with 83% win rate versus 40% for shorts. This pattern '
    'makes sense: the Nov-Dec period featured a mild bearish correction where short signals were more '
    'accurate, while Mar-Apr 2026 saw a strong bullish rally where longs naturally outperformed.',
    body_style
))

story.append(Paragraph(
    'The implication is that the strategy does not have an inherent long or short bias; it correctly adapts '
    'to the prevailing trend direction via the bias engine. However, the win rate asymmetry (shorts at 75% '
    'in bearish periods vs longs at 83% in bullish periods) suggests that the EMA crossover signals are '
    'slightly more reliable when trading in the direction of the dominant trend on the 60-minute timeframe. '
    'This is an encouraging finding that validates the multi-timeframe approach of the DDLJ strategy.',
    body_style
))

# ══════════════════════════════════════════════════════════════════
# SECTION 9: EXIT REASON ANALYSIS
# ══════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>9. Exit Reason Analysis</b>', h1_style))

story.append(Paragraph(
    'Understanding why trades are closed is critical for strategy optimization. The best configuration '
    '(BN 15x60 ITM) shows a near-equal split between stop loss exits (47%) and target exits (44%), with '
    'EOD force-closes accounting for 9%. This balanced SL-to-target ratio is a hallmark of a well-calibrated '
    'trend-following system: it means that the strategy captures trend moves approximately as often as it '
    'gets stopped out in reversals. For comparison, the losing 5-minute configurations have SL rates of '
    '57-67%, indicating that their signals are too noisy and get stopped out before the trend can develop.',
    body_style
))

story.append(Paragraph(
    'The target hit rate varies significantly by batch. In Batch 4 (Mar-Apr 2026), 64% of profitable exits '
    'came from target hits, with only 36% from stop losses. This reflects the strong trending environment '
    'where once a position is entered in the trend direction, the price often reaches the target before '
    'reversing. In Batch 1 (Sep-Oct 2025), the ratio is closer to 50-50, indicating a choppy, range-bound '
    'market where the trend-following approach generates more false signals.',
    body_style
))

# ══════════════════════════════════════════════════════════════════
# SECTION 10: OPTIONS-SPECIFIC ANALYSIS
# ══════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>10. Options-Specific Analysis</b>', h1_style))

story.append(Paragraph(
    'The Black-Scholes pricing model with real India VIX data provides realistic option premiums for '
    'backtesting. The average spread cost across all configurations is approximately Rs 11 per trade, which '
    'represents about 0.5-1.0% of the premium value depending on the VIX regime. The total spread cost for '
    '64 trades in the best configuration was Rs 711, which is negligible compared to the Rs 283,979 gross '
    'profit. This confirms that the spread model is not artificially inflating results.',
    body_style
))

story.append(Paragraph(
    'Call options (CE) generated Rs 184,868 in profits (52% of trades, 42% win rate) while put options '
    '(PE) generated Rs 99,110 (38% of trades, 61% win rate). The higher win rate on puts is notable and '
    'reflects the strategy\'s effectiveness in catching bearish moves, particularly during the Nov-Dec 2025 '
    'and Jan-Feb 2026 corrections. The average delta of 0.66 confirms that ITM options are being selected '
    'as configured, providing good directional exposure while maintaining some time value buffer against '
    'theta decay.',
    body_style
))

# ══════════════════════════════════════════════════════════════════
# SECTION 11: RECOMMENDATIONS
# ══════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>11. Recommendations</b>', h1_style))

story.append(Paragraph('<b>11.1 Priority Fixes for v8.5</b>', h2_style))

recs = [
    '<b>Fix Negative Capital Bug:</b> Implement a pre-trade capital check that calculates worst-case combined '
    'loss (all open positions hitting SL) before allowing new entries. If worst-case loss would reduce capital '
    'below 10% of starting capital, reject the entry. This is a critical safety fix that prevents account '
    'blow-ups in high-volatility scenarios.',

    '<b>Real-Time Daily Risk Enforcement:</b> Track unrealized P&L on open positions in real-time and '
    'incorporate it into the daily risk check. When realized + unrealized daily loss exceeds 6% of day-start '
    'capital, automatically close the worst-performing position and prevent new entries for the day. This '
    'closes the gap between the intended 6% daily risk and the actual 12-20% exposure.',

    '<b>Compounding Circuit Breaker:</b> Add a drawdown-based circuit breaker that reduces position sizing '
    'when capital falls below 80% of the starting value for any calendar month. When capital recovers above '
    '90%, resume normal sizing. This prevents the compounding death spiral observed in losing configurations.',
]

for rec in recs:
    story.append(Paragraph(rec, bullet_style))
    story.append(Spacer(1, 4))

story.append(Paragraph('<b>11.2 Strategy Improvements</b>', h2_style))

improvements = [
    '<b>Deprecate 5-Minute Entry:</b> Remove the 5-minute entry timeframe from the strategy or require '
    'significantly higher signal quality filters. The 5m timeframe consistently generates negative returns '
    'across both instruments due to excessive noise and overtrading. The 15-minute entry is the only viable '
    'timeframe for this trend-following approach.',

    '<b>Add VIX-Adaptive Position Sizing:</b> Reduce position size when VIX is below 12 (low volatility, '
    'range-bound market) and increase it when VIX is above 18 (high volatility, trending market). This '
    'would naturally capitalize on the VIX bubble effect while protecting capital during dull periods.',

    '<b>Implement Batch Performance Monitoring:</b> Track rolling 2-month performance in live trading and '
    'automatically reduce risk if any batch underperforms a minimum threshold (e.g., net P&L worse than '
    '-10% of starting capital). This provides an early warning system for regime changes.',

    '<b>Consider Nifty Only in High-VIX Regimes:</b> The Nifty strategy is marginally profitable or '
    'unprofitable in low-VIX periods but generates strong returns in high-VIX periods. A VIX-gated approach '
    'that only trades Nifty when VIX is above 15 would likely improve overall Nifty performance significantly.',
]

for imp in improvements:
    story.append(Paragraph(imp, bullet_style))
    story.append(Spacer(1, 4))

# ══════════════════════════════════════════════════════════════════
# SECTION 12: CONCLUSION
# ══════════════════════════════════════════════════════════════════
story.append(Paragraph('<b>12. Conclusion</b>', h1_style))

story.append(Paragraph(
    'The DDLJ v8.4 strategy demonstrates genuine edge on BankNifty with the 15-minute entry and 60-minute '
    'bias timeframe, achieving profitability in all four 2-month test batches under Method B. The strategy '
    'is particularly effective in high-volatility trending environments, where it captures significant '
    'directional moves through ITM options. However, the analysis also reveals critical vulnerabilities: '
    'the strategy is heavily dependent on high-VIX regimes for its returns (68% of profits from 25% of the '
    'test period), the risk management system allows losses to exceed intended limits when multiple positions '
    'are open simultaneously, and the 5-minute timeframe is fundamentally incompatible with the trend-following '
    'approach.',
    body_style
))

story.append(Paragraph(
    'The three most impactful improvements for v8.5 are: (1) implementing pre-trade worst-case capital checks '
    'to prevent negative balances, (2) enforcing real-time daily risk limits that account for unrealized P&L, '
    'and (3) adding a compounding circuit breaker that reduces position sizing during drawdowns. These fixes '
    'would transform the strategy from one that produces impressive but volatile returns into one that '
    'delivers more consistent, risk-controlled performance across varying market conditions. The foundation '
    'is solid; the risk management layer needs reinforcement.',
    body_style
))

# ── Build the document ──
doc.build(story)
print(f"Report generated: {output_path}")
