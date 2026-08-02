from __future__ import annotations

import asyncio
import logging
from typing import Any

from playwright.async_api import Page

from src.stakes_config import format_stakes
from src.betting_config import format_limit
from src.models import BetSide, SIDE_LABEL
from src.pattern_analyzer import (
    analyze_patterns,
    filter_history,
    format_full_history,
    pattern_catalog,
    pattern_priority_hint,
)

logger = logging.getLogger(__name__)

OVERLAY_ID = "toolbet-overlay"
OVERLAY_LEFT_ID = "toolbet-overlay-left"
OVERLAY_STYLE_ID = "toolbet-overlay-style"

PANELS_DOM_CHECK = """
() => {
  const right = document.getElementById('toolbet-overlay');
  const left = document.getElementById('toolbet-overlay-left');
  const center = document.getElementById('toolbet-overlay-center');
  const patterns = document.getElementById('tb-patterns');
  const stakes = document.getElementById('tb-stakes-input');
  const toggle = document.getElementById('tb-auto-toggle');
  const suggest = document.getElementById('tb-suggest-btn');
  const daily = document.getElementById('tb-daily-btn');
  const body = document.getElementById('tb-body-content');
  const table = document.getElementById('tb-table');
  const groupProg = document.getElementById('tb-group-progress');
  const stakesMid = document.getElementById('tb-stakes-mid');
  const leftBlocks = left && left.querySelectorAll('.tb-block').length >= 2;
  return !!(right && left && center && patterns && stakes && stakesMid && toggle && suggest && daily && body && table && groupProg && leftBlocks);
}
"""

