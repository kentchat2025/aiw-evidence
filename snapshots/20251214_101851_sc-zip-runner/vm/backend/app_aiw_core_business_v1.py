"""
app_aiw_core_business_v1.py
AI Wealth - Core Business Logic v1
----------------------------------
This module reads the AIW validation report JSON and exposes a clean,
SAP-style "business table" for the FounderConsole UI.

Endpoint (via app_fastapi.py):
  GET /api/aiwealth/core-business-v1

Returns:
  {
    "status": "OK",
    "meta": {...},
    "rows": [ {...}, {...}, ... ]
  }
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional, Literal, Any, Dict
import json
import datetime as dt
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Router is still defined for future use, but URL is owned by app_fastapi.py
router = APIRouter(tags=["aiwealth-core-business-v1"])

# IMPORTANT: this should match where your control-run script copies the file
AIW_VALIDATION_PATH = Path("/opt/founderconsole/runtime/aiw_validation_report.json")


# ===== Pydantic models =====

class CoreBusinessRow(BaseModel):
    # Identification
    symbol: str
    name: Optional[str] = None
    isin: Optional[str] = None

    # Market classification
    segment: Optional[str] = None   # EQ, F&O, ETF, MF, INDEX, SME, etc.
    exchange: Optional[str] = None  # NSE, BSE, etc.
    profile: Optional[str] = None   # DEFAULT_SIM, etc.

    # Trade direction
    direction: Optional[Literal["BUY", "SELL", "HEDGE", "NA"]] = "NA"

    # Position sizing
    quantity: Optional[float] = None
    capital_required: Optional[float] = None
    capital_pct: Optional[float] = None

    # Prices & P/L expectations
    entry_price: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss_price: Optional[float] = None
    expected_return_pct: Optional[float] = None  # (target-entry)/entry * 100
    downside_risk_pct: Optional[float] = None    # (entry-SL)/entry * 100
    rr_ratio: Optional[float] = None             # reward:risk

    # Risk / confidence
    risk_bucket: Optional[
        Literal["CONSERVATIVE", "BALANCED", "AGGRESSIVE", "ULTRA_AGGRESSIVE", "UNKNOWN"]
    ] = "UNKNOWN"
    confidence_score: Optional[float] = None     # 0–100

    # AI fields
    ai_recommendation: Optional[str] = None      # BUY / SELL / HOLD / AVOID / HEDGE
    ai_reason: Optional[str] = None
    ai_signal_id: Optional[str] = None

    # Approval state
    show_for_manual_approval: bool = True
    auto_approved: bool = False
    approval_status: Optional[Literal["PENDING", "APPROVED", "REJECTED", "HOLD"]] = "PENDING"

    # Execution tracking placeholders (future wiring)
    executed_broker: Optional[str] = None
    executed_order_id: Optional[str] = None
    executed_avg_price: Optional[float] = None
    executed_qty: Optional[float] = None
    executed_value: Optional[float] = None

    # Extra raw info if needed
    raw: Optional[Dict[str, Any]] = None


class CoreBusinessMeta(BaseModel):
    run_date: str
    env: Optional[str] = None
    mode: Optional[str] = None
    total_universe: Optional[int] = None
    total_candidates: Optional[int] = None
    creamy_layer_count: Optional[int] = None
    profiles: Optional[List[str]] = None
    backend_url: Optional[str] = None


class CoreBusinessResponse(BaseModel):
    status: str
    meta: CoreBusinessMeta
    rows: List[CoreBusinessRow]


# ===== Internal helpers =====

def _load_validation_report() -> Dict[str, Any]:
    if not AIW_VALIDATION_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail=f"aiw_validation_report.json not found at {AIW_VALIDATION_PATH}",
        )

    try:
        with AIW_VALIDATION_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Invalid JSON in validation report: {exc}")


def _safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _compute_rr_ratio(entry: Optional[float], target: Optional[float], sl: Optional[float]) -> Optional[float]:
    if not entry or not target or not sl:
        return None
    try:
        reward = target - entry
        risk = entry - sl
        if risk <= 0:
            return None
        return reward / risk
    except Exception:
        return None


def _normalize_direction(direction: Any) -> str:
    if not direction:
        return "NA"
    d = str(direction).upper().strip()
    if d in {"BUY", "LONG"}:
        return "BUY"
    if d in {"SELL", "SHORT"}:
        return "SELL"
    if d in {"HEDGE"}:
        return "HEDGE"
    return "NA"


def _normalize_risk_bucket(bucket: Any) -> str:
    if not bucket:
        return "UNKNOWN"
    b = str(bucket).upper().strip()
    if b in {"CONSERVATIVE", "BALANCED", "AGGRESSIVE", "ULTRA_AGGRESSIVE"}:
        return b
    return "UNKNOWN"


def _infer_risk_bucket_from_reason(reason: Optional[str]) -> str:
    """
    If explicit risk_bucket is missing, infer from AI reason text like:
      'Risk bucket: BALANCED.' or 'Risk bucket: CONSERVATIVE.'
    """
    if not reason:
        return "UNKNOWN"

    m = re.search(r"Risk bucket:\s*([A-Za-z_]+)", reason)
    if not m:
        return "UNKNOWN"
    candidate = m.group(1).upper().strip()
    if candidate in {"CONSERVATIVE", "BALANCED", "AGGRESSIVE", "ULTRA_AGGRESSIVE"}:
        return candidate
    return "UNKNOWN"


def _bool_from_any(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    if s in {"1", "true", "yes", "y"}:
        return True
    if s in {"0", "false", "no", "n"}:
        return False
    return default


def _build_row_from_trade(trade: Dict[str, Any]) -> CoreBusinessRow:
    # Basic identifiers
    symbol = str(trade.get("symbol") or trade.get("ticker") or "").strip()
    if not symbol:
        # Last fallback – we *must* have a symbol; if missing, this row will be dropped by caller
        raise ValueError("Missing symbol in trade row")

    name = trade.get("name") or trade.get("company_name") or None
    isin = trade.get("isin") or None

    segment = trade.get("segment") or trade.get("segment_code") or None
    exchange = trade.get("exchange") or trade.get("exchange_code") or None
    profile = trade.get("profile") or trade.get("profile_id") or None

    direction = _normalize_direction(trade.get("direction") or trade.get("side"))

    quantity = _safe_float(trade.get("qty") or trade.get("quantity"))
    capital_required = _safe_float(
        trade.get("capital_required") or trade.get("capital") or trade.get("order_value")
    )
    capital_pct = _safe_float(trade.get("capital_pct") or trade.get("capital_percent"))

    entry_price = _safe_float(trade.get("entry_price") or trade.get("entry"))
    target_price = _safe_float(trade.get("target_price") or trade.get("target"))
    stop_loss_price = _safe_float(trade.get("stop_loss_price") or trade.get("sl") or trade.get("stop_loss"))

    # Expected % and downside % – compute if missing
    expected_return_pct = _safe_float(
        trade.get("expected_return_pct") or trade.get("expected_pct") or trade.get("exp_pct")
    )
    if expected_return_pct is None and entry_price and target_price:
        try:
            expected_return_pct = (target_price - entry_price) / entry_price * 100.0
        except Exception:
            expected_return_pct = None

    downside_risk_pct = _safe_float(
        trade.get("downside_risk_pct") or trade.get("downside_pct") or trade.get("risk_pct")
    )
    if downside_risk_pct is None and entry_price and stop_loss_price:
        try:
            downside_risk_pct = (entry_price - stop_loss_price) / entry_price * 100.0
        except Exception:
            downside_risk_pct = None

    rr_ratio = _safe_float(trade.get("rr_ratio") or trade.get("reward_risk"))
    if rr_ratio is None:
        rr_ratio = _compute_rr_ratio(entry_price, target_price, stop_loss_price)

    ai_reason = trade.get("ai_reason") or trade.get("reason") or trade.get("comment") or None

    # Risk bucket – prefer explicit field, otherwise infer from reason text
    risk_bucket = _normalize_risk_bucket(trade.get("risk_bucket"))
    if risk_bucket == "UNKNOWN":
        inferred = _infer_risk_bucket_from_reason(ai_reason)
        risk_bucket = inferred

    confidence_score = _safe_float(trade.get("confidence") or trade.get("confidence_score"))

    ai_recommendation = (
        trade.get("ai_recommendation")
        or trade.get("recommendation")
        or trade.get("ai_action")
        or None
    )
    ai_signal_id = (
        trade.get("signal_id")
        or trade.get("id")
        or trade.get("trade_id")
        or None
    )

    show_for_manual_approval = _bool_from_any(
        trade.get("show_for_manual_approval"),
        default=True,
    )
    auto_approved = _bool_from_any(trade.get("auto_approved"), default=False)

    approval_status = trade.get("approval_status") or "PENDING"
    if isinstance(approval_status, str):
        s = approval_status.upper()
        if s not in {"PENDING", "APPROVED", "REJECTED", "HOLD"}:
            approval_status = "PENDING"
        else:
            approval_status = s
    else:
        approval_status = "PENDING"

    executed_broker = trade.get("executed_broker") or trade.get("broker") or None
    executed_order_id = trade.get("executed_order_id") or None
    executed_avg_price = _safe_float(trade.get("executed_avg_price"))
    executed_qty = _safe_float(trade.get("executed_qty"))
    executed_value = _safe_float(trade.get("executed_value"))

    return CoreBusinessRow(
        symbol=symbol,
        name=name,
        isin=isin,
        segment=segment,
        exchange=exchange,
        profile=profile,
        direction=direction,
        quantity=quantity,
        capital_required=capital_required,
        capital_pct=capital_pct,
        entry_price=entry_price,
        target_price=target_price,
        stop_loss_price=stop_loss_price,
        expected_return_pct=expected_return_pct,
        downside_risk_pct=downside_risk_pct,
        rr_ratio=rr_ratio,
        risk_bucket=risk_bucket,
        confidence_score=confidence_score,
        ai_recommendation=ai_recommendation,
        ai_reason=ai_reason,
        ai_signal_id=ai_signal_id,
        show_for_manual_approval=show_for_manual_approval,
        auto_approved=auto_approved,
        approval_status=approval_status,
        executed_broker=executed_broker,
        executed_order_id=executed_order_id,
        executed_avg_price=executed_avg_price,
        executed_qty=executed_qty,
        executed_value=executed_value,
        raw=trade,  # keep raw for debugging/traceability
    )


def _extract_trades(report: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Support multiple shapes for the report.
    """
    if "proposed_trades" in report and isinstance(report["proposed_trades"], list):
        return report["proposed_trades"]

    if "trades" in report and isinstance(report["trades"], list):
        return report["trades"]

    if "signals" in report and isinstance(report["signals"], list):
        # Some earlier versions might have used 'signals' for actual trades
        return report["signals"]

    # Fallback
    return []


