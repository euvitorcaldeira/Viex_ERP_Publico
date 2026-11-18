import unittest
from backend.employee_activity import employee_activity


class EmployeeActivityTests(unittest.TestCase):
    def test_pause_resume_and_sao_paulo_dates(self):
        employee = {"id": "e", "active": True}
        state = {"audit": [
            {"entityId": "e", "at": "2026-11-18T01:00:00Z", "before": {"active": True}, "after": {"active": False}},
            {"entityId": "e", "at": "2026-11-20T15:00:00Z", "before": {"active": False}, "after": {"active": True}},
        ]}
        active_on = employee_activity(state, employee)
        self.assertTrue(active_on("2026-11-16"))
        self.assertFalse(active_on("2026-11-17"))
        self.assertFalse(active_on("2026-11-19"))
        self.assertTrue(active_on("2026-11-20"))

    def test_legacy_paused_employee_never_generates_automatic_attendance(self):
        self.assertFalse(employee_activity({}, {"id": "e", "active": False})("2026-11-18"))
