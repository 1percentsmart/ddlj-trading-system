import { describe, it, expect } from 'vitest';
import { normalizeTrade, normalizePosition } from '../lib/api';

// ============================================================================
// TEST: normalizeTrade
// ============================================================================

describe('normalizeTrade', () => {
  it('should normalize in-memory trade format', () => {
    const raw = {
      id: '0',
      symbol: 'BANKNIFTY',
      direction: 'LONG',
      entry: 53000,
      exit: 53250,
      entry_time: '2026-04-30T09:30:00+05:30',
      exit_time: '2026-04-30T10:15:00+05:30',
      sl: 52700,
      target: 53500,
      qty: 30,
      gross: 7500,
      costs: 180,
      net: 7320,
      exit_reason: 'TARGET',
      rr: 2.5,
      held: '8',
      mode: 'options',
      option_strike: 53100,
      option_type: 'CE',
    };

    const trade = normalizeTrade(raw);
    expect(trade.id).toBe('0');
    expect(trade.entry).toBe(53000);
    expect(trade.exit).toBe(53250);
    expect(trade.gross).toBe(7500);
    expect(trade.net).toBe(7320);
    expect(trade.option_type).toBe('CE');
    expect(trade.option_strike).toBe(53100);
  });

  it('should normalize DB trade format', () => {
    const raw = {
      id: 1,
      session_id: 'session_20260430_091500',
      symbol: 'BANKNIFTY',
      direction: 'LONG',
      entry_price: 53000,
      exit_price: 53250,
      entry_time: '2026-04-30T09:30:00+05:30',
      exit_time: '2026-04-30T10:15:00+05:30',
      sl: 52700,
      target: 53500,
      qty: 30,
      gross_pnl: 7500,
      costs: 180,
      net_pnl: 7320,
      exit_reason: 'TARGET',
      rr: 2.5,
      mode: 'options',
    };

    const trade = normalizeTrade(raw);
    expect(trade.id).toBe('1'); // numeric id converted to string
    expect(trade.entry).toBe(53000);
    expect(trade.exit).toBe(53250);
    expect(trade.gross).toBe(7500);
    expect(trade.net).toBe(7320);
  });

  it('should handle missing optional fields', () => {
    const raw = {
      symbol: 'BANKNIFTY',
      direction: 'SHORT',
      entry: 53000,
      exit: 52800,
      entry_time: '2026-04-30T09:30:00+05:30',
      exit_time: '2026-04-30T10:15:00+05:30',
      sl: 53300,
      target: 52500,
      qty: 30,
      gross: -6000,
      costs: 180,
      net: -6180,
      exit_reason: 'SL',
      rr: 0,
      held: '4',
      mode: 'futures',
    };

    const trade = normalizeTrade(raw);
    expect(trade.option_strike).toBeUndefined();
    expect(trade.option_type).toBeUndefined();
  });

  it('should default held to empty string when missing', () => {
    const raw = {
      symbol: 'BANKNIFTY',
      direction: 'LONG',
      entry: 53000,
      exit: 53100,
      entry_time: '2026-04-30T09:30:00+05:30',
      exit_time: '2026-04-30T10:15:00+05:30',
      sl: 52700,
      target: 53500,
      qty: 30,
      gross: 3000,
      costs: 180,
      net: 2820,
      exit_reason: 'TARGET',
      rr: 1.5,
      mode: 'futures',
    };

    const trade = normalizeTrade(raw);
    expect(trade.held).toBe('');
  });

  it('should default mode to futures when missing', () => {
    const raw = {
      symbol: 'BANKNIFTY',
      direction: 'LONG',
      entry: 53000,
      exit: 53100,
      entry_time: '2026-04-30T09:30:00+05:30',
      exit_time: '2026-04-30T10:15:00+05:30',
      sl: 52700,
      target: 53500,
      qty: 30,
      gross: 3000,
      costs: 180,
      net: 2820,
      exit_reason: 'TARGET',
      rr: 1.5,
      held: '5',
    };

    const trade = normalizeTrade(raw);
    expect(trade.mode).toBe('futures');
  });

  it('should prefer entry over entry_price when both present', () => {
    const raw = {
      symbol: 'BANKNIFTY',
      direction: 'LONG',
      entry: 53000,
      entry_price: 53100,
      exit: 53250,
      exit_price: 53350,
      entry_time: '2026-04-30T09:30:00+05:30',
      exit_time: '2026-04-30T10:15:00+05:30',
      sl: 52700,
      target: 53500,
      qty: 30,
      gross: 7500,
      costs: 180,
      net: 7320,
      exit_reason: 'TARGET',
      rr: 2.5,
      held: '8',
      mode: 'futures',
    };

    const trade = normalizeTrade(raw);
    expect(trade.entry).toBe(53000);
    expect(trade.exit).toBe(53250);
  });

  it('should prefer gross over gross_pnl when both present', () => {
    const raw = {
      symbol: 'BANKNIFTY',
      direction: 'LONG',
      entry: 53000,
      exit: 53250,
      entry_time: '2026-04-30T09:30:00+05:30',
      exit_time: '2026-04-30T10:15:00+05:30',
      sl: 52700,
      target: 53500,
      qty: 30,
      gross: 7500,
      gross_pnl: 8000,
      costs: 180,
      net: 7320,
      net_pnl: 7820,
      exit_reason: 'TARGET',
      rr: 2.5,
      held: '8',
      mode: 'futures',
    };

    const trade = normalizeTrade(raw);
    expect(trade.gross).toBe(7500);
    expect(trade.net).toBe(7320);
  });

  it('should convert numeric id to string', () => {
    const raw = {
      id: 42,
      symbol: 'BANKNIFTY',
      direction: 'LONG',
      entry: 53000,
      exit: 53250,
      entry_time: '2026-04-30T09:30:00+05:30',
      exit_time: '2026-04-30T10:15:00+05:30',
      sl: 52700,
      target: 53500,
      qty: 30,
      gross: 7500,
      costs: 180,
      net: 7320,
      exit_reason: 'TARGET',
      rr: 2.5,
      held: '8',
      mode: 'futures',
    };

    const trade = normalizeTrade(raw);
    expect(trade.id).toBe('42');
    expect(typeof trade.id).toBe('string');
  });

  it('should use session_id as fallback for id', () => {
    const raw = {
      session_id: 'session_20260430',
      symbol: 'BANKNIFTY',
      direction: 'LONG',
      entry: 53000,
      exit: 53250,
      entry_time: '2026-04-30T09:30:00+05:30',
      exit_time: '2026-04-30T10:15:00+05:30',
      sl: 52700,
      target: 53500,
      qty: 30,
      gross: 7500,
      costs: 180,
      net: 7320,
      exit_reason: 'TARGET',
      rr: 2.5,
      held: '8',
      mode: 'futures',
    };

    const trade = normalizeTrade(raw);
    expect(trade.id).toBe('session_20260430');
  });
});

