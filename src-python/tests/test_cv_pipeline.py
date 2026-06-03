import sys
import json
import pytest
from unittest.mock import patch, MagicMock

# Import the modules under test
from utils.logger import log
import main

def test_log_output_exclusively_to_stderr(capsys):
    """
    Verifies that calling log() writes strictly to stderr
    and does not leak any characters to stdout (which would corrupt NDJSON).
    """
    log("This is a test message", "DEBUG")
    captured = capsys.readouterr()
    
    assert "[DEBUG] This is a test message\n" in captured.err
    assert captured.out == ""  # stdout must be completely untouched

def test_send_response(capsys):
    """
    Verifies that send_response serializes a dictionary into a JSON line
    and flushes it to stdout.
    """
    test_payload = {"status": "ok", "count": 42}
    main.send_response(test_payload)
    
    captured = capsys.readouterr()
    expected_output = json.dumps(test_payload) + "\n"
    assert captured.out == expected_output
    assert captured.err == ""

def test_handle_command_ping(capsys):
    """
    Verifies that receiving a 'ping' command triggers a 'pong' payload response on stdout.
    """
    command = {"action": "ping"}
    main.handle_command(command)
    
    captured = capsys.readouterr()
    expected_output = json.dumps({"type": "pong"}) + "\n"
    assert captured.out == expected_output

def test_handle_command_change_state(capsys):
    """
    Verifies that a state transition request is received and logged.
    """
    command = {"action": "change_state", "state": "FOCUS"}
    
    with patch("main.log") as mock_log:
        main.handle_command(command)
        mock_log.assert_any_call("State transition request received: FOCUS", "INFO")

def test_handle_command_exit():
    """
    Verifies that the 'exit' command triggers an immediate os._exit(0).
    """
    command = {"action": "exit"}
    
    with patch("main.os._exit") as mock_exit:
        main.handle_command(command)
        mock_exit.assert_called_once_with(0)
