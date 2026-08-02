from __future__ import annotations

import unittest

from src.ae_sexy_collector import _redact_ws_url


class WebSocketLogRedactionTests(unittest.TestCase):
    def test_removes_query_token_and_path_session(self) -> None:
        raw = (
            "wss://game.example/h54uk/;jsessionid=SECRET"
            "?token=VERY_SECRET&account=user"
        )

        redacted = _redact_ws_url(raw)

        self.assertEqual(redacted, "wss://game.example/h54uk/")
        self.assertNotIn("SECRET", redacted)
        self.assertNotIn("token", redacted)
        self.assertNotIn("account", redacted)

    def test_invalid_url_is_fully_redacted(self) -> None:
        self.assertEqual(_redact_ws_url("not-a-url"), "<redacted-ws>")


if __name__ == "__main__":
    unittest.main()