INSTALL_SCRIPT = """
(opts) => {
  const stakesText = (opts && opts.stakesText) || '[20, 50, 100, 200]';
  const autoBet = !!(opts && opts.autoBet);
  const stopLoss = (opts && opts.stopLoss) || '';
  const takeProfit = (opts && opts.takeProfit) || '';
  const groupTakeProfit = (opts && opts.groupTakeProfit) || '';
  const groupStopLoss = (opts && opts.groupStopLoss) || '';
  const progressionMode = (opts && opts.progressionMode) || 'loss_up_win_reset';
  const lossWatchRecover = !!(opts && opts.lossWatchRecover);

  const oldRight = document.getElementById('toolbet-overlay');
  if (oldRight && (oldRight.querySelector('#tb-controls') || oldRight.querySelector('#tb-patterns-section'))) {
    oldRight.remove();
    document.getElementById('toolbet-overlay-left')?.remove();
    document.getElementById('toolbet-overlay-center')?.remove();
  }
  if (!document.getElementById('toolbet-overlay-center')) {
    document.getElementById('toolbet-overlay-style')?.remove();
  }

  // Panel trai con khoi chuoi cuoc cu -> tao lai (chuoi da chuyen ra giua)
  const leftOld = document.getElementById('toolbet-overlay-left');
  if (leftOld && (leftOld.querySelector('#tb-stakes-section') || !leftOld.querySelector('.tb-block'))) {
    leftOld.remove();
    document.getElementById('toolbet-overlay-style')?.remove();
  }
  // Center cu chua co chuoi giua -> tao lai
  const centerOld = document.getElementById('toolbet-overlay-center');
  if (centerOld && !centerOld.querySelector('#tb-stakes-mid')) {
    centerOld.remove();
    document.getElementById('toolbet-overlay-style')?.remove();
  }

  // Cap nhat CSS layout (can 3 khoi + font)
  const styleOld = document.getElementById('toolbet-overlay-style');
  if (styleOld && !styleOld.textContent.includes('tb-layout-v3')) {
    styleOld.remove();
  }

  if (!document.getElementById('toolbet-overlay-style')) {
    const style = document.createElement('style');
    style.id = 'toolbet-overlay-style';
    style.textContent = `
    /* tb-layout-v3 */
    .toolbet-panel {
      position: fixed; max-height: 85vh; overflow: hidden; z-index: 2147483647;
      font-family: 'Segoe UI', system-ui, sans-serif; font-size: 13px; color: #e8edf5;
      background: rgba(12, 18, 32, 0.94); border: 1px solid rgba(99, 179, 237, 0.35);
      border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.45);
      backdrop-filter: blur(8px); pointer-events: auto; user-select: none;
    }
    #toolbet-overlay-left { top: 62px; left: 12px; width: 360px; }
    #toolbet-overlay { top: 62px; right: 12px; width: 320px; }
    #toolbet-overlay-center {
      top: 62px; left: 50%; transform: translateX(-50%);
      width: min(780px, 92vw); max-height: none; overflow: visible;
      pointer-events: none; border-color: rgba(56, 189, 248, 0.45);
      background: transparent; border: none; box-shadow: none;
    }
    #toolbet-overlay-center .tb-stakes-mid {
      pointer-events: auto; margin: 0 0 8px; padding: 8px 10px 10px;
      border-radius: 10px; border: 1px solid rgba(56, 189, 248, 0.4);
      background: rgba(12, 18, 32, 0.94); box-shadow: 0 8px 28px rgba(0,0,0,0.45);
    }
    #toolbet-overlay-center .tb-stakes-mid-label {
      font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      color: #7dd3fc; margin-bottom: 6px;
    }
    #toolbet-overlay-center .tb-stakes-row { display: flex; gap: 8px; align-items: center; }
    #toolbet-overlay-center .tb-stakes-input {
      flex: 1; min-width: 0; width: 100%; box-sizing: border-box;
      padding: 8px 10px; font-size: 14px; font-family: ui-monospace, Consolas, monospace;
      border-radius: 6px; border: 1px solid rgba(99,179,237,0.35);
      background: rgba(8,12,20,0.9); color: #e2e8f0; outline: none;
    }
    #toolbet-overlay-center .tb-stakes-input:focus { border-color: #38bdf8; }
    #toolbet-overlay-center .tb-stakes-save {
      flex-shrink: 0; border: none; border-radius: 6px; padding: 8px 14px;
      background: rgba(56,189,248,0.28); color: #e0f2fe; font-weight: 700; cursor: pointer;
    }
    #toolbet-overlay-center .tb-stakes-save:hover { background: rgba(56,189,248,0.4); }
    #toolbet-overlay-center .tb-stakes-msg { font-size: 10px; margin-top: 4px; min-height: 14px; }
    #toolbet-overlay-center .tb-stakes-msg.ok { color: #4ade80; }
    #toolbet-overlay-center .tb-stakes-msg.err { color: #f87171; }
    #toolbet-overlay-center .tb-stake-steps {
      display: flex; flex-wrap: nowrap; gap: 4px; margin-top: 6px;
      overflow-x: auto; max-width: 100%; padding-bottom: 0;
      scrollbar-width: none; -ms-overflow-style: none;
    }
    #toolbet-overlay-center .tb-stake-steps::-webkit-scrollbar { display: none; width: 0; height: 0; }
    #toolbet-overlay-center .tb-stake-step {
      flex: 0 0 auto; min-width: 68px; max-width: 96px; font-size: 11px;
    }
    #toolbet-overlay-center .tb-stake-step .tb-step-amt { font-size: 12px; }
    #toolbet-overlay-center .tb-stake-step .tb-step-rate { font-size: 11px; }
    #toolbet-overlay-center .tb-step-detail { display: none; }
    #toolbet-overlay-center .tb-gp-body {
      pointer-events: none; padding: 10px 12px 12px;
      border-radius: 10px; border: 1px solid rgba(56, 189, 248, 0.45);
      background: rgba(12, 18, 32, 0.94); box-shadow: 0 10px 40px rgba(0,0,0,0.55);
    }
    #toolbet-overlay.collapsed { width: auto; max-height: none; }
    #toolbet-overlay.collapsed .tb-body { display: none; }
    .toolbet-panel .tb-header {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 10px 12px; background: linear-gradient(90deg, #1a2744, #162033);
      border-bottom: 1px solid rgba(99,179,237,0.2); cursor: move;
    }
    #toolbet-overlay-left .tb-header { cursor: default; flex-wrap: wrap; }
    .toolbet-panel .tb-header-left { flex: 1; min-width: 0; }
    .toolbet-panel .tb-header-actions {
      display: flex; align-items: center; gap: 6px; flex-shrink: 0;
    }
    .toolbet-panel .tb-header-auto { display: flex; align-items: center; gap: 4px; }
    .toolbet-panel .tb-toggle-bet.sm {
      width: 36px; height: 20px; border-radius: 10px;
    }
    .toolbet-panel .tb-toggle-bet.sm::after {
      width: 14px; height: 14px; top: 3px; left: 3px;
    }
    .toolbet-panel .tb-toggle-bet.sm.on::after { transform: translateX(16px); }
    .toolbet-panel .tb-auto-status { font-size: 10px; font-weight: 700; color: #94a3b8; }
    .toolbet-panel .tb-suggest-btn {
      border: none; background: rgba(56,189,248,0.22); color: #7dd3fc;
      border-radius: 6px; padding: 4px 7px; font-size: 9px; font-weight: 700;
      cursor: pointer; white-space: nowrap; line-height: 1.2;
    }
    .toolbet-panel .tb-suggest-btn:hover { background: rgba(56,189,248,0.35); }
    .toolbet-panel .tb-suggest-btn:disabled { opacity: 0.55; cursor: wait; }
    .toolbet-panel .tb-recommend-panel {
      display: none; margin-bottom: 8px; padding: 8px; border-radius: 8px;
      background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(56, 189, 248, 0.35);
      font-size: 10px; line-height: 1.45; color: #cbd5e1; max-height: 220px; overflow-y: auto;
    }
    .toolbet-panel .tb-recommend-panel.open { display: block; }
    .toolbet-panel .tb-rec-title { font-weight: 700; color: #7dd3fc; margin-bottom: 6px; font-size: 11px; }
    .toolbet-panel .tb-rec-metric { margin-top: 4px; color: #94a3b8; }
    .toolbet-panel .tb-rec-notes { margin-top: 6px; color: #e2e8f0; }
    .toolbet-panel .tb-rec-warn { margin-top: 6px; color: #fbbf24; }
    .toolbet-panel .tb-rec-hint { margin-top: 6px; font-size: 9px; color: #64748b; font-style: italic; }
    .toolbet-panel .tb-rec-err { color: #f87171; }
    .toolbet-panel .tb-title { font-weight: 700; font-size: 14px; color: #7dd3fc; }
    .toolbet-panel .tb-table { font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .toolbet-panel .tb-btn {
      border: none; background: rgba(255,255,255,0.08); color: #cbd5e1;
      border-radius: 6px; width: 26px; height: 26px; cursor: pointer; font-size: 16px; line-height: 1;
    }
    .toolbet-panel .tb-btn:hover { background: rgba(255,255,255,0.16); }
    .toolbet-panel .tb-body { padding: 10px 12px 12px; overflow-y: auto; max-height: calc(85vh - 52px); }
    .toolbet-panel .tb-section { margin-bottom: 10px; }
    .toolbet-panel .tb-label {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 5px;
    }
    #toolbet-overlay-left .tb-body {
      max-height: calc(100vh - 120px); overflow-y: auto; padding-right: 2px;
    }
    #toolbet-overlay-left .tb-block {
      margin-bottom: 8px; border: 1px solid rgba(100, 116, 139, 0.35);
      border-radius: 8px; background: rgba(15, 23, 42, 0.45); overflow: hidden;
    }
    #toolbet-overlay-left .tb-block-head {
      width: 100%; display: flex; align-items: center; justify-content: space-between;
      gap: 8px; padding: 8px 10px; border: none; cursor: pointer; text-align: left;
      background: rgba(30, 41, 59, 0.9); color: #e2e8f0; font-size: 11px; font-weight: 700;
    }
    #toolbet-overlay-left .tb-block-head:hover { background: rgba(51, 65, 85, 0.95); }
    #toolbet-overlay-left .tb-block-title {
      flex: 1; min-width: 0; letter-spacing: 0.03em; text-transform: uppercase;
    }
    #toolbet-overlay-left .tb-block-chevron {
      flex-shrink: 0; font-size: 10px; color: #94a3b8; transition: transform 0.15s ease;
    }
    #toolbet-overlay-left .tb-block.collapsed .tb-block-chevron { transform: rotate(-90deg); }
    #toolbet-overlay-left .tb-block-body { padding: 8px 10px 10px; }
    #toolbet-overlay-left .tb-block.collapsed .tb-block-body { display: none; }
    #toolbet-overlay-left .tb-block .tb-label { margin-top: 8px; }
    #toolbet-overlay-left .tb-block .tb-label:first-child { margin-top: 0; }
    .toolbet-panel .tb-dots { display: flex; flex-wrap: wrap; gap: 4px; }
    .toolbet-panel .tb-dot {
      width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.15);
    }
    .toolbet-panel .tb-dot.player { background: #22c55e; }
    .toolbet-panel .tb-dot.banker { background: #ef4444; }
    .toolbet-panel .tb-dot.tie { background: #eab308; border-color: rgba(234,179,8,0.5); }
    .toolbet-panel .tb-history-text { font-size: 11px; line-height: 1.5; color: #94a3b8; word-break: break-word; }
    .toolbet-panel .tb-signal {
      padding: 10px; border-radius: 8px; text-align: center; font-weight: 700; font-size: 15px; letter-spacing: 0.04em;
    }
    .toolbet-panel .tb-signal.player {
      background: rgba(34,197,94,0.18); border: 1px solid rgba(34,197,94,0.5); color: #4ade80;
    }
    .toolbet-panel .tb-signal.banker {
      background: rgba(239,68,68,0.18); border: 1px solid rgba(239,68,68,0.5); color: #f87171;
    }
    .toolbet-panel .tb-signal.none {
      background: rgba(100,116,139,0.15); border: 1px solid rgba(100,116,139,0.3);
      color: #94a3b8; font-weight: 500; font-size: 12px;
    }
    .toolbet-panel .tb-match {
      padding: 6px 8px; margin-bottom: 4px; border-radius: 6px;
      background: rgba(34,197,94,0.1); border-left: 3px solid #22c55e; font-size: 11px; line-height: 1.4;
    }
    .toolbet-panel .tb-building {
      padding: 5px 8px; margin-bottom: 3px; border-radius: 6px;
      background: rgba(99,179,237,0.08); border-left: 3px solid #38bdf8; font-size: 11px; line-height: 1.35; color: #cbd5e1;
    }
    .toolbet-panel .tb-progress { color: #7dd3fc; font-weight: 600; }
    .toolbet-panel .tb-empty { color: #64748b; font-size: 11px; font-style: italic; }
    .toolbet-panel .tb-stakes-row { display: flex; gap: 6px; align-items: center; }
    .toolbet-panel .tb-stakes-input {
      flex: 1; min-width: 0; padding: 6px 8px; border-radius: 6px;
      border: 1px solid rgba(99,179,237,0.35); background: rgba(15, 23, 42, 0.9);
      color: #e2e8f0; font-size: 12px; font-family: Consolas, 'Courier New', monospace; user-select: text;
    }
    .toolbet-panel .tb-stakes-input:focus {
      outline: none; border-color: #38bdf8; box-shadow: 0 0 0 2px rgba(56,189,248,0.15);
    }
    .toolbet-panel .tb-stakes-save {
      border: none; background: rgba(56,189,248,0.2); color: #7dd3fc;
      border-radius: 6px; padding: 6px 10px; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap;
    }
    .toolbet-panel .tb-stakes-save:hover { background: rgba(56,189,248,0.32); }
    .toolbet-panel .tb-stakes-hint { font-size: 10px; color: #64748b; margin-top: 4px; line-height: 1.35; }
    .toolbet-panel .tb-stakes-msg { font-size: 10px; margin-top: 4px; min-height: 14px; }
    .toolbet-panel .tb-stakes-msg.ok { color: #4ade80; }
    .toolbet-panel .tb-stakes-msg.err { color: #f87171; }
    .toolbet-panel .tb-stake-steps {
      display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;
    }
    .toolbet-panel .tb-stake-step {
      flex: 1 1 calc(50% - 4px); min-width: 72px;
      padding: 4px 6px; border-radius: 6px; font-size: 9px; line-height: 1.3;
      background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(99,179,237,0.2);
    }
    .toolbet-panel .tb-stake-step .tb-step-num { color: #64748b; font-weight: 700; }
    .toolbet-panel .tb-stake-step .tb-step-amt { color: #cbd5e1; font-weight: 600; }
    .toolbet-panel .tb-stake-step .tb-step-rate { font-weight: 700; }
    .toolbet-panel .tb-stake-step .tb-step-rate.good { color: #4ade80; }
    .toolbet-panel .tb-stake-step .tb-step-rate.bad { color: #f87171; }
    .toolbet-panel .tb-stake-step .tb-step-rate.na { color: #64748b; }
    .toolbet-panel .tb-stake-step .tb-step-rate.low-conf { color: #fbbf24; }
    .toolbet-panel .tb-stake-step .tb-step-detail { color: #64748b; font-size: 8px; }
    .toolbet-panel .tb-stake-step.active {
      border-color: rgba(56, 189, 248, 0.65);
      background: rgba(56, 189, 248, 0.12);
    }
    .toolbet-panel .tb-stake-steps-hint {
      font-size: 9px; color: #64748b; margin-top: 4px; line-height: 1.25;
    }
    .toolbet-panel .tb-divider { height: 1px; background: rgba(99,179,237,0.12); margin: 10px 0; }
    .toolbet-panel .tb-patterns { display: flex; flex-direction: column; gap: 3px; margin-bottom: 2px; }
    .toolbet-panel .tb-pattern {
      display: flex; align-items: center; gap: 6px;
      font-size: 10px; line-height: 1.35; padding: 4px 6px; border-radius: 5px;
      background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(100, 116, 139, 0.35); color: #94a3b8;
    }
    .toolbet-panel .tb-pattern.off { opacity: 0.5; }
    .toolbet-panel .tb-pattern.off b { color: #64748b; text-decoration: line-through; }
    .toolbet-panel .tb-pattern-toggle {
      flex-shrink: 0; border: none; border-radius: 8px; width: 30px; height: 16px; cursor: pointer;
      background: rgba(100,116,139,0.55); position: relative; transition: background 0.2s;
    }
    .toolbet-panel .tb-pattern-toggle.on { background: rgba(34,197,94,0.55); }
    .toolbet-panel .tb-pattern-toggle::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 12px; height: 12px; border-radius: 50%; background: #e2e8f0; transition: transform 0.2s;
    }
    .toolbet-panel .tb-pattern-toggle.on::after { transform: translateX(14px); }
    .toolbet-panel .tb-pattern-toggle:disabled { opacity: 0.6; cursor: wait; }
    .toolbet-panel .tb-pattern b { color: #cbd5e1; font-weight: 600; }
    .toolbet-panel .tb-pattern-len {
      flex-shrink: 0; font-size: 10px; font-weight: 600; color: #e2e8f0;
      background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(100, 116, 139, 0.55);
      border-radius: 4px; padding: 1px 2px; cursor: pointer; max-width: 42px;
    }
    .toolbet-panel .tb-pattern-len:focus { outline: 1px solid rgba(56, 189, 248, 0.6); }
    .toolbet-panel .tb-pattern-stats {
      margin-left: auto; display: flex; flex-direction: column; align-items: flex-end;
      gap: 1px; line-height: 1.15; flex-shrink: 0;
    }
    .toolbet-panel .tb-pattern-rate {
      font-size: 10px; font-weight: 600; white-space: nowrap;
    }
    .toolbet-panel .tb-pattern-rate.good { color: #4ade80; }
    .toolbet-panel .tb-pattern-rate.bad { color: #f87171; }
    .toolbet-panel .tb-pattern-rate.na { color: #64748b; font-weight: 500; }
    .toolbet-panel .tb-pattern-pnl { font-size: 9px; font-weight: 700; white-space: nowrap; }
    .toolbet-panel .tb-pattern-pnl.profit-pos { color: #4ade80; }
    .toolbet-panel .tb-pattern-pnl.profit-neg { color: #f87171; }
    .toolbet-panel .tb-pattern-pnl.zero { color: #94a3b8; }
    .toolbet-panel .tb-pattern-pnl.na { color: #64748b; font-weight: 500; }
    .toolbet-panel .tb-pattern.active {
      background: rgba(34, 197, 94, 0.15); border-color: rgba(34, 197, 94, 0.55); color: #bbf7d0;
    }
    .toolbet-panel .tb-pattern.building {
      background: rgba(56, 189, 248, 0.12); border-color: rgba(56, 189, 248, 0.45); color: #bae6fd;
    }
    .toolbet-panel .tb-pattern-hint { font-size: 9px; color: #64748b; margin-top: 4px; line-height: 1.3; }
    .toolbet-panel .tb-stats-scope {
      display: flex; gap: 4px; margin-bottom: 5px; align-items: center;
    }
    .toolbet-panel .tb-stats-scope-btn {
      border: 1px solid rgba(99,179,237,0.35); background: rgba(15,23,42,0.85);
      color: #94a3b8; border-radius: 5px; padding: 2px 6px; font-size: 9px;
      font-weight: 700; cursor: pointer;
    }
    .toolbet-panel .tb-stats-scope-btn.on {
      background: rgba(56,189,248,0.25); color: #7dd3fc; border-color: rgba(56,189,248,0.55);
    }
    .toolbet-panel .tb-pattern-rate.low-conf { color: #fbbf24; }
    .toolbet-panel .tb-stats-warn {
      font-size: 9px; color: #fbbf24; margin-top: 3px; line-height: 1.25;
    }
    .toolbet-panel .tb-auto-row { display: flex; align-items: center; gap: 10px; }
    .toolbet-panel .tb-watch-row {
      display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap;
    }
    .toolbet-panel .tb-watch-label { font-size: 10px; color: #94a3b8; flex: 1; min-width: 120px; line-height: 1.3; }
    .toolbet-panel .tb-watch-status { font-size: 10px; font-weight: 700; color: #94a3b8; }
    .toolbet-panel .tb-watch-status.on { color: #4ade80; }
    .toolbet-panel .tb-toggle-bet {
      border: none; border-radius: 14px; width: 48px; height: 26px; cursor: pointer;
      background: rgba(100,116,139,0.5); position: relative; transition: background 0.2s;
    }
    .toolbet-panel .tb-toggle-bet.on { background: rgba(34,197,94,0.55); }
    .toolbet-panel .tb-toggle-bet::after {
      content: ''; position: absolute; top: 3px; left: 3px;
      width: 20px; height: 20px; border-radius: 50%; background: #e2e8f0; transition: transform 0.2s;
    }
    .toolbet-panel .tb-toggle-bet.on::after { transform: translateX(22px); }
    .toolbet-panel .tb-auto-status.on { color: #4ade80; }
    .toolbet-panel .tb-limits-row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
    .toolbet-panel .tb-limit-lbl { font-size: 10px; color: #64748b; min-width: 18px; }
    .toolbet-panel .tb-limit-input {
      width: 52px; padding: 5px 6px; border-radius: 6px;
      border: 1px solid rgba(99,179,237,0.35); background: rgba(15,23,42,0.9); color: #e2e8f0; font-size: 11px; user-select: text;
    }
    .toolbet-panel .tb-mode-select {
      min-width: 170px; max-width: 100%;
      padding: 5px 6px; border-radius: 6px;
      border: 1px solid rgba(99,179,237,0.35);
      background: rgba(15,23,42,0.9); color: #e2e8f0; font-size: 11px;
    }
    .toolbet-panel .tb-bet-stats { font-size: 11px; line-height: 1.45; color: #94a3b8; margin-top: 6px; }
    .toolbet-panel .tb-bet-stats .profit-pos { color: #4ade80; font-weight: 600; }
    .toolbet-panel .tb-bet-stats .profit-neg { color: #f87171; font-weight: 600; }
    .toolbet-panel .tb-pnl-meta { font-size: 9px; color: #64748b; font-weight: 500; }
    .toolbet-panel .tb-bet-stats .limit-warn { color: #fbbf24; font-size: 10px; }
    #toolbet-overlay-center .tb-gp-title {
      font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
      color: #7dd3fc; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;
    }
    #toolbet-overlay-center .tb-gp-badge {
      font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 999px;
      background: rgba(100,116,139,0.45); color: #cbd5e1;
    }
    #toolbet-overlay-center .tb-gp-badge.open { background: rgba(34,197,94,0.35); color: #86efac; }
    #toolbet-overlay-center .tb-gp-badge.wait { background: rgba(148,163,184,0.25); color: #94a3b8; }
    #toolbet-overlay-center .tb-gp-badge.pending { background: rgba(251,191,36,0.3); color: #fbbf24; }
    #toolbet-overlay-center .tb-gp-id {
      font-size: 18px; font-weight: 800; color: #f1f5f9; line-height: 1.2; margin-bottom: 6px;
    }
    #toolbet-overlay-center .tb-gp-id span { color: #64748b; font-size: 11px; font-weight: 600; margin-left: 6px; }
    #toolbet-overlay-center .tb-gp-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; margin-top: 4px;
    }
    #toolbet-overlay-center .tb-gp-cell {
      background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(99,179,237,0.12);
      border-radius: 8px; padding: 6px 8px;
    }
    #toolbet-overlay-center .tb-gp-cell.wide { grid-column: 1 / -1; }
    #toolbet-overlay-center .tb-gp-k {
      font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 2px;
    }
    #toolbet-overlay-center .tb-gp-v {
      font-size: 16px; font-weight: 700; color: #e2e8f0;
    }
    #toolbet-overlay-center .tb-gp-v.big {
      font-size: 30px; line-height: 1.1; color: #7dd3fc; font-weight: 800;
    }
    #toolbet-overlay-center .tb-gp-pnl-row {
      display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0;
      padding: 0; overflow: hidden;
    }
    #toolbet-overlay-center .tb-gp-pnl-col {
      padding: 8px 8px 7px; text-align: center;
      border-right: 1px solid rgba(99,179,237,0.15);
    }
    #toolbet-overlay-center .tb-gp-pnl-col:last-child { border-right: none; }
    #toolbet-overlay-center .tb-gp-pnl-col.col-tp {
      background: rgba(22, 101, 52, 0.28);
    }
    #toolbet-overlay-center .tb-gp-pnl-col.col-sl {
      background: rgba(127, 29, 29, 0.28);
    }
    #toolbet-overlay-center .tb-gp-pnl-col .tb-gp-k {
      margin-bottom: 4px;
    }
    #toolbet-overlay-center .tb-gp-v.limit {
      font-size: 28px; line-height: 1.05; font-weight: 800;
    }
    #toolbet-overlay-center .tb-gp-v.limit.tp { color: #4ade80; }
    #toolbet-overlay-center .tb-gp-v.limit.sl { color: #f87171; }
    #toolbet-overlay-center #tb-gp-pnl.tb-gp-v.big {
      font-size: 28px; line-height: 1.05;
    }
    #toolbet-overlay-center .tb-gp-limit-sub {
      font-size: 9px; color: #94a3b8; margin-top: 3px; font-weight: 600; line-height: 1.25;
    }
    #toolbet-overlay-center .tb-gp-v.next { font-size: 15px; color: #fbbf24; }
    #toolbet-overlay-center .tb-gp-next-row {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    }
    #toolbet-overlay-center .tb-gp-next-left { flex: 1; min-width: 0; }
    #toolbet-overlay-center .tb-gp-next-right {
      flex: 0 1 48%; max-width: 52%; text-align: right;
      border-left: 1px solid rgba(99,179,237,0.15); padding-left: 10px;
    }
    #toolbet-overlay-center .tb-gp-next-right .tb-gp-foot {
      margin-top: 0; border-top: none; padding-top: 0; font-size: 10px; color: #94a3b8; line-height: 1.35;
    }
    #toolbet-overlay-center .tb-gp-next-right .tb-gp-limits {
      font-size: 10px; color: #94a3b8; margin-top: 4px; font-weight: 600;
    }
    #toolbet-overlay-center .tb-gp-v.pos { color: #4ade80; }
    #toolbet-overlay-center .tb-gp-v.neg { color: #f87171; }
    #toolbet-overlay-center #tb-gp-pnl.tb-gp-v.big.pos { color: #4ade80; }
    #toolbet-overlay-center #tb-gp-pnl.tb-gp-v.big.neg { color: #f87171; }
    #toolbet-overlay-center #tb-gp-step { font-size: 18px; }
    #toolbet-overlay-center .tb-gp-wl {
      font-size: 14px; font-weight: 800; color: #e2e8f0; margin-bottom: 6px;
    }
    #toolbet-overlay-center .tb-gp-wl .w { color: #4ade80; }
    #toolbet-overlay-center .tb-gp-wl .l { color: #f87171; }
    #toolbet-overlay-center .tb-gp-wl .t { color: #94a3b8; }
    #toolbet-overlay-center .tb-gp-bar {
      display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; align-items: center;
    }
    #toolbet-overlay-center .tb-gp-pip {
      width: 10px; height: 10px; border-radius: 3px;
      background: rgba(100,116,139,0.45); border: 1px solid rgba(148,163,184,0.25);
    }
    #toolbet-overlay-center .tb-gp-pip.done { background: rgba(56,189,248,0.55); border-color: rgba(56,189,248,0.5); }
    #toolbet-overlay-center .tb-gp-pip.now {
      background: #38bdf8; border-color: #7dd3fc;
      box-shadow: 0 0 0 2px rgba(56,189,248,0.35);
    }
    #toolbet-overlay-center .tb-gp-res {
      min-width: 22px; height: 22px; border-radius: 5px; display: inline-flex;
      align-items: center; justify-content: center; font-size: 11px; font-weight: 800;
      border: 1px solid transparent;
    }
    #toolbet-overlay-center .tb-gp-res.W {
      background: rgba(34,197,94,0.35); color: #86efac; border-color: rgba(74,222,128,0.5);
    }
    #toolbet-overlay-center .tb-gp-res.L {
      background: rgba(239,68,68,0.35); color: #fca5a5; border-color: rgba(248,113,113,0.5);
    }
    #toolbet-overlay-center .tb-gp-res.T {
      background: rgba(148,163,184,0.25); color: #cbd5e1; border-color: rgba(148,163,184,0.35);
    }
    .toolbet-panel .tb-tie-head-row {
      display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;
    }
    .toolbet-panel .tb-tie-onoff {
      display: flex; align-items: center; gap: 6px; font-size: 11px; color: #94a3b8;
    }
    .toolbet-panel .tb-tie-onoff .tb-auto-status.on { color: #4ade80; }
    .toolbet-panel .tb-tie-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 6px 8px; margin-top: 6px;
    }
    .toolbet-panel .tb-tie-field label {
      display: block; font-size: 10px; color: #64748b; margin-bottom: 2px;
    }
    .toolbet-panel .tb-tie-step {
      display: flex; align-items: center; gap: 4px;
    }
    .toolbet-panel .tb-tie-step button {
      width: 26px; height: 26px; border-radius: 6px; border: 1px solid rgba(148,163,184,0.35);
      background: rgba(30,41,59,0.85); color: #e2e8f0; cursor: pointer; font-size: 14px; line-height: 1;
    }
    .toolbet-panel .tb-tie-step button:hover { border-color: #38bdf8; color: #7dd3fc; }
    .toolbet-panel .tb-tie-step input {
      flex: 1; min-width: 0; height: 26px; text-align: center; font-size: 12px;
      border-radius: 6px; border: 1px solid rgba(148,163,184,0.35);
      background: rgba(15,23,42,0.9); color: #e2e8f0;
    }
    .toolbet-panel .tb-tie-hint {
      font-size: 10px; color: #64748b; margin-top: 6px; line-height: 1.35;
    }
    .toolbet-panel .tb-tie-preset {
      width: 100%; height: 28px; font-size: 11px; border-radius: 6px;
      border: 1px solid rgba(148,163,184,0.35); background: rgba(15,23,42,0.9); color: #e2e8f0;
    }
    `;
    document.head.appendChild(style);
  }

  if (!document.getElementById('toolbet-overlay-left')) {
    const left = document.createElement('div');
    left.id = 'toolbet-overlay-left';
    left.className = 'toolbet-panel';
    left.innerHTML = `
      <div class="tb-header">
        <div class="tb-header-left">
          <div class="tb-title">ToolBet v2</div>
          <div class="tb-table" style="font-size:10px">Cai dat cuoc</div>
        </div>
        <div class="tb-header-actions">
          <div class="tb-header-auto" title="Auto cuoc">
            <button class="tb-toggle-bet sm" id="tb-auto-toggle" type="button"></button>
            <span class="tb-auto-status" id="tb-auto-status">TAT</span>
          </div>
          <button class="tb-suggest-btn" id="tb-suggest-btn" type="button">De xuat config</button>
          <button class="tb-suggest-btn" id="tb-daily-btn" type="button" title="Phan tich chuoi cuoc hom nay">Phan tich ngay</button>
        </div>
      </div>
      <div class="tb-body" id="tb-left-body">
        <div class="tb-recommend-panel" id="tb-recommend-panel"></div>

        <div class="tb-block" data-block="patterns" id="tb-patterns-section">
          <button class="tb-block-head" type="button" aria-expanded="true">
            <span class="tb-block-title">1. Mau dang ap dung</span>
            <span class="tb-block-chevron">▼</span>
          </button>
          <div class="tb-block-body">
            <div class="tb-stats-scope" id="tb-stats-scope">
              <button class="tb-stats-scope-btn on" type="button" data-scope="today">Hom nay</button>
              <button class="tb-stats-scope-btn" type="button" data-scope="7days">7 ngay</button>
            </div>
            <div class="tb-stats-warn" id="tb-stats-warn" style="display:none"></div>
            <div class="tb-patterns" id="tb-patterns"></div>
            <div class="tb-pattern-hint" id="tb-pattern-hint">Uu tien: nhieu van hon truoc</div>
          </div>
        </div>

        <div class="tb-block" data-block="limits" id="tb-betting-section">
          <button class="tb-block-head" type="button" aria-expanded="true">
            <span class="tb-block-title">2. Gioi han & mode</span>
            <span class="tb-block-chevron">▼</span>
          </button>
          <div class="tb-block-body">
            <div class="tb-label">Gioi han hom nay (LAI / LO)</div>
            <div class="tb-limits-row">
              <label class="tb-limit-lbl">Lo</label>
              <input class="tb-limit-input" id="tb-stop-loss" type="text" value="${stopLoss}" placeholder="0" />
              <label class="tb-limit-lbl">Lai</label>
              <input class="tb-limit-input" id="tb-take-profit" type="text" value="${takeProfit}" placeholder="0" />
            </div>
            <div class="tb-label">Gioi han NHOM chuoi</div>
            <div class="tb-limits-row">
              <label class="tb-limit-lbl">Lai nhom</label>
              <input class="tb-limit-input" id="tb-group-take-profit" type="text" value="${groupTakeProfit}" placeholder="0" />
              <label class="tb-limit-lbl">Lo nhom</label>
              <input class="tb-limit-input" id="tb-group-stop-loss" type="text" value="${groupStopLoss}" placeholder="0" />
            </div>
            <div class="tb-label">Co che tang stake trong nhom</div>
            <div class="tb-limits-row">
              <select class="tb-mode-select" id="tb-progression-mode">
                <option value="loss_up_win_reset">Tang khi thua, thang ve muc dau</option>
                <option value="win_up_loss_reset">Thang leo chuoi (reset lc), thua ve dau</option>
                <option value="both_up">Thua thang deu tang muc</option>
                <option value="win_up_loss_hold">Thang tang muc, thua giu nguyen</option>
                <option value="profit_lock_loss_up">Mode5: thang khoa lai, thua leo bac</option>
              </select>
              <button class="tb-stakes-save" id="tb-limits-save" type="button">Luu</button>
            </div>
            <div class="tb-watch-row" id="tb-watch-recover-row" title="BAT: Mode1/2 chi ve dau khi PnL nhom > 0 (am thi giu bac). Mode3/4 thang + PnL > 0 thi ve dau. TAT: mode chay nhu cu.">
              <span class="tb-watch-label">Chi ve dau khi nhom lai</span>
              <button class="tb-toggle-bet sm" id="tb-watch-recover-toggle" type="button"></button>
              <span class="tb-watch-status" id="tb-watch-recover-status">TAT</span>
            </div>
            <div class="tb-stakes-msg" id="tb-limits-msg"></div>
            <div class="tb-bet-stats" id="tb-bet-stats"></div>
          </div>
        </div>

        <div class="tb-block collapsed" data-block="tie" id="tb-tie-section">
          <button class="tb-block-head" type="button" aria-expanded="false">
            <span class="tb-block-title">3. Nuoi Hoa</span>
            <span class="tb-block-chevron">▼</span>
          </button>
          <div class="tb-block-body">
            <div class="tb-tie-head-row">
              <div class="tb-tie-onoff">
                <button class="tb-toggle-bet sm" id="tb-tie-toggle" type="button" title="Bat/tat nuoi Hoa"></button>
                <span class="tb-auto-status" id="tb-tie-status">TAT</span>
              </div>
              <button class="tb-stakes-save" id="tb-tie-save" type="button">Luu</button>
            </div>
            <div class="tb-label">Bo thu</div>
            <select class="tb-tie-preset" id="tb-tie-preset">
              <option value="thu_can_bang">Thu can bang (18/25/3)</option>
              <option value="thu_pnl_max">Thu PnL max (18/35/3)</option>
              <option value="goc_nuoi">Goc nuoi vo han (gap 10)</option>
              <option value="custom">Tuy chinh (sua tung o)</option>
            </select>
            <div class="tb-tie-grid">
              <div class="tb-tie-field">
                <label>Gap min (mac dinh 18)</label>
                <div class="tb-tie-step">
                  <button type="button" data-tie-step="gap_min" data-dir="-1">−</button>
                  <input id="tb-tie-gap-min" type="number" min="1" max="99" value="18" />
                  <button type="button" data-tie-step="gap_min" data-dir="1">+</button>
                </div>
              </div>
              <div class="tb-tie-field">
                <label>Gap max (0=OFF)</label>
                <div class="tb-tie-step">
                  <button type="button" data-tie-step="gap_max" data-dir="-1">−</button>
                  <input id="tb-tie-gap-max" type="number" min="0" max="200" value="25" />
                  <button type="button" data-tie-step="gap_max" data-dir="1">+</button>
                </div>
              </div>
              <div class="tb-tie-field">
                <label>Max cuoc / chu ky (0=nuoi den Hoa)</label>
                <div class="tb-tie-step">
                  <button type="button" data-tie-step="max_bets" data-dir="-1">−</button>
                  <input id="tb-tie-max-bets" type="number" min="0" max="99" value="3" />
                  <button type="button" data-tie-step="max_bets" data-dir="1">+</button>
                </div>
              </div>
              <div class="tb-tie-field">
                <label>Stake Hoa</label>
                <div class="tb-tie-step">
                  <button type="button" data-tie-step="stake" data-dir="-1">−</button>
                  <input id="tb-tie-stake" type="number" min="10" max="5000" step="10" value="100" />
                  <button type="button" data-tie-step="stake" data-dir="1">+</button>
                </div>
              </div>
              <div class="tb-tie-field">
                <label>Payout (8 = 8:1)</label>
                <div class="tb-tie-step">
                  <button type="button" data-tie-step="payout" data-dir="-1">−</button>
                  <input id="tb-tie-payout" type="number" min="1" max="20" step="1" value="8" />
                  <button type="button" data-tie-step="payout" data-dir="1">+</button>
                </div>
              </div>
              <div class="tb-tie-field">
                <label>SL phien Hoa (0=OFF)</label>
                <div class="tb-tie-step">
                  <button type="button" data-tie-step="session_stop_loss" data-dir="-1">−</button>
                  <input id="tb-tie-session-sl" type="number" min="0" max="999999" step="100" value="3000" />
                  <button type="button" data-tie-step="session_stop_loss" data-dir="1">+</button>
                </div>
              </div>
            </div>
            <div class="tb-tie-hint" id="tb-tie-hint">
              Sau gap_min phien khong Hoa → cuoc Hoa stake; cat khi max_bets / gap_max.
            </div>
            <div class="tb-stakes-msg" id="tb-tie-msg"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(left);

    // Khoi phuc trang thai thu gon tu localStorage
    // Mac dinh: khoi "tie" (Nuoi Hoa) thu gon neu chua co preference
    try {
      const raw = localStorage.getItem('toolbet_left_blocks');
      const saved = raw ? JSON.parse(raw) : {};
      left.querySelectorAll('.tb-block[data-block]').forEach((block) => {
        const key = block.getAttribute('data-block');
        if (!key) return;
        let collapsed;
        if (typeof saved[key] === 'boolean') collapsed = saved[key];
        else if (key === 'tie') collapsed = true;
        else return;
        const head = block.querySelector('.tb-block-head');
        block.classList.toggle('collapsed', collapsed);
        if (head) head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
    } catch (e) { /* ignore */ }

    if (!left.dataset.blockBound) {
      left.dataset.blockBound = '1';
      left.addEventListener('click', (e) => {
        const head = e.target.closest('.tb-block-head');
        if (!head || !left.contains(head)) return;
        e.preventDefault();
        const block = head.closest('.tb-block');
        if (!block) return;
        const nowCollapsed = !block.classList.contains('collapsed');
        block.classList.toggle('collapsed', nowCollapsed);
        head.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
        try {
          const raw = localStorage.getItem('toolbet_left_blocks');
          const saved = raw ? JSON.parse(raw) : {};
          const key = block.getAttribute('data-block');
          if (key) {
            saved[key] = nowCollapsed;
            localStorage.setItem('toolbet_left_blocks', JSON.stringify(saved));
          }
        } catch (err) { /* ignore */ }
      });
    }
  }

  if (!document.getElementById('toolbet-overlay-center')) {
    const center = document.createElement('div');
    center.id = 'toolbet-overlay-center';
    center.className = 'toolbet-panel';
    center.innerHTML = `
      <div class="tb-stakes-mid" id="tb-stakes-mid">
        <div class="tb-stakes-mid-label">Chuoi cuoc</div>
        <div class="tb-stakes-row">
          <input class="tb-stakes-input" id="tb-stakes-input" type="text"
            value="${stakesText}" spellcheck="false"
            placeholder="vd: [0, 10, 50, 100, 120, 130, ... ] — 20~25 muc"
            title="Chuoi stake dai (20-25 muc). Muc 0 = theo doi." />
          <button class="tb-stakes-save" id="tb-stakes-save" type="button">Luu</button>
        </div>
        <div class="tb-stakes-msg" id="tb-stakes-msg"></div>
        <div class="tb-stake-steps" id="tb-stake-steps"></div>
      </div>
      <div class="tb-gp-body" id="tb-group-progress">
        <div class="tb-gp-title">
          <span>Tien trinh nhom</span>
          <span class="tb-gp-badge wait" id="tb-gp-badge">CHO</span>
        </div>
        <div class="tb-gp-id" id="tb-gp-id">Chua mo nhom</div>
        <div class="tb-gp-grid">
          <div class="tb-gp-cell">
            <div class="tb-gp-k">Buoc hien tai</div>
            <div class="tb-gp-v" id="tb-gp-step">—</div>
          </div>
          <div class="tb-gp-cell">
            <div class="tb-gp-k">Cuoc hien tai</div>
            <div class="tb-gp-v big" id="tb-gp-stake">—</div>
          </div>
          <div class="tb-gp-cell wide tb-gp-next-row">
            <div class="tb-gp-next-left">
              <div class="tb-gp-k">Buoc tiep</div>
              <div class="tb-gp-v next" id="tb-gp-next">—</div>
            </div>
            <div class="tb-gp-next-right">
              <div class="tb-gp-foot" id="tb-gp-foot">Cho tin hieu / bat auto</div>
              <div class="tb-gp-limits" id="tb-gp-limits"></div>
            </div>
          </div>
          <div class="tb-gp-cell wide tb-gp-pnl-row">
            <div class="tb-gp-pnl-col">
              <div class="tb-gp-k">PnL nhom</div>
              <div class="tb-gp-v big" id="tb-gp-pnl">+0</div>
            </div>
            <div class="tb-gp-pnl-col col-tp">
              <div class="tb-gp-k">TP nhom</div>
              <div class="tb-gp-v limit tp" id="tb-gp-tp">—</div>
              <div class="tb-gp-limit-sub" id="tb-gp-tp-sub"></div>
            </div>
            <div class="tb-gp-pnl-col col-sl">
              <div class="tb-gp-k">SL nhom</div>
              <div class="tb-gp-v limit sl" id="tb-gp-sl">—</div>
              <div class="tb-gp-limit-sub" id="tb-gp-sl-sub"></div>
            </div>
          </div>
          <div class="tb-gp-cell wide">
            <div class="tb-gp-k">Ket qua nhom (W/L)</div>
            <div class="tb-gp-wl" id="tb-gp-wl">Thang 0 · Thua 0</div>
            <div class="tb-gp-bar" id="tb-gp-results"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(center);
  }

  if (!document.getElementById('toolbet-overlay')) {
    const root = document.createElement('div');
    root.id = 'toolbet-overlay';
    root.className = 'toolbet-panel';
    root.innerHTML = `
      <div class="tb-header">
        <div>
          <div class="tb-title">ToolBet v2</div>
          <div class="tb-table" id="tb-table">Dang ket noi...</div>
        </div>
        <button class="tb-btn" id="tb-toggle" title="Thu gon">−</button>
      </div>
      <div class="tb-body" id="tb-body">
        <div id="tb-body-content"></div>
      </div>
    `;
    document.body.appendChild(root);

    const header = root.querySelector('.tb-header');
    let dragging = false, ox = 0, oy = 0;
    header.addEventListener('mousedown', (e) => {
      if (e.target.id === 'tb-toggle') return;
      dragging = true;
      const r = root.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      root.style.right = 'auto';
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      root.style.left = Math.max(0, e.clientX - ox) + 'px';
      root.style.top = Math.max(0, e.clientY - oy) + 'px';
    });
    document.addEventListener('mouseup', () => { dragging = false; });

    document.getElementById('tb-toggle').addEventListener('click', () => {
      root.classList.toggle('collapsed');
      document.getElementById('tb-toggle').textContent = root.classList.contains('collapsed') ? '+' : '−';
    });
  }

  const saveBtn = document.getElementById('tb-stakes-save');
  const stakesInput = document.getElementById('tb-stakes-input');
  const stakesMsg = document.getElementById('tb-stakes-msg');

  const showStakesMsg = (text, ok) => {
    if (!stakesMsg) return;
    stakesMsg.textContent = text || '';
    stakesMsg.className = 'tb-stakes-msg ' + (ok ? 'ok' : 'err');
  };

  if (saveBtn && stakesInput && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = '1';
    saveBtn.addEventListener('click', async () => {
      if (typeof window.toolbetSaveStakes !== 'function') {
        showStakesMsg('Chua ket noi luu — cho tool', false);
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = '...';
      try {
        const result = await window.toolbetSaveStakes(stakesInput.value);
        if (result && result.ok) {
          if (result.display) stakesInput.value = result.display;
          showStakesMsg('Da luu — ap dung lan sau', true);
        } else {
          showStakesMsg((result && result.error) || 'Luu that bai', false);
        }
      } catch (e) {
        showStakesMsg(String(e.message || e), false);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Luu';
      }
    });
    stakesInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); }
    });
  }

  window.__tbSetStakesDisplay = (text) => {
    const input = document.getElementById('tb-stakes-input');
    if (input && document.activeElement !== input) input.value = text;
  };

  const setAutoUi = (on) => {
    const btn = document.getElementById('tb-auto-toggle');
    const st = document.getElementById('tb-auto-status');
    if (btn) btn.classList.toggle('on', !!on);
    if (st) {
      st.textContent = on ? 'BAT' : 'TAT';
      st.classList.toggle('on', !!on);
    }
  };

  const setWatchRecoverUi = (on) => {
    const btn = document.getElementById('tb-watch-recover-toggle');
    const st = document.getElementById('tb-watch-recover-status');
    if (btn) btn.classList.toggle('on', !!on);
    if (st) {
      st.textContent = on ? 'BAT' : 'TAT';
      st.classList.toggle('on', !!on);
    }
  };

  const TIE_STEP = {
    gap_min: 1, gap_max: 1, max_bets: 1, stake: 10, payout: 1, session_stop_loss: 100
  };
  const setTieEnabledUi = (on) => {
    const el = document.getElementById('tb-tie-toggle');
    const st = document.getElementById('tb-tie-status');
    if (el) el.classList.toggle('on', !!on);
    if (st) {
      st.textContent = on ? 'BAT' : 'TAT';
      st.classList.toggle('on', !!on);
    }
  };
  const readTieForm = () => {
    const num = (id, defVal) => {
      const el = document.getElementById(id);
      if (!el) return defVal;
      const v = Number(el.value);
      return Number.isFinite(v) ? v : defVal;
    };
    const toggle = document.getElementById('tb-tie-toggle');
    const presetEl = document.getElementById('tb-tie-preset');
    return {
      enabled: !!(toggle && toggle.classList.contains('on')),
      preset: (presetEl && presetEl.value) || 'custom',
      gap_min: Math.max(1, Math.round(num('tb-tie-gap-min', 18))),
      gap_max: Math.max(0, Math.round(num('tb-tie-gap-max', 25))),
      max_bets: Math.max(0, Math.round(num('tb-tie-max-bets', 3))),
      stake: Math.max(10, Math.round(num('tb-tie-stake', 100))),
      payout: Math.max(1, num('tb-tie-payout', 8)),
      session_stop_loss: Math.max(0, num('tb-tie-session-sl', 3000)),
    };
  };
  window.__tbSetTieNurture = (data) => {
    if (!data || typeof data !== 'object') return;
    const presetEl = document.getElementById('tb-tie-preset');
    if (presetEl && Array.isArray(data.presets) && data.presets.length) {
      const cur = data.preset || presetEl.value || 'custom';
      presetEl.innerHTML = data.presets.map(p =>
        '<option value="' + p.id + '">' + (p.label || p.id) + '</option>'
      ).join('');
      presetEl.value = cur;
    } else if (presetEl && data.preset) {
      presetEl.value = data.preset;
    }
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el && v != null && document.activeElement !== el) el.value = String(v);
    };
    setVal('tb-tie-gap-min', data.gap_min);
    setVal('tb-tie-gap-max', data.gap_max);
    setVal('tb-tie-max-bets', data.max_bets);
    setVal('tb-tie-stake', data.stake);
    setVal('tb-tie-payout', data.payout);
    setVal('tb-tie-session-sl', data.session_stop_loss);
    if (typeof data.enabled === 'boolean') setTieEnabledUi(data.enabled);
    const hint = document.getElementById('tb-tie-hint');
    if (hint) {
      const gmax = Number(data.gap_max) > 0 ? data.gap_max : 'OFF';
      const mb = Number(data.max_bets) > 0 ? data.max_bets : 'nuoi den Hoa';
      hint.textContent = 'Sau ' + (data.gap_min || 18) + ' phien khong Hoa → Hoa '
        + (data.stake || 100) + ' · cat max_bets=' + mb + ' · gap_max=' + gmax
        + ' · payout ' + (data.payout || 8) + ':1';
    }
  };
  if (document.getElementById('toolbet-overlay-left') && !document.getElementById('tb-tie-section')) {
    const leftBody = document.getElementById('tb-left-body');
    if (leftBody) {
      const wrap = document.createElement('div');
      wrap.innerHTML = '<div class="tb-block collapsed" data-block="tie" id="tb-tie-section">'
        + '<button class="tb-block-head" type="button" aria-expanded="false">'
        + '<span class="tb-block-title">3. Nuoi Hoa</span><span class="tb-block-chevron">▼</span></button>'
        + '<div class="tb-block-body"><div class="tb-tie-head-row"><div class="tb-tie-onoff">'
        + '<button class="tb-toggle-bet sm" id="tb-tie-toggle" type="button"></button>'
        + '<span class="tb-auto-status" id="tb-tie-status">TAT</span></div>'
        + '<button class="tb-stakes-save" id="tb-tie-save" type="button">Luu</button></div>'
        + '<div class="tb-label">Bo thu</div><select class="tb-tie-preset" id="tb-tie-preset"></select>'
        + '<div class="tb-tie-grid">'
        + '<div class="tb-tie-field"><label>Gap min</label><div class="tb-tie-step">'
        + '<button type="button" data-tie-step="gap_min" data-dir="-1">−</button>'
        + '<input id="tb-tie-gap-min" type="number" value="18" />'
        + '<button type="button" data-tie-step="gap_min" data-dir="1">+</button></div></div>'
        + '<div class="tb-tie-field"><label>Gap max (0=OFF)</label><div class="tb-tie-step">'
        + '<button type="button" data-tie-step="gap_max" data-dir="-1">−</button>'
        + '<input id="tb-tie-gap-max" type="number" value="25" />'
        + '<button type="button" data-tie-step="gap_max" data-dir="1">+</button></div></div>'
        + '<div class="tb-tie-field"><label>Max cuoc / chu ky</label><div class="tb-tie-step">'
        + '<button type="button" data-tie-step="max_bets" data-dir="-1">−</button>'
        + '<input id="tb-tie-max-bets" type="number" value="3" />'
        + '<button type="button" data-tie-step="max_bets" data-dir="1">+</button></div></div>'
        + '<div class="tb-tie-field"><label>Stake Hoa</label><div class="tb-tie-step">'
        + '<button type="button" data-tie-step="stake" data-dir="-1">−</button>'
        + '<input id="tb-tie-stake" type="number" value="100" />'
        + '<button type="button" data-tie-step="stake" data-dir="1">+</button></div></div>'
        + '<div class="tb-tie-field"><label>Payout</label><div class="tb-tie-step">'
        + '<button type="button" data-tie-step="payout" data-dir="-1">−</button>'
        + '<input id="tb-tie-payout" type="number" value="8" />'
        + '<button type="button" data-tie-step="payout" data-dir="1">+</button></div></div>'
        + '<div class="tb-tie-field"><label>SL phien Hoa</label><div class="tb-tie-step">'
        + '<button type="button" data-tie-step="session_stop_loss" data-dir="-1">−</button>'
        + '<input id="tb-tie-session-sl" type="number" value="3000" />'
        + '<button type="button" data-tie-step="session_stop_loss" data-dir="1">+</button></div></div>'
        + '</div><div class="tb-tie-hint" id="tb-tie-hint"></div>'
        + '<div class="tb-stakes-msg" id="tb-tie-msg"></div></div></div>';
      if (wrap.firstElementChild) leftBody.appendChild(wrap.firstElementChild);
      try {
        const raw = localStorage.getItem('toolbet_left_blocks');
        const saved = raw ? JSON.parse(raw) : {};
        const tieBlock = document.getElementById('tb-tie-section');
        if (tieBlock) {
          const collapsed = typeof saved.tie === 'boolean' ? saved.tie : true;
          const head = tieBlock.querySelector('.tb-block-head');
          tieBlock.classList.toggle('collapsed', collapsed);
          if (head) head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        }
      } catch (e) { /* ignore */ }
    }
  }

  window.__tbSetBettingState = (data) => {
    if (!data) return;
    if (typeof data.auto_bet === 'boolean') setAutoUi(data.auto_bet);
    if (typeof data.loss_watch_recover === 'boolean') setWatchRecoverUi(data.loss_watch_recover);
    else if (typeof data.lossWatchRecover === 'boolean') setWatchRecoverUi(data.lossWatchRecover);
    if (data.tie_nurture) window.__tbSetTieNurture(data.tie_nurture);
    else if (data.tieNurture) window.__tbSetTieNurture(data.tieNurture);
    const sl = document.getElementById('tb-stop-loss');
    const tp = document.getElementById('tb-take-profit');
    const gtp = document.getElementById('tb-group-take-profit');
    const gsl = document.getElementById('tb-group-stop-loss');
    const mode = document.getElementById('tb-progression-mode');
    const modeVal = data.progression_mode || data.progressionMode;
    if (sl && document.activeElement !== sl && data.stop_loss_display != null) sl.value = data.stop_loss_display;
    if (tp && document.activeElement !== tp && data.take_profit_display != null) tp.value = data.take_profit_display;
    if (gtp && document.activeElement !== gtp && data.group_take_profit_display != null) gtp.value = data.group_take_profit_display;
    if (gsl && document.activeElement !== gsl && data.group_stop_loss_display != null) gsl.value = data.group_stop_loss_display;
    if (mode && modeVal) mode.value = modeVal;
    const stats = document.getElementById('tb-bet-stats');
    if (stats && data.bet_stats_html) stats.innerHTML = data.bet_stats_html;
  };

  window.__tbSetGroupProgress = (data) => {
    const root = document.getElementById('tb-group-progress');
    if (!root || !data) return;
    const gp = data.group_progress || {};
    const badge = document.getElementById('tb-gp-badge');
    const idEl = document.getElementById('tb-gp-id');
    const stepEl = document.getElementById('tb-gp-step');
    const stakeEl = document.getElementById('tb-gp-stake');
    const nextEl = document.getElementById('tb-gp-next');
    const pnlEl = document.getElementById('tb-gp-pnl');
    const resEl = document.getElementById('tb-gp-results');
    const wlEl = document.getElementById('tb-gp-wl');
    const tpEl = document.getElementById('tb-gp-tp');
    const slEl = document.getElementById('tb-gp-sl');
    const tpSub = document.getElementById('tb-gp-tp-sub');
    const slSub = document.getElementById('tb-gp-sl-sub');
    const footEl = document.getElementById('tb-gp-foot');
    const limEl = document.getElementById('tb-gp-limits');

    const open = !!gp.open;
    const pending = !!gp.pending;
    if (badge) {
      badge.className = 'tb-gp-badge ' + (pending ? 'pending' : (open ? 'open' : 'wait'));
      badge.textContent = pending ? 'CHO KQ' : (open ? 'DANG MO' : 'CHO');
    }
    if (idEl) {
      if (gp.group_id) {
        const seq = gp.seq_no != null ? ('#' + gp.seq_no) : '';
        idEl.innerHTML = 'Nhom ' + seq
          + '<span>id ' + gp.group_id + (gp.groups_closed != null ? ' · da dong ' + gp.groups_closed : '') + '</span>';
      } else {
        idEl.textContent = 'Chua mo nhom';
      }
    }
    const step = gp.stake_step || 0;
    const total = gp.stake_total_steps || 0;
    const stake = (gp.current_stake != null) ? gp.current_stake : '—';
    const nextStep = gp.next_stake_step || '—';
    const nextStake = (gp.next_stake != null) ? gp.next_stake : '—';
    const winStep = gp.next_stake_step_on_win || '—';
    const winStake = (gp.next_stake_on_win != null) ? gp.next_stake_on_win : '—';
    const mode = gp.progression_mode || 'loss_up_win_reset';
    if (stepEl) stepEl.textContent = total ? (step + ' / ' + total) : '—';
    if (stakeEl) {
      stakeEl.textContent = String(stake);
      stakeEl.title = (Number(stake) === 0) ? 'Theo doi (khong dat chip)' : '';
    }
    if (nextEl) {
      const watch = !!gp.loss_watch_recover;
      if (watch && (mode === 'loss_up_win_reset' || mode === 'win_up_loss_reset')) {
        nextEl.textContent = 'Ve dau chi khi PnL nhom > 0 | Thang: B' + winStep + ' · ' + winStake
          + ' | Thua: B' + nextStep + ' · ' + nextStake;
      } else if (watch && (mode === 'both_up' || mode === 'win_up_loss_hold')) {
        nextEl.textContent = 'Thang+lai: ve dau | Thang+am: B' + winStep + ' · ' + winStake;
      } else if (mode === 'profit_lock_loss_up') {
        nextEl.textContent = 'Thang+lai: ve dau | Thang+am/Thua: B' + winStep + ' · ' + winStake;
      } else if (mode === 'loss_up_win_reset' || mode === 'win_up_loss_reset') {
        nextEl.textContent = 'Thang: B' + winStep + ' · ' + winStake + ' | Thua: B' + nextStep + ' · ' + nextStake;
      } else {
        nextEl.textContent = 'B' + nextStep + ' · ' + nextStake;
      }
    }
    const pnl = Number(gp.group_pnl || 0);
    if (pnlEl) {
      pnlEl.textContent = (pnl >= 0 ? '+' : '') + Math.round(pnl);
      pnlEl.className = 'tb-gp-v big ' + (pnl > 0 ? 'pos' : (pnl < 0 ? 'neg' : ''));
    }

    // Doc TP/SL tu group_progress + top-level (install dung camelCase)
    const pickLimit = (...vals) => {
      for (const v of vals) {
        if (v == null || v === '') continue;
        const n = Number(String(v).replace(/,/g, ''));
        if (Number.isFinite(n) && n > 0) return n;
      }
      return 0;
    };
    const gtp = pickLimit(
      gp.group_take_profit, data.group_take_profit, data.groupTakeProfit,
      data.group_take_profit_display
    );
    const gsl = pickLimit(
      gp.group_stop_loss, data.group_stop_loss, data.groupStopLoss,
      data.group_stop_loss_display
    );
    if (tpEl) tpEl.textContent = gtp > 0 ? String(Math.round(gtp)) : 'OFF';
    if (slEl) slEl.textContent = gsl > 0 ? String(Math.round(gsl)) : 'OFF';
    if (tpSub) {
      if (gtp > 0) {
        const left = Math.max(0, gtp - pnl);
        tpSub.textContent = pnl >= gtp ? 'Da dat TP' : ('Con +' + Math.round(left) + ' de dong nhom');
      } else tpSub.textContent = 'Khong gioi han lai';
    }
    if (slSub) {
      if (gsl > 0) {
        const left = Math.max(0, gsl + pnl);
        slSub.textContent = pnl <= -gsl ? 'Da dat SL' : ('Con -' + Math.round(left) + ' truoc SL');
      } else slSub.textContent = 'Khong gioi han lo';
    }

    const results = Array.isArray(gp.group_results) ? gp.group_results : [];
    const gw = gp.group_wins != null ? gp.group_wins : results.filter(x => x === 'W').length;
    const gl = gp.group_losses != null ? gp.group_losses : results.filter(x => x === 'L').length;
    const gtie = gp.group_pushes != null ? gp.group_pushes : results.filter(x => x === 'T').length;
    if (wlEl) {
      wlEl.innerHTML = '<span class="w">Thang ' + gw + '</span> · <span class="l">Thua ' + gl + '</span>'
        + (gtie ? (' · <span class="t">Hoa ' + gtie + '</span>') : '');
    }
    if (resEl) {
      if (!results.length) {
        resEl.innerHTML = '<span style="color:#64748b;font-size:11px">Chua co van nao trong nhom</span>';
      } else {
        const maxShow = 28;
        const shown = results.slice(-maxShow);
        resEl.innerHTML = (results.length > maxShow ? '<span style="color:#64748b;font-size:10px">…</span>' : '')
          + shown.map((r, i) => {
            const n = results.length - shown.length + i + 1;
            const label = r === 'W' ? 'Thang' : (r === 'L' ? 'Thua' : 'Hoa');
            return '<div class="tb-gp-res ' + r + '" title="Van ' + n + ': ' + label + '">' + r + '</div>';
          }).join('');
      }
    }

    if (footEl) {
      const parts = [];
      if (gp.pending) parts.push('Dang cho ket qua van');
      else if (Number(stake) === 0 && stake !== '—') parts.push('Theo doi stake 0');
      if (gp.last_bet) parts.push(gp.last_bet);
      footEl.textContent = parts.join(' · ') || 'Cho tin hieu / bat auto';
    }
    if (limEl) {
      const loss = gp.group_loss_count != null ? gp.group_loss_count : 0;
      limEl.textContent = 'Thua lien tiep (lc): ' + loss
        + (gp.loss_watch_recover ? ' · Ve dau khi lai' : '');
    }
  };

  window.__tbBindBettingControls = () => {
    const toggle = document.getElementById('tb-auto-toggle');
    const suggestBtn = document.getElementById('tb-suggest-btn');
    const recPanel = document.getElementById('tb-recommend-panel');
    const limitsSave = document.getElementById('tb-limits-save');
    const limitsMsg = document.getElementById('tb-limits-msg');
    const showLimitMsg = (text, ok) => {
      if (!limitsMsg) return;
      limitsMsg.textContent = text || '';
      limitsMsg.className = 'tb-stakes-msg ' + (ok ? 'ok' : 'err');
    };
    if (toggle && !toggle.dataset.bound) {
      toggle.dataset.bound = '1';
      toggle.addEventListener('click', async () => {
        const next = !toggle.classList.contains('on');
        if (typeof window.toolbetToggleAutoBet !== 'function') return;
        toggle.disabled = true;
        try {
          const r = await window.toolbetToggleAutoBet(next);
          if (r && r.ok) setAutoUi(!!r.auto_bet);
        } catch (e) { /* ignore */ }
        finally { toggle.disabled = false; }
      });
    }
    const watchToggle = document.getElementById('tb-watch-recover-toggle');
    if (watchToggle && !watchToggle.dataset.bound) {
      watchToggle.dataset.bound = '1';
      watchToggle.addEventListener('click', async () => {
        const next = !watchToggle.classList.contains('on');
        if (typeof window.toolbetToggleWatchRecover !== 'function') return;
        watchToggle.disabled = true;
        try {
          const r = await window.toolbetToggleWatchRecover(next);
          if (r && r.ok) setWatchRecoverUi(!!r.loss_watch_recover);
        } catch (e) { /* ignore */ }
        finally { watchToggle.disabled = false; }
      });
    }
    if (suggestBtn && !suggestBtn.dataset.bound) {
      suggestBtn.dataset.bound = '1';
      suggestBtn.addEventListener('click', async () => {
        if (typeof window.toolbetSuggestConfig !== 'function') {
          if (recPanel) {
            recPanel.classList.add('open');
            recPanel.innerHTML = '<div class="tb-rec-err">Chua ket noi tool</div>';
          }
          return;
        }
        suggestBtn.disabled = true;
        suggestBtn.textContent = '...';
        if (recPanel) {
          recPanel.classList.add('open');
          recPanel.innerHTML = '<div class="tb-rec-title">Dang phan tich...</div>';
        }
        try {
          const r = await window.toolbetSuggestConfig();
          if (recPanel) {
            if (r && r.ok && r.html) {
              recPanel.innerHTML = r.html;
              if (r.stakes_display && typeof window.__tbSetStakesDisplay === 'function') {
                window.__tbSetStakesDisplay(r.stakes_display);
              }
            } else {
              recPanel.innerHTML = '<div class="tb-rec-err">' + ((r && r.error) || 'Phan tich that bai') + '</div>';
            }
          }
        } catch (e) {
          if (recPanel) recPanel.innerHTML = '<div class="tb-rec-err">' + String(e.message || e) + '</div>';
        } finally {
          suggestBtn.disabled = false;
          suggestBtn.textContent = 'De xuat config';
        }
      });
    }
    const dailyBtn = document.getElementById('tb-daily-btn');
    if (dailyBtn && !dailyBtn.dataset.bound) {
      dailyBtn.dataset.bound = '1';
      dailyBtn.addEventListener('click', async () => {
        if (typeof window.toolbetDailyAnalysis !== 'function') {
          if (recPanel) {
            recPanel.classList.add('open');
            recPanel.innerHTML = '<div class="tb-rec-err">Chua ket noi tool</div>';
          }
          return;
        }
        dailyBtn.disabled = true;
        dailyBtn.textContent = '...';
        if (recPanel) {
          recPanel.classList.add('open');
          recPanel.innerHTML = '<div class="tb-rec-title">Dang phan tich ngay...</div>';
        }
        try {
          const r = await window.toolbetDailyAnalysis();
          if (recPanel) {
            if (r && r.ok && r.html) recPanel.innerHTML = r.html;
            else recPanel.innerHTML = '<div class="tb-rec-err">' + ((r && r.error) || 'Phan tich that bai') + '</div>';
          }
        } catch (e) {
          if (recPanel) recPanel.innerHTML = '<div class="tb-rec-err">' + String(e.message || e) + '</div>';
        } finally {
          dailyBtn.disabled = false;
          dailyBtn.textContent = 'Phan tich ngay';
        }
      });
    }
    const scopeWrap = document.getElementById('tb-stats-scope');
    if (scopeWrap && !scopeWrap.dataset.bound) {
      scopeWrap.dataset.bound = '1';
      scopeWrap.querySelectorAll('.tb-stats-scope-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const scope = btn.getAttribute('data-scope');
          if (!scope || typeof window.toolbetSetStatsScope !== 'function') return;
          scopeWrap.querySelectorAll('.tb-stats-scope-btn').forEach(b => b.classList.remove('on'));
          btn.classList.add('on');
          try { await window.toolbetSetStatsScope(scope); } catch (e) { /* ignore */ }
        });
      });
    }
    if (limitsSave && !limitsSave.dataset.bound) {
      limitsSave.dataset.bound = '1';
      limitsSave.addEventListener('click', async () => {
        if (typeof window.toolbetSaveLimits !== 'function') {
          showLimitMsg('Chua ket noi — cho tool', false);
          return;
        }
        const sl = document.getElementById('tb-stop-loss');
        const tp = document.getElementById('tb-take-profit');
        const gtp = document.getElementById('tb-group-take-profit');
        const gsl = document.getElementById('tb-group-stop-loss');
        const mode = document.getElementById('tb-progression-mode');
        limitsSave.disabled = true;
        limitsSave.textContent = '...';
        try {
          const r = await window.toolbetSaveLimits(
            (sl && sl.value) || '',
            (tp && tp.value) || '',
            (gtp && gtp.value) || '',
            (gsl && gsl.value) || '',
            (mode && mode.value) || 'loss_up_win_reset'
          );
          if (r && r.ok) showLimitMsg('Da luu gioi han', true);
          else showLimitMsg((r && r.error) || 'Luu that bai', false);
        } catch (e) {
          const msg = String(e.message || e);
          showLimitMsg(
            /not exposed/i.test(msg)
              ? 'Mat ket noi tool — chay lai ToolBet roi bam Luu'
              : msg,
            false
          );
        } finally {
          limitsSave.disabled = false;
          limitsSave.textContent = 'Luu';
        }
      });
    }
    const tieToggle = document.getElementById('tb-tie-toggle');
    if (tieToggle && !tieToggle.dataset.bound) {
      tieToggle.dataset.bound = '1';
      tieToggle.addEventListener('click', async () => {
        const next = !tieToggle.classList.contains('on');
        setTieEnabledUi(next);
        if (typeof window.toolbetToggleTieNurture !== 'function') return;
        tieToggle.disabled = true;
        try {
          const form = readTieForm();
          form.enabled = next;
          const r = await window.toolbetToggleTieNurture(next, form);
          if (r && r.ok && r.tie_nurture) window.__tbSetTieNurture(r.tie_nurture);
          else if (r && r.ok) setTieEnabledUi(!!r.enabled);
        } catch (e) { /* ignore */ }
        finally { tieToggle.disabled = false; }
      });
    }
    const tiePreset = document.getElementById('tb-tie-preset');
    if (tiePreset && !tiePreset.dataset.bound) {
      tiePreset.dataset.bound = '1';
      tiePreset.addEventListener('change', () => {
        const id = tiePreset.value;
        if (id === 'custom') return;
        const opt = tiePreset.selectedOptions && tiePreset.selectedOptions[0];
        // Lay gia tri tu data-attr neu co; fallback map hardcode
        const PRESETS = {
          thu_can_bang: { gap_min: 18, gap_max: 25, max_bets: 3, stake: 100, payout: 8, session_stop_loss: 3000 },
          thu_pnl_max: { gap_min: 18, gap_max: 35, max_bets: 3, stake: 100, payout: 8, session_stop_loss: 3000 },
          goc_nuoi: { gap_min: 10, gap_max: 0, max_bets: 0, stake: 100, payout: 8, session_stop_loss: 3000 },
        };
        const p = PRESETS[id];
        if (!p) return;
        const en = !!(document.getElementById('tb-tie-toggle') || {}).classList?.contains?.('on')
          || (document.getElementById('tb-tie-toggle') && document.getElementById('tb-tie-toggle').classList.contains('on'));
        window.__tbSetTieNurture({ ...p, preset: id, enabled: en });
      });
    }
    const tieSave = document.getElementById('tb-tie-save');
    const tieMsg = document.getElementById('tb-tie-msg');
    const showTieMsg = (text, ok) => {
      if (!tieMsg) return;
      tieMsg.textContent = text || '';
      tieMsg.className = 'tb-stakes-msg ' + (ok ? 'ok' : 'err');
    };
    if (tieSave && !tieSave.dataset.bound) {
      tieSave.dataset.bound = '1';
      tieSave.addEventListener('click', async () => {
        if (typeof window.toolbetSaveTieNurture !== 'function') {
          showTieMsg('Chua ket noi — cho tool', false);
          return;
        }
        tieSave.disabled = true;
        tieSave.textContent = '...';
        try {
          const form = readTieForm();
          // Sua tay → danh dau custom neu lech preset
          form.preset = form.preset || 'custom';
          const r = await window.toolbetSaveTieNurture(form);
          if (r && r.ok) {
            showTieMsg('Da luu nuoi Hoa', true);
            if (r.tie_nurture) window.__tbSetTieNurture(r.tie_nurture);
          } else showTieMsg((r && r.error) || 'Luu that bai', false);
        } catch (e) {
          showTieMsg(String(e.message || e), false);
        } finally {
          tieSave.disabled = false;
          tieSave.textContent = 'Luu';
        }
      });
    }
    const tieSection = document.getElementById('tb-tie-section');
    if (tieSection && !tieSection.dataset.stepBound) {
      tieSection.dataset.stepBound = '1';
      tieSection.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tie-step]');
        if (!btn || !tieSection.contains(btn)) return;
        e.preventDefault();
        const key = btn.getAttribute('data-tie-step');
        const dir = Number(btn.getAttribute('data-dir') || 1);
        const idMap = {
          gap_min: 'tb-tie-gap-min',
          gap_max: 'tb-tie-gap-max',
          max_bets: 'tb-tie-max-bets',
          stake: 'tb-tie-stake',
          payout: 'tb-tie-payout',
          session_stop_loss: 'tb-tie-session-sl',
        };
        const input = document.getElementById(idMap[key]);
        if (!input) return;
        const step = TIE_STEP[key] || 1;
        let v = Number(input.value);
        if (!Number.isFinite(v)) v = 0;
        v = Math.max(0, v + dir * step);
        if (key === 'gap_min' || key === 'stake' || key === 'payout') v = Math.max(key === 'gap_min' ? 1 : (key === 'stake' ? 10 : 1), v);
        input.value = String(v);
        const presetEl = document.getElementById('tb-tie-preset');
        if (presetEl) presetEl.value = 'custom';
      });
      // Sua o → custom
      tieSection.querySelectorAll('input[type="number"]').forEach((inp) => {
        inp.addEventListener('change', () => {
          const presetEl = document.getElementById('tb-tie-preset');
          if (presetEl) presetEl.value = 'custom';
        });
      });
    }
  };

  window.__tbBindBettingControls();
  setAutoUi(autoBet);
  setWatchRecoverUi(lossWatchRecover);
  if (opts && opts.tieNurture) window.__tbSetTieNurture(opts.tieNurture);
  window.__tbSetBettingState && window.__tbSetBettingState(opts || {});
  // Install opts dung camelCase — map sang group_progress de hien TP/SL ngay
  window.__tbSetGroupProgress && window.__tbSetGroupProgress({
    groupTakeProfit: (opts && opts.groupTakeProfit) || '',
    groupStopLoss: (opts && opts.groupStopLoss) || '',
    group_progress: {
      group_take_profit: (opts && opts.groupTakeProfit) || 0,
      group_stop_loss: (opts && opts.groupStopLoss) || 0,
    }
  });

  const bindPatternToggles = () => {
    const patternsEl = document.getElementById('tb-patterns');
    if (!patternsEl || patternsEl.dataset.toggleBound) return;
    patternsEl.dataset.toggleBound = '1';
    patternsEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('.tb-pattern-toggle');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const chip = btn.closest('.tb-pattern');
      const id = chip && chip.dataset.id;
      if (!id || typeof window.toolbetTogglePattern !== 'function') return;
      const next = !btn.classList.contains('on');
      btn.disabled = true;
      try {
        const r = await window.toolbetTogglePattern(id, next);
        if (r && r.ok && typeof r.enabled === 'boolean') {
          btn.classList.toggle('on', r.enabled);
          if (chip) chip.classList.toggle('off', !r.enabled);
        }
      } catch (err) { /* ignore */ }
      finally { btn.disabled = false; }
    });
    patternsEl.addEventListener('change', async (e) => {
      const sel = e.target.closest('.tb-pattern-len');
      if (!sel) return;
      e.stopPropagation();
      const id = sel.getAttribute('data-id') || (sel.closest('.tb-pattern') || {}).dataset?.id;
      const length = parseInt(sel.value, 10);
      if (!id || !length || typeof window.toolbetSetPatternLength !== 'function') return;
      sel.disabled = true;
      try {
        const r = await window.toolbetSetPatternLength(id, length);
        if (r && r.ok && r.length) sel.value = String(r.length);
      } catch (err) { /* ignore */ }
      finally { sel.disabled = false; }
    });
  };
  bindPatternToggles();
}
"""

