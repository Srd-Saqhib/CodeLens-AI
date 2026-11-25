import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime


MAX_RETRIES = 2
INITIAL_BACKOFF_SECONDS = 1


def _status_code(error):
    response = getattr(error, "response", None)
    for value in (getattr(error, "code", None), getattr(error, "status_code", None),
                  getattr(response, "status_code", None)):
        try:
            if value is not None:
                return int(value)
        except (TypeError, ValueError):
            continue
    return None


def _parse_retry_delay(value):
    if isinstance(value, (int, float)):
        return max(0.0, float(value))
    if not isinstance(value, str):
        return None
    match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)s\s*", value)
    if match:
        return float(match.group(1))
    try:
        retry_at = parsedate_to_datetime(value)
        if retry_at.tzinfo is None:
            retry_at = retry_at.replace(tzinfo=timezone.utc)
        return max(0.0, (retry_at - datetime.now(timezone.utc)).total_seconds())
    except (TypeError, ValueError, OverflowError):
        return None


def _find_retry_delay(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if key.lower().replace("_", "") in ("retrydelay", "retryafter"):
                delay = _parse_retry_delay(item)
                if delay is not None:
                    return delay
        for item in value.values():
            delay = _find_retry_delay(item)
            if delay is not None:
                return delay
    elif isinstance(value, (list, tuple)):
        for item in value:
            delay = _find_retry_delay(item)
            if delay is not None:
                return delay
    return None


def _retry_delay(error):
    delay = _find_retry_delay(getattr(error, "details", None))
    if delay is not None:
        return delay
    response = getattr(error, "response", None)
    headers = getattr(response, "headers", None)
    if headers:
        return _parse_retry_delay(headers.get("Retry-After"))
    return None


def call_with_transient_error_retry(request, *args, **kwargs):
    for attempt in range(MAX_RETRIES + 1):
        try:
            return request(*args, **kwargs)
        except Exception as error:
            if _status_code(error) not in (429, 503) or attempt == MAX_RETRIES:
                raise
            backoff = INITIAL_BACKOFF_SECONDS * (2 ** attempt)
            time.sleep(max(backoff, _retry_delay(error) or 0.0))
