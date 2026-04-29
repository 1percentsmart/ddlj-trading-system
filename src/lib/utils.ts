/**
 * DDLJ Trading System — Utility Functions
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, format?: 'indian' | 'international'): string {
  const isNegative = value < 0;
  const abs = Math.abs(value);
  const numFormat = format ?? 'indian';
  if (abs >= 10000000) return `${isNegative ? '-' : ''}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${isNegative ? '-' : ''}₹${(abs / 100000).toFixed(2)} L`;
  const locale = numFormat === 'international' ? 'en-US' : 'en-IN';
  return `${isNegative ? '-' : ''}₹${abs.toLocaleString(locale)}`;
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function pnlColor(value: number): string {
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-zinc-400';
}

export function pnlBgColor(value: number): string {
  if (value > 0) return 'bg-emerald-500/10';
  if (value < 0) return 'bg-red-500/10';
  return 'bg-zinc-500/10';
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(isoString: string): string {
  return `${formatDate(isoString)} ${formatTime(isoString)}`;
}

export function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function biasColor(bias: string): string {
  switch (bias) {
    case 'BULLISH': return 'text-emerald-400';
    case 'BEARISH': return 'text-red-400';
    case 'NEUTRAL': return 'text-amber-400';
    default: return 'text-zinc-400';
  }
}