UPDATE_SCRIPT = """
(data) => {
  // Khoi phuc click panel neu bi tat sau lan bot click chip/ban
  const leftPanel = document.getElementById('toolbet-overlay-left');
  const rightPanel = document.getElementById('toolbet-overlay');
  if (leftPanel) leftPanel.style.pointerEvents = 'auto';
  if (rightPanel) rightPanel.style.pointerEvents = 'auto';

  const body = document.getElementById('tb-body-content');
  const tableEl = document.getElementById('tb-table');
  const leftOk = document.getElementById('toolbet-overlay-left')
    && document.getElementById('tb-patterns')
    && document.getElementById('tb-auto-toggle');
  const centerOk = document.getElementById('toolbet-overlay-center')
    && document.getElementById('tb-group-progress')
    && document.getElementById('tb-stakes-mid')
    && document.getElementById('tb-stakes-input');
  if (!body || !tableEl || !leftOk || !centerOk) return { ok: false, needsInstall: true };

  if (data.stakes_display && typeof window.__tbSetStakesDisplay === 'function') {
    window.__tbSetStakesDisplay(data.stakes_display);
  }
  if (typeof window.__tbSetBettingState === 'function') {
    window.__tbSetBettingState(data);
  }
  if (typeof window.__tbSetGroupProgress === 'function') {
    window.__tbSetGroupProgress(data);
  }

  const stakeStepsEl = document.getElementById('tb-stake-steps');
  const stakeStepsHint = document.getElementById('tb-stake-steps-hint');
  if (stakeStepsEl) {
    const steps = data.stake_steps || [];
    if (!steps.length) {
      stakeStepsEl.innerHTML = '';
    } else {
      stakeStepsEl.innerHTML = steps.map(s => {
        let rateCls = 'na';
        if (typeof s.win_rate === 'number') {
          rateCls = s.win_rate >= 0.5 ? 'good' : 'bad';
        }
        if (s.low_confidence) rateCls += ' low-conf';
        const active = (typeof data.current_stake_index === 'number' && s.index === data.current_stake_index)
          ? ' active' : '';
        const detail = s.detail ? `<span class="tb-step-detail">${s.detail}</span>` : '';
        return `<div class="tb-stake-step${active}" title="Buoc ${s.step}: stake ${s.stake}">`
          + `<span class="tb-step-num">${s.step}.</span> `
          + `<span class="tb-step-amt">${s.stake}</span> `
          + `<span class="tb-step-rate ${rateCls}">${s.display || '—'}</span> `
          + detail
          + `</div>`;
      }).join('');
    }
  }
  if (stakeStepsHint) {
    const label = data.stake_steps_label || 'Win% hom nay theo tung buoc';
    const warn = data.stake_steps_warn || '';
    stakeStepsHint.textContent = warn ? `${label} — ${warn}` : label;
  }

  tableEl.textContent = data.table
    ? `${data.table} | ${data.round_count} van (B${data.stats?.banker ?? '?'} P${data.stats?.player ?? '?'} T${data.stats?.tie ?? '?'})`
    : `Dang cho du lieu...`;

  const patternsEl = document.getElementById('tb-patterns');
  if (patternsEl) {
    patternsEl.innerHTML = (data.patterns || [])
      .map(p => {
        const enabled = p.enabled !== false;
        const cls = 'tb-pattern'
          + (enabled ? '' : ' off')
          + (p.active ? ' active' : '')
          + (p.building ? ' building' : '');
        const toggleCls = 'tb-pattern-toggle' + (enabled ? ' on' : '');
        const title = p.rule ? ` title="${p.rule.replace(/"/g, '&quot;')}"` : '';
        const rateText = p.win_rate_display || '—';
        let rateCls = 'na';
        if (typeof p.win_rate === 'number') {
          rateCls = p.win_rate >= 0.5 ? 'good' : 'bad';
        }
        if (p.low_confidence) rateCls += ' low-conf';
        const pnlText = p.pnl_display || '—';
        let pnlCls = 'na';
        if (typeof p.profit === 'number') {
          if (p.profit > 0) pnlCls = 'profit-pos';
          else if (p.profit < 0) pnlCls = 'profit-neg';
          else pnlCls = 'zero';
        }
        const lenOpts = (p.length_choices || [2, 3, 4]).map(n => {
          const sel = Number(p.length) === Number(n) ? ' selected' : '';
          return `<option value="${n}"${sel}>${n}</option>`;
        }).join('');
        return `<span class="${cls}" data-id="${p.id}"${title}>`
          + `<button class="${toggleCls}" type="button" aria-label="Bat tat ${p.name}"></button>`
          + `<b>${p.name}</b>`
          + `<select class="tb-pattern-len" data-id="${p.id}" title="So van dieu kien" aria-label="So van ${p.name}">${lenOpts}</select>`
          + `<span class="tb-pattern-stats">`
          + `<span class="tb-pattern-rate ${rateCls}">${rateText}</span>`
          + `<span class="tb-pattern-pnl ${pnlCls}">${pnlText}</span>`
          + `</span></span>`;
      })
      .join('');
  }
  const hintEl = document.getElementById('tb-pattern-hint');
  if (hintEl && data.pattern_priority_hint) {
    hintEl.textContent = 'Uu tien: ' + data.pattern_priority_hint;
  }
  const warnEl = document.getElementById('tb-stats-warn');
  if (warnEl) {
    if (data.stats_low_confidence) {
      warnEl.style.display = 'block';
      warnEl.textContent = data.stats_low_confidence;
    } else {
      warnEl.style.display = 'none';
      warnEl.textContent = '';
    }
  }
  const scopeWrap = document.getElementById('tb-stats-scope');
  if (scopeWrap && data.stats_scope) {
    scopeWrap.querySelectorAll('.tb-stats-scope-btn').forEach(btn => {
      btn.classList.toggle('on', btn.getAttribute('data-scope') === data.stats_scope);
    });
  }

  const dots = (data.history_dots || [])
    .map(d => `<span class="tb-dot ${d.side}" title="${d.label}"></span>`)
    .join('');

  const matched = (data.matched || [])
    .map(m => `<div class="tb-match"><b>${m.name}</b><br>${m.reason}</div>`)
    .join('');

  const building = (data.building || [])
    .map(b => `<div class="tb-building"><b>${b.name}</b> <span class="tb-progress">(${b.progress})</span><br>${b.reason}</div>`)
    .join('');

  let signalClass = 'none';
  let signalHtml = 'Chua co tin hieu cuoc';
  if (data.has_signal && data.signal_side) {
    signalClass = data.signal_key || 'player';
    signalHtml = `CUOC TIEP: ${data.signal_side.toUpperCase()}`;
  }

  body.innerHTML = `
    <div class="tb-section">
      <div class="tb-label">Lich su gan nhat (co hoa) — ${data.recent_dots_count || 0} van</div>
      <div class="tb-dots">${dots || '<span class="tb-empty">Chua co van</span>'}</div>
    </div>
    <div class="tb-section">
      <div class="tb-label">Chuoi gan day (${data.recent_count || 0} van, bo qua hoa)</div>
      <div class="tb-history-text">${data.history_text || '(trong)'}</div>
    </div>
    <div class="tb-section">
      <div class="tb-signal ${signalClass}">${signalHtml}</div>
    </div>
    ${matched ? `<div class="tb-section"><div class="tb-label">Mau khop</div>${matched}</div>` : ''}
    ${building ? `<div class="tb-section"><div class="tb-label">Dang hinh thanh</div>${building}</div>` : ''}
  `;
  return { ok: true };
}
"""


