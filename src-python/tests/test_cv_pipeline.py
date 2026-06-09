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
    
    cap = None
    
    with patch("main.cv2.VideoCapture") as mock_vc:
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        mock_vc.return_value = mock_cap
        
        # Transition to FOCUS
        cap, output = main.execute_loop_tick(cap, "FOCUS")
        assert cap == mock_cap
        assert output == {"type": "status", "camera": "opened", "camera_index": 0}
        
        # Transition to BREAK
        cap, output = main.execute_loop_tick(cap, "BREAK")
        assert cap is None
        mock_cap.release.assert_called_once()
        assert output == {"type": "status", "camera": "released"}


def test_handle_command_change_camera():
    """
    Verifies that handle_command updates the thread-safe global camera index variable.
    """
    main.current_camera_index = 0
    command = {"action": "change_camera", "index": 2}
    main.handle_command(command)
    assert main.current_camera_index == 2


def test_camera_switching_in_tick():
    """
    Verifies that changing target_camera_index releases the old camera and opens the new one.
    """
    with patch("main.cv2.VideoCapture") as mock_vc:
        mock_cap_0 = MagicMock()
        mock_cap_0.isOpened.return_value = True
        
        mock_cap_2 = MagicMock()
        mock_cap_2.isOpened.return_value = True
        
        def side_effect(index):
            if index == 0:
                return mock_cap_0
            elif index == 2:
                return mock_cap_2
            return MagicMock()
            
        mock_vc.side_effect = side_effect
        
        # Initialize active camera index to 0
        main.active_camera_index = 0
        cap, output = main.execute_loop_tick(None, "FOCUS", 0)
        assert cap == mock_cap_0
        assert main.active_camera_index == 0
        assert output == {"type": "status", "camera": "opened", "camera_index": 0}
        
        # Switch to camera index 2
        cap, output = main.execute_loop_tick(cap, "FOCUS", 2)
        mock_cap_0.release.assert_called_once()
        assert cap == mock_cap_2
        assert main.active_camera_index == 2
        assert output == {"type": "status", "camera": "opened", "camera_index": 2}


def test_camera_source_env_override():
    """
    Verifies that execute_loop_tick respects FOCUS_SENTINEL_CAMERA_SRC env override,
    both for numeric inputs and string URLs.
    """
    import os
    with patch("main.cv2.VideoCapture") as mock_vc:
        mock_cap_url = MagicMock()
        mock_cap_url.isOpened.return_value = True
        
        mock_vc.return_value = mock_cap_url
        
        # Test with URL string
        with patch.dict(os.environ, {"FOCUS_SENTINEL_CAMERA_SRC": "http://localhost:5000/video_feed"}):
            main.active_camera_index = None
            cap, output = main.execute_loop_tick(None, "FOCUS", 0)
            mock_vc.assert_called_once_with("http://localhost:5000/video_feed")
            assert main.active_camera_index == "http://localhost:5000/video_feed"
            assert output == {"type": "status", "camera": "opened", "camera_index": 0}
            
        mock_vc.reset_mock()
        
        # Test with numeric string
        with patch.dict(os.environ, {"FOCUS_SENTINEL_CAMERA_SRC": "3"}):
            main.active_camera_index = None
            cap, output = main.execute_loop_tick(None, "FOCUS", 0)
            mock_vc.assert_called_once_with(3)
            assert main.active_camera_index == 3
            assert output == {"type": "status", "camera": "opened", "camera_index": 0}



