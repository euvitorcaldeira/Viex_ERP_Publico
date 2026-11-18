"""Activity dates used by automatic employee attendance."""
from datetime import datetime, timedelta, timezone

SAO_PAULO = timezone(timedelta(hours=-3))


def employee_activity(state, employee):
    changes = []
    for event in state.get("audit", []):
        if event.get("entityId") != employee["id"]:
            continue
        before, after = event.get("before"), event.get("after")
        if not isinstance(before, dict) or not isinstance(after, dict):
            continue
        if type(before.get("active")) is not bool or type(after.get("active")) is not bool or before["active"] == after["active"]:
            continue
        try:
            timestamp = datetime.fromisoformat(event["at"].replace("Z", "+00:00"))
            local = timestamp if timestamp.tzinfo is None else timestamp.astimezone(SAO_PAULO)
            changes.append((local.isoformat(), local.date().isoformat(), before["active"], after["active"]))
        except (TypeError, ValueError, KeyError):
            continue
    changes.sort()

    def active_on(day):
        active = changes[0][2] if changes else employee.get("active", False)
        for _, changed_day, _, next_active in changes:
            if changed_day > day:
                break
            active = next_active
        return active

    return active_on