def build_overlay_payload(
    history: list[BetSide],
    table_name: str = "",
    table_id: str = "",
    skip_tie: bool = True,
    recent_dots: int = 24,
    recent_text: int = 14,
    stakes: list[int] | None = None,
    betting: dict[str, Any] | None = None,
    display_stats: dict[str, int] | None = None,
    pattern_enabled: dict[str, bool] | None = None,
    pattern_lengths: dict[str, int] | None = None,
    pattern_win_rates: dict[str, dict[str, Any]] | None = None,
    stats_scope: str = "today",
    stake_steps: list[dict[str, Any]] | None = None,
    stake_steps_label: str = "",
    stake_steps_warn: str = "",
    pnl_today: dict[str, Any] | None = None,
    pnl_7days: dict[str, Any] | None = None,
) -> dict[str, Any]:
    # Hien thi day du lich su (co ca hoa) tren dots; chi bo qua hoa khi phan tich mau cuoc
    full = list(history)
    h = filter_history(history, skip_tie)
    enabled_map = pattern_enabled or {}
    lengths_map = pattern_lengths or {}
    disabled = frozenset(pid for pid, on in enabled_map.items() if not on)
    analyses = analyze_patterns(
        history,
        skip_tie,
        disabled_patterns=disabled,
        pattern_lengths=lengths_map,
    )
    matched = [a for a in analyses if a.status == "matched"]
    building = [a for a in analyses if a.status == "building"][:5]

    active_ids = {a.pattern_id for a in matched}
    building_ids = {a.pattern_id for a in building} - active_ids
    rates = pattern_win_rates or {}
    low_any = False
    patterns_ui = []
    for p in pattern_catalog(lengths_map):
        r = rates.get(str(p["id"]), {})
        low = bool(r.get("low_confidence"))
        if low:
            low_any = True
        patterns_ui.append(
        {
            "id": p["id"],
            "name": p["name"],
            "rule": p["rule"],
            "length": int(p.get("length") or 2),
            "length_choices": list(p.get("length_choices") or [2, 3, 4]),
            "enabled": enabled_map.get(str(p["id"]), True),
            "active": p["id"] in active_ids,
            "building": p["id"] in building_ids,
            "win_rate_display": r.get("display", "—"),
            "win_rate": r.get("win_rate"),
            "pnl_display": r.get("pnl_display", "—"),
            "profit": r.get("profit"),
            "low_confidence": low,
        }
        )

    dots_full = full[-recent_dots:] if full else []
    text_src = h[-recent_text:] if h else []

    signal = matched[0] if matched else None
    hist_stats = {
        "banker": sum(1 for s in full if s == BetSide.BANKER),
        "player": sum(1 for s in full if s == BetSide.PLAYER),
        "tie": sum(1 for s in full if s == BetSide.TIE),
    }
    stats = hist_stats
    round_count = len(full)

    payload: dict[str, Any] = {
        "table": table_name,
        "table_id": table_id,
        "round_count": round_count,
        "round_count_no_tie": len(h),
        "stats": stats,
        "recent_count": len(text_src),
        "recent_dots_count": len(dots_full),
        "history_dots": [
            {
                "side": s.value,
                "label": SIDE_LABEL.get(s, s.value),
            }
            for s in dots_full
        ],
        "history_text": " → ".join(SIDE_LABEL.get(s, s.value) for s in text_src) if text_src else "(trong)",
        "has_signal": signal is not None,
        "signal_side": SIDE_LABEL[signal.bet_side] if signal and signal.bet_side else None,
        "signal_key": signal.bet_side.value if signal and signal.bet_side else None,
        "matched": [
            {
                "name": a.pattern_name,
                "reason": a.reason,
            }
            for a in matched
        ],
        "building": [
            {
                "name": a.pattern_name,
                "progress": a.progress,
                "reason": a.reason,
            }
            for a in building
        ],
        "patterns": patterns_ui,
        "pattern_priority_hint": pattern_priority_hint(
            disabled_patterns=disabled,
            pattern_lengths=lengths_map,
        ),
        "stakes_display": format_stakes(stakes) if stakes else "",
        "stats_scope": stats_scope,
        "stats_low_confidence": (
            "~ = mau < 30 cuoc, chua du tin cay"
            if low_any and stats_scope in ("today", "7days")
            else ""
        ),
        "stake_steps": stake_steps or [],
        "stake_steps_label": stake_steps_label or "Win% hom nay theo tung buoc",
        "stake_steps_warn": stake_steps_warn or "",
    }
    if betting:
        from src.bet_analytics import PnlSummary, format_pnl_summary_line

        limit_line = betting.get("limit_text") or ""
        last_bet = betting.get("last_bet") or "Chua co cuoc"
        today_sum = PnlSummary(**(pnl_today or {})) if pnl_today else None
        week_sum = PnlSummary(**(pnl_7days or {})) if pnl_7days else None
        pnl_lines = ""
        if today_sum:
            pnl_lines += format_pnl_summary_line(today_sum, label="P&L hom nay")
        if week_sum:
            pnl_lines += format_pnl_summary_line(week_sum, label="P&L 7 ngay")
        payload.update({
            "auto_bet": bool(betting.get("auto_bet")),
            "stop_loss_display": format_limit(float(betting.get("stop_loss", 0))),
            "take_profit_display": format_limit(float(betting.get("take_profit", 0))),
            "group_take_profit_display": format_limit(float(betting.get("group_take_profit", 0))),
            "group_stop_loss_display": format_limit(float(betting.get("group_stop_loss", 0))),
            "progression_mode": betting.get("progression_mode", "loss_up_win_reset"),
            "loss_watch_recover": bool(betting.get("loss_watch_recover")),
            "tie_nurture": betting.get("tie_nurture") or {},
            "current_stake_index": int(betting.get("stake_index", 0)),
            "group_progress": {
                "open": betting.get("current_group_id") is not None,
                "group_id": betting.get("current_group_id"),
                "seq_no": betting.get("current_group_seq"),
                "groups_closed": int(betting.get("groups_closed", 0)),
                "stake_index": int(betting.get("stake_index", 0)),
                "stake_step": int(betting.get("stake_step", int(betting.get("stake_index", 0)) + 1)),
                "stake_total_steps": int(betting.get("stake_total_steps", 0)),
                "current_stake": betting.get("current_stake", 0),
                "next_stake": betting.get("next_stake", 0),
                "next_stake_step": int(betting.get("next_stake_step", 1)),
                "next_stake_on_win": betting.get("next_stake_on_win", 0),
                "next_stake_step_on_win": int(betting.get("next_stake_step_on_win", 1)),
                "progression_mode": betting.get("progression_mode", "loss_up_win_reset"),
                "loss_watch_recover": bool(betting.get("loss_watch_recover")),
                "stakes": list(betting.get("stakes") or stakes or []),
                "group_pnl": float(betting.get("group_pnl", 0)),
                "group_loss_count": int(betting.get("group_loss_count", 0)),
                "group_results": list(betting.get("group_results") or []),
                "group_wins": int(betting.get("group_wins", 0)),
                "group_losses": int(betting.get("group_losses", 0)),
                "group_pushes": int(betting.get("group_pushes", 0)),
                "group_take_profit": betting.get("group_take_profit", 0),
                "group_stop_loss": betting.get("group_stop_loss", 0),
                "pending": bool(betting.get("pending")),
                "last_bet": betting.get("last_bet") or "",
                "auto_bet": bool(betting.get("auto_bet")),
            },
            "bet_stats_html": (
                pnl_lines
                + f'<div>Muc cuoc: <b>{betting.get("current_stake", 0)}</b> '
                f'(buoc {int(betting.get("stake_index", 0)) + 1}) | '
                f'PnL nhom: <b>{betting.get("group_pnl", 0):+.0f}</b> | '
                f'Thua nhom: {int(betting.get("group_loss_count", 0))}</div>'
                f'<div>{last_bet}</div>'
                f'{"<div class=limit-warn>" + limit_line + "</div>" if limit_line else ""}'
            ),
        })
    return payload


