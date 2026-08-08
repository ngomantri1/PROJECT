from __future__ import annotations

def reconcile_events(provider_results):
    """Deduplicate same-family evidence; flag material cross-family conflicts."""
    unique = {}
    conflicts = []
    by_identity = {}
    for result in provider_results:
        source = result.get("source", {})
        family = source.get("source_family") or source.get("provider", "UNKNOWN")
        for event in result.get("events", []):
            identity = (event.get("event_date"), event.get("allocation"), event.get("event_type"))
            amount = str(event.get("token_amount"))
            by_identity.setdefault(identity, []).append((family, amount, event))
    for identity, rows in by_identity.items():
        amounts = {amount for _family, amount, _event in rows}
        families = {family for family, _amount, _event in rows}
        if len(amounts) > 1 and len(families) > 1:
            conflicts.append({"identity": identity, "providers": sorted(families), "field": "token_amount"})
            continue
        unique[(*identity, next(iter(amounts)))] = rows[0][2]
    return {"events": list(unique.values()), "conflicts": conflicts, "status": "CONFLICT" if conflicts else "PASS"}
