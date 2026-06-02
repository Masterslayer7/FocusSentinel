import sys
import datetime

def log(message: str, level: str = "INFO"):
    """
    Logs messages strictly to stderr to ensure that standard output (stdout)
    remains completely clean and reserved for structured JSON telemetry streams.
    """
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sys.stderr.write(f"[{timestamp}] [{level}] {message}\n")
    sys.stderr.flush()