def url_should_host_overlay(url: str, site_id: str | None = None) -> bool:
    """URL co the mang panel tool (theo shell_mode), chua check phase room.

    - Tab AE SEXY / webmain → yes
    - Shell casino_iframe (vipbet): bat ky trang host site (game co the mo tren /casino
      hoac trang chu qua #iframe_game fullscreen)
    - Shell provider_tab (live.html, home) → no (game o tab CDN rieng)
    - Shell web khac → no
    """
    from src.ae_sexy import is_ae_sexy_url
    from src.sites import get_active_site, resolve_site

    u = (url or "").strip()
    if not u or u.lower().startswith(("about:", "chrome:", "devtools:", "edge:")):
        return False
    low = u.lower()
    if is_ae_sexy_url(u) or "webmain" in low:
        return True

    try:
        shell = resolve_site(u)
    except ValueError:
        return False

    try:
        active = resolve_site(site_id) if site_id else get_active_site()
    except Exception:
        active = get_active_site()
    if shell.info.id != active.info.id:
        return False

    if shell.info.shell_mode == "casino_iframe":
        # Game overlay (#iframe_game) co the nam tren /casino HOAC trang chu
        return shell.info.matches_url(u)
    return False


async def page_should_host_overlay(page: Page, site_id: str | None = None) -> bool:
    """True khi tab dang la noi hien thi tool (AE tab hoac casino_iframe da mo game)."""
    try:
        url = page.url or ""
    except Exception:
        return False

    from src.ae_sexy import is_ae_sexy_url

    if is_ae_sexy_url(url) or "webmain" in (url or "").lower():
        return True

    if not url_should_host_overlay(url, site_id=site_id):
        return False

    # casino_iframe: gan khi da mo AE (room/lobby/loading) — ke ca URL trang chu
    from src.ae_sexy import (
        PHASE_LOADING,
        PHASE_LOBBY,
        PHASE_ROOM,
        _game_launched,
        _get_shell_mode,
        detect_ae_sexy_phase,
        is_ae_sexy_in_room,
    )

    try:
        mode = await asyncio.wait_for(_get_shell_mode(page), timeout=2.5)
    except Exception:
        mode = ""
    if mode in ("room", "lobby", "loading"):
        return True

    try:
        phase = await detect_ae_sexy_phase(page)
    except Exception:
        phase = ""
    if phase in (PHASE_ROOM, PHASE_LOBBY, PHASE_LOADING):
        return True

    try:
        if await is_ae_sexy_in_room(page):
            return True
    except Exception:
        pass

    try:
        return bool(await _game_launched(page))
    except Exception:
        return False


