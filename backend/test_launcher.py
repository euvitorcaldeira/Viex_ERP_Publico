import io
import json
import os
import unittest
from unittest.mock import patch

import VIEX


class ExistingServerTests(unittest.TestCase):
    def test_detects_an_existing_viex_server(self):
        payload = json.dumps({"setupRequired": False, "authenticated": False}).encode()
        with patch.dict(os.environ, {"VIEX_PORT": "9876"}), patch(
            "VIEX.urlopen", return_value=io.BytesIO(payload)
        ) as request:
            self.assertEqual(VIEX.existing_server_address(), "http://127.0.0.1:9876/")
        request.assert_called_once_with("http://127.0.0.1:9876/api/status", timeout=1)

    def test_returns_none_when_no_server_is_available(self):
        with patch("VIEX.urlopen", side_effect=OSError("offline")):
            self.assertIsNone(VIEX.existing_server_address())

    def test_second_launch_reuses_the_running_server(self):
        with patch.dict(os.environ, {"DALEX_OPEN_BROWSER": "1"}), patch(
            "VIEX.existing_server_address", return_value="http://127.0.0.1:8765/"
        ), patch("VIEX.webbrowser.open") as open_browser, patch(
            "VIEX.console_main"
        ) as console_main:
            self.assertEqual(VIEX.main(), 0)
        open_browser.assert_called_once_with("http://127.0.0.1:8765/")
        console_main.assert_not_called()


if __name__ == "__main__":
    unittest.main()