def _build_meta(report: Dict[str, Any]) -> CoreBusinessMeta:
    # Try to align with what /api/aiwealth/validation already returns
    summary = report.get("summary", {})
    run_date = (
        summary.get("run_date")
        or report.get("run_date")
        or dt.date.today().isoformat()
    )

    env = summary.get("env") or report.get("env")
    mode = report.get("mode") or summary.get("mode")

    total_universe = summary.get("total_universe")
    total_candidates = summary.get("total_candidates")
    creamy_layer_count = summary.get("creamy_layer_count")
    profiles = summary.get("profiles") or report.get("profiles")

    backend_url = report.get("aiwealth_backend_url") or summary.get("aiwealth_backend_url")

    return CoreBusinessMeta(
        run_date=str(run_date),
        env=env,
        mode=mode,
        total_universe=total_universe,
        total_candidates=total_candidates,
        creamy_layer_count=creamy_layer_count,
        profiles=profiles,
        backend_url=backend_url,
    )


# ===== Public entrypoint used by app_fastapi.py =====

def get_core_business_v1() -> CoreBusinessResponse:
    """
    Main backend function for FounderConsole AI Wealth Core Business table.
    Reads the latest validation report and emits a clean {meta, rows} structure.
    """
    report = _load_validation_report()
    meta = _build_meta(report)

    raw_trades = _extract_trades(report)
    rows: List[CoreBusinessRow] = []

    for trade in raw_trades:
        try:
            row = _build_row_from_trade(trade)
        except ValueError:
            # Skip rows that do not even have a symbol
            continue
        rows.append(row)

    return CoreBusinessResponse(
        status="OK",
        meta=meta,
        rows=rows,
    )