class GameOverlay:
    """Panel overlay tren trang casino (ngoai iframe game)."""

    _BRIDGE_NAMES = (
        "toolbetSaveStakes",
        "toolbetToggleAutoBet",
        "toolbetToggleWatchRecover",
        "toolbetSaveLimits",
        "toolbetTogglePattern",
        "toolbetSetPatternLength",
        "toolbetSuggestConfig",
        "toolbetDailyAnalysis",
        "toolbetSetStatsScope",
        "toolbetSaveTieNurture",
        "toolbetToggleTieNurture",
    )

    def __init__(self):
        self._installed = False
        self._stakes: list[int] = []
        self._save_handler = None
        self._toggle_handler = None
        self._watch_recover_handler = None
        self._limits_handler = None
        self._pattern_toggle_handler = None
        self._pattern_length_handler = None
        self._suggest_handler = None
        self._daily_handler = None
        self._stats_scope_handler = None
        self._tie_nurture_handler = None
        self._auto_bet = False
        self._stop_loss = 0.0
        self._take_profit = 0.0
        self._group_take_profit = 0.0
        self._group_stop_loss = 0.0
        self._progression_mode = "loss_up_win_reset"
        self._loss_watch_recover = False
        self._tie_nurture: dict[str, Any] = {}
        self._pattern_enabled: dict[str, bool] = {}
        self._pattern_lengths: dict[str, int] = {}
        self._bound_ctx_id: int | None = None
        self._exposed_names: set[str] = set()

    def set_stakes(self, stakes: list[int]):
        self._stakes = list(stakes)

    def set_betting_ui(
        self,
        *,
        auto_bet: bool,
        stop_loss: float,
        take_profit: float,
        group_take_profit: float = 0.0,
        group_stop_loss: float = 0.0,
        progression_mode: str = "loss_up_win_reset",
        loss_watch_recover: bool = False,
    ):
        self._auto_bet = auto_bet
        self._stop_loss = stop_loss
        self._take_profit = take_profit
        self._group_take_profit = group_take_profit
        self._group_stop_loss = group_stop_loss
        self._progression_mode = progression_mode
        self._loss_watch_recover = bool(loss_watch_recover)

    def set_tie_nurture(self, data: dict[str, Any] | None):
        from src.tie_nurture_config import tie_nurture_to_overlay
        from src.config import TieNurtureConfig

        if isinstance(data, TieNurtureConfig):
            self._tie_nurture = tie_nurture_to_overlay(data)
        elif isinstance(data, dict) and data:
            # Dam bao co presets trong payload overlay
            from src.tie_nurture_config import normalize_tie_nurture_dict, preset_options_for_overlay

            cfg = normalize_tie_nurture_dict(data)
            payload = tie_nurture_to_overlay(cfg)
            if data.get("presets"):
                payload["presets"] = data["presets"]
            else:
                payload["presets"] = preset_options_for_overlay()
            self._tie_nurture = payload
        else:
            self._tie_nurture = tie_nurture_to_overlay(TieNurtureConfig())

    def set_save_handler(self, handler):
        """handler(text: str) -> dict voi keys ok, display?, error?"""
        self._save_handler = handler

    def set_toggle_handler(self, handler):
        """handler(enabled: bool) -> dict"""

        self._toggle_handler = handler

    def set_watch_recover_handler(self, handler):
        """handler(enabled: bool) -> dict with ok, loss_watch_recover"""

        self._watch_recover_handler = handler

    def set_limits_handler(self, handler):
        """handler(stop_loss, take_profit, group_take_profit, group_stop_loss, progression_mode) -> dict"""

        self._limits_handler = handler

    def set_tie_nurture_handler(self, handler):
        """handler(action, payload) -> dict; action=save|toggle"""

        self._tie_nurture_handler = handler

    def set_pattern_enabled(self, enabled: dict[str, bool]):
        self._pattern_enabled = dict(enabled)

    def set_pattern_lengths(self, lengths: dict[str, int]):
        self._pattern_lengths = dict(lengths)

    def set_pattern_toggle_handler(self, handler):
        """handler(pattern_id: str, enabled: bool) -> dict"""

        self._pattern_toggle_handler = handler

    def set_pattern_length_handler(self, handler):
        """handler(pattern_id: str, length: int) -> dict"""

        self._pattern_length_handler = handler

    def set_suggest_handler(self, handler):
        """handler() -> dict with ok, html, stakes_display, patterns, ..."""

        self._suggest_handler = handler

    def set_daily_handler(self, handler):
        """handler() -> dict with ok, html, ..."""

        self._daily_handler = handler

    def set_stats_scope_handler(self, handler):
        """handler(scope: str) -> dict"""

        self._stats_scope_handler = handler

    async def _expose_fn(self, page: Page, name: str, callback) -> bool:
        """Gan bridge Python↔JS. Uu tien context (moi tab), roi page."""
        try:
            ctx = page.context
            ctx_id = id(ctx)
        except Exception:
            ctx = None
            ctx_id = None
        if ctx_id != self._bound_ctx_id:
            self._bound_ctx_id = ctx_id
            self._exposed_names.clear()
            # Stub chet tu lan CDP truoc: typeof=function nhung goi → "is not exposed"
            try:
                await page.evaluate(
                    """(names) => {
                      for (const n of names) {
                        try {
                          if (typeof window[n] === 'function') delete window[n];
                        } catch (e) {}
                      }
                    }""",
                    list(self._BRIDGE_NAMES),
                )
            except Exception:
                pass

        if name in self._exposed_names:
            try:
                await page.expose_function(name, callback)
            except Exception as exc:
                if "already registered" not in str(exc).lower():
                    logger.debug("Re-expose page %s: %s", name, exc)
            return True

        last_err: Exception | None = None
        if ctx is not None:
            try:
                await ctx.expose_function(name, callback)
                self._exposed_names.add(name)
                return True
            except Exception as exc:
                if "already registered" in str(exc).lower():
                    self._exposed_names.add(name)
                    return True
                last_err = exc
        try:
            await page.expose_function(name, callback)
            self._exposed_names.add(name)
            return True
        except Exception as exc:
            if "already registered" in str(exc).lower():
                self._exposed_names.add(name)
                return True
            last_err = exc
        logger.warning("Khong expose %s: %s", name, last_err)
        return False

    async def bind_callbacks(self, page: Page) -> bool:
        ok = True

        if self._save_handler:

            async def _save(text: str) -> dict:
                try:
                    result = self._save_handler(text)
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False, "error": "Loi luu"}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetSaveStakes", _save):
                ok = False

        if self._toggle_handler:

            async def _toggle(enabled: bool) -> dict:
                try:
                    result = self._toggle_handler(enabled)
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetToggleAutoBet", _toggle):
                ok = False

        if self._watch_recover_handler:

            async def _watch_recover(enabled: bool) -> dict:
                try:
                    result = self._watch_recover_handler(enabled)
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetToggleWatchRecover", _watch_recover):
                ok = False

        if self._limits_handler:

            async def _limits(
                stop_loss: str,
                take_profit: str,
                group_take_profit: str = "",
                group_stop_loss: str = "",
                progression_mode: str = "loss_up_win_reset",
            ) -> dict:
                try:
                    result = self._limits_handler(
                        stop_loss,
                        take_profit,
                        group_take_profit,
                        group_stop_loss,
                        progression_mode,
                    )
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetSaveLimits", _limits):
                ok = False

        if self._pattern_toggle_handler:

            async def _pattern_toggle(pattern_id: str, enabled: bool) -> dict:
                try:
                    result = self._pattern_toggle_handler(pattern_id, enabled)
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetTogglePattern", _pattern_toggle):
                ok = False

        if self._pattern_length_handler:

            async def _pattern_length(pattern_id: str, length: int) -> dict:
                try:
                    result = self._pattern_length_handler(pattern_id, int(length))
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetSetPatternLength", _pattern_length):
                ok = False

        if self._suggest_handler:

            async def _suggest() -> dict:
                try:
                    result = self._suggest_handler()
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False, "error": "Loi phan tich"}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetSuggestConfig", _suggest):
                ok = False

        if self._daily_handler:

            async def _daily() -> dict:
                try:
                    result = self._daily_handler()
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False, "error": "Loi phan tich"}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetDailyAnalysis", _daily):
                ok = False

        if self._stats_scope_handler:

            async def _stats_scope(scope: str) -> dict:
                try:
                    result = self._stats_scope_handler(scope)
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetSetStatsScope", _stats_scope):
                ok = False

        if self._tie_nurture_handler:

            async def _save_tie(payload: dict) -> dict:
                try:
                    result = self._tie_nurture_handler("save", payload or {})
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False, "error": "Loi luu"}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            async def _toggle_tie(enabled: bool, payload: dict | None = None) -> dict:
                try:
                    data = dict(payload or {})
                    data["enabled"] = bool(enabled)
                    result = self._tie_nurture_handler("toggle", data)
                    if hasattr(result, "__await__"):
                        result = await result
                    return result if isinstance(result, dict) else {"ok": False, "error": "Loi toggle"}
                except Exception as exc:
                    return {"ok": False, "error": str(exc)}

            if not await self._expose_fn(page, "toolbetSaveTieNurture", _save_tie):
                ok = False
            if not await self._expose_fn(page, "toolbetToggleTieNurture", _toggle_tie):
                ok = False

        return ok

    async def _panels_present(self, page: Page) -> bool:
        try:
            return bool(await page.evaluate(PANELS_DOM_CHECK))
        except Exception:
            return False

    async def install(self, page: Page, stakes: list[int] | None = None) -> bool:
        try:
            url = ""
            try:
                url = page.url or ""
            except Exception:
                url = ""
            # provider_tab → tab AE SEXY; casino_iframe → /casino khi da mo game
            if not await page_should_host_overlay(page):
                logger.debug("Bo qua overlay — khong phai host game: %s", url[:70])
                return False
            if stakes:
                self._stakes = list(stakes)
            await self.bind_callbacks(page)
            opts = {
                "stakesText": format_stakes(self._stakes or [20, 50, 100, 200]),
                "autoBet": self._auto_bet,
                "stopLoss": format_limit(self._stop_loss),
                "takeProfit": format_limit(self._take_profit),
                "groupTakeProfit": format_limit(self._group_take_profit),
                "groupStopLoss": format_limit(self._group_stop_loss),
                "progressionMode": self._progression_mode,
                "lossWatchRecover": self._loss_watch_recover,
                "tieNurture": self._tie_nurture or {},
            }
            await page.evaluate(INSTALL_SCRIPT, opts)
            self._installed = True
            return True
        except Exception as e:
            logger.warning("Khong gan duoc overlay: %s", e)
            return False

    async def update(
        self,
        page: Page,
        history: list[BetSide],
        table_name: str = "",
        table_id: str = "",
        skip_tie: bool = True,
        stakes: list[int] | None = None,
        betting: dict[str, Any] | None = None,
        display_stats: dict[str, int] | None = None,
        pattern_enabled: dict[str, bool] | None = None,
        pattern_lengths: dict[str, int] | None = None,
        pattern_win_rates: dict[str, dict[str, Any]] | None = None,
        stats_scope: str = "today",
        stake_steps: list[dict[str, Any]] | None = None,
        stake_steps_label: str = "",
        stake_steps_warn: str = "",
        pnl_today: dict[str, Any] | None = None,
        pnl_7days: dict[str, Any] | None = None,
    ) -> bool:
        if not page or page.is_closed():
            return False
        try:
            active_stakes = stakes or self._stakes
            if not self._installed or not await self._panels_present(page):
                await self.install(page, stakes=active_stakes or None)
            else:
                # Dam bao bridge con song (CDP / doi tab AE)
                await self.bind_callbacks(page)
            payload = build_overlay_payload(
                history,
                table_name,
                table_id,
                skip_tie,
                stakes=active_stakes,
                betting=betting,
                display_stats=display_stats,
                pattern_enabled=pattern_enabled if pattern_enabled is not None else self._pattern_enabled,
                pattern_lengths=pattern_lengths if pattern_lengths is not None else self._pattern_lengths,
                pattern_win_rates=pattern_win_rates,
                stats_scope=stats_scope,
                stake_steps=stake_steps,
                stake_steps_label=stake_steps_label,
                stake_steps_warn=stake_steps_warn,
                pnl_today=pnl_today,
                pnl_7days=pnl_7days,
            )
            result = await page.evaluate(UPDATE_SCRIPT, payload)
            if isinstance(result, dict) and result.get("needsInstall"):
                self._installed = False
                await self.install(page, stakes=active_stakes or None)
                await page.evaluate(UPDATE_SCRIPT, payload)
            return True
        except Exception as e:
            logger.debug("Cap nhat overlay: %s", e)
            self._installed = False
            return False

    async def remove(self, page: Page):
        try:
            await page.evaluate(
                """() => {
                  document.getElementById('toolbet-overlay')?.remove();
                  document.getElementById('toolbet-overlay-left')?.remove();
                  document.getElementById('toolbet-overlay-center')?.remove();
                  document.getElementById('toolbet-overlay-style')?.remove();
                }"""
            )
        except Exception:
            pass
        self._installed = False
