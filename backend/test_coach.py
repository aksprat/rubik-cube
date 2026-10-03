import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from app.main import ChatMessage, ChatRequest, SolveContext, _build_context_message, coach_chat


class CoachTests(unittest.TestCase):
    def test_context_tracks_progress_and_orientation(self):
        context = _build_context_message(SolveContext(
            facelet_string="starting-state", solution_moves=["R", "U2"],
            completed_moves=1, front_color="blue", top_color="white",
        ))
        self.assertIn("starting cube state", context)
        self.assertIn("completed 1", context)
        self.assertIn("Next move: U2", context)
        self.assertIn("blue center in front", context)

    @patch.dict(os.environ, {"DO_INFERENCE_API_KEY": "test-key"}, clear=True)
    @patch("app.main.OpenAI")
    def test_default_model_and_explicit_override(self, client_class):
        completion = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="Turn the right face."))])
        client_class.return_value.chat.completions.create.return_value = completion
        request = ChatRequest(messages=[ChatMessage(role="user", content="Explain R")])
        self.assertEqual(coach_chat(request).reply, "Turn the right face.")
        self.assertEqual(client_class.call_args.kwargs["base_url"], "https://inference.do-ai.run/v1/")
        self.assertEqual(client_class.return_value.chat.completions.create.call_args.kwargs["model"], "anthropic-claude-haiku-4.5")
        with patch.dict(os.environ, {"DO_CHAT_MODEL": "llama3.3-70b-instruct"}):
            coach_chat(request)
        self.assertEqual(client_class.return_value.chat.completions.create.call_args.kwargs["model"], "llama3.3-70b-instruct")

    @patch.dict(os.environ, {"DO_INFERENCE_API_KEY": "test-key"}, clear=True)
    @patch("app.main.OpenAI")
    def test_empty_response_is_a_gateway_error(self, client_class):
        client_class.return_value.chat.completions.create.return_value = SimpleNamespace(choices=[])
        with self.assertRaises(HTTPException) as raised:
            coach_chat(ChatRequest(messages=[]))
        self.assertEqual(raised.exception.status_code, 502)

    @patch.dict(os.environ, {"DO_INFERENCE_API_KEY": "test-key"}, clear=True)
    @patch("app.main.OpenAI")
    def test_upstream_errors_do_not_leak_details(self, client_class):
        client_class.return_value.chat.completions.create.side_effect = RuntimeError("sensitive-upstream-details")
        with self.assertLogs("app.main", level="ERROR") as logs:
            with self.assertRaises(HTTPException) as raised:
                coach_chat(ChatRequest(messages=[]))
        self.assertEqual(raised.exception.status_code, 502)
        self.assertNotIn("sensitive", raised.exception.detail)
        self.assertNotIn("sensitive", " ".join(logs.output))

    @patch.dict(os.environ, {"DO_INFERENCE_API_KEY": "test-key"}, clear=True)
    @patch("app.main.OpenAI")
    def test_provider_status_is_logged_without_request_or_credentials(self, client_class):
        error = RuntimeError("Private provider message test-key")
        error.status_code = 403
        error.code = "model_not_allowed"
        error.param = "model"
        client_class.return_value.chat.completions.create.side_effect = error
        with self.assertLogs("app.main", level="ERROR") as logs:
            with self.assertRaises(HTTPException):
                coach_chat(ChatRequest(messages=[ChatMessage(role="user", content="private-question")]))
        output = " ".join(logs.output)
        self.assertIn("status=403 code=model_not_allowed param=model", output)
        for private_value in ["test-key", "private-question", "Private provider message"]:
            self.assertNotIn(private_value, output)


if __name__ == "__main__":
    unittest.main()
