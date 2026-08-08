from datetime import datetime, timedelta
from decimal import Decimal

def linear_overlap(total_tokens, start, end, window_start, window_end):
    """Return exact UTC-duration overlap for a linear vesting interval."""
    full_start, full_end = start, end
    overlap_start, overlap_end = max(full_start, window_start), min(full_end, window_end)
    if overlap_end <= overlap_start or full_end <= full_start:
        return 0.0
    return Decimal(str(total_tokens)) * Decimal(str((overlap_end - overlap_start).total_seconds())) / Decimal(str((full_end - full_start).total_seconds()))

def calculate_windows(events, schedules, now):
    """Calculate future unlocks without treating uncovered time as zero."""
    result = {}
    for days in (7, 30, 90):
        window_end = now + timedelta(days=days)
        tokens = sum((Decimal(str(e["token_amount"])) for e in events if now < e["event_date"] <= window_end), Decimal("0"))
        for schedule in schedules:
            start = schedule.get("start_date")
            end = schedule.get("end_date")
            if start and end:
                tokens += linear_overlap(schedule["total_tokens"], start, end, now, window_end)
        result[str(days)] = tokens
    return result
