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

def test_state_transition_updates_global_variable():
    """
    Verifies that handle_command updates the thread-safe global state variable.
    """
    # Reset state to BREAK
    main.current_state = "BREAK"
    
    command = {"action": "change_state", "state": "FOCUS"}
    main.handle_command(command)
    
    assert main.current_state == "FOCUS"

def test_camera_state_activation_deactivation(capsys):
    """
    Verifies that shifting between FOCUS and BREAK states toggles the camera status
    and sends standard status updates.
    """
    # Reset/Mock state
    main.current_state = "FOCUS"
    
    # Run a single tick/iteration of the state loop logic
    # In mock context, we want to test main's step logic in isolation.
    # To facilitate testing, we can define or test a step function,
    # or simulate the loop tick block. Let's test the state check directly:
    cap = None
    
    # Transition to FOCUS
    cap, output = main.execute_loop_tick(cap, "FOCUS")
    assert cap is not None # Camera should be initialized (simulated)
    assert output == {"type": "status", "camera": "opened"}
    
    # Transition to BREAK
    cap, output = main.execute_loop_tick(cap, "BREAK")
    assert cap is None # Camera should be released
    assert output == {"type": "status", "camera": "released"}