// ============================================================================
// TEST: normalizePosition
// ============================================================================

describe('normalizePosition', () => {
  it('should normalize in-memory position format', () => {
    const raw = {
      id: '0',
      symbol: 'BANKNIFTY',
      direction: 'LONG',
      entry: 53000,
      entry_time: '2026-04-30T09:30:00+05:30',
      qty: 30,
      sl: 52700,
      target: 53500,
      rr: 2.5,
      held: '3',
      be_done: false,
      atr_at_entry: 265,
      option_strike: 53100,
      option_type: 'CE',
    };

    const pos = normalizePosition(raw);
    expect(pos.id).toBe('0');
    expect(pos.entry).toBe(53000);
    expect(pos.option_type).toBe('CE');
    expect(pos.be_done).toBe(false);
    expect(pos.atr_at_entry).toBe(265);
  });

  it('should normalize DB position format', () => {
    const raw = {
      id: 1,
      symbol: 'BANKNIFTY',
      direction: 'LONG',
      entry_price: 53000,
      entry_time: '2026-04-30T09:30:00+05:30',
      qty: 30,
      sl: 52700,
      target: 53500,
      rr: 2.5,
      status: 'open',
    };

    const pos = normalizePosition(raw);
    expect(pos.id).toBe('1');
    expect(pos.entry).toBe(53000);
  });

  it('should apply defaults for missing fields', () => {
    const raw = {
      symbol: 'BANKNIFTY',
      direction: 'SHORT',
      entry: 53000,
      entry_time: '2026-04-30T09:30:00+05:30',
      qty: 30,
      sl: 53300,
      target: 52500,
      rr: 1.5,
    };

    const pos = normalizePosition(raw);
    expect(pos.be_done).toBe(false);
    expect(pos.atr_at_entry).toBe(0);
    expect(pos.held).toBe('');
  });

  it('should prefer entry over entry_price when both present', () => {
    const raw = {
      symbol: 'BANKNIFTY',
      direction: 'LONG',
      entry: 53000,
      entry_price: 53100,
      entry_time: '2026-04-30T09:30:00+05:30',
      qty: 30,
      sl: 52700,
      target: 53500,
      rr: 2.5,
    };

    const pos = normalizePosition(raw);
    expect(pos.entry).toBe(53000);
  });

  it('should convert numeric id to string', () => {
    const raw = {
      id: 7,
      symbol: 'BANKNIFTY',
      direction: 'LONG',
      entry: 53000,
      entry_time: '2026-04-30T09:30:00+05:30',
      qty: 30,
      sl: 52700,
      target: 53500,
      rr: 2.5,
    };

    const pos = normalizePosition(raw);
    expect(pos.id).toBe('7');
    expect(typeof pos.id).toBe('string');
  });

  it('should preserve optional fields when present', () => {
    const raw = {
      id: '0',
      symbol: 'BANKNIFTY',
      direction: 'LONG',
      entry: 53000,
      entry_time: '2026-04-30T09:30:00+05:30',
      qty: 30,
      sl: 52700,
      target: 53500,
      rr: 2.5,
      current_premium: 250,
      unrealized_pnl: 1500,
      option_strike: 53100,
      option_type: 'PE',
    };

    const pos = normalizePosition(raw);
    expect(pos.current_premium).toBe(250);
    expect(pos.unrealized_pnl).toBe(1500);
    expect(pos.option_strike).toBe(53100);
    expect(pos.option_type).toBe('PE');
  });
});
