import requests
from concurrent.futures import ThreadPoolExecutor
from django.conf import settings
from django.utils import timezone

from .models import Message

RANK = {"Queued": 0, "Sent": 1, "Delivered": 2, "read": 3}


class ProviderError(Exception):
    def __init__(self, code, user_message, retryable):
        super().__init__(user_message)
        self.code = code
        self.user_message = user_message
        self.retryable = retryable


def call_provider(to, body):
    """Calls the provider. Returns its message ID or raises ProviderError."""
    try:
        response = requests.post(
            f"{settings.PROVIDER_URL}/v1/messages",
            json={"to": to, "body": body},
            timeout=5,
        )
    except requests.Timeout:
        raise ProviderError("TIMEOUT", "The messaging service took too long to respond. You can retry.", True)
    except requests.ConnectionError:
        raise ProviderError("UNAVAILABLE", "The messaging service is unavailable right now. Please try again later.", True)

    if response.status_code in (200, 202):
        return response.json()["id"]

    try:
        code = response.json().get("code", "")
    except ValueError:
        code = ""

    if code == "INVALID_RECIPIENT":
        raise ProviderError(code, "This phone number is not valid for WhatsApp.", False)
    if code == "RATE_LIMITED" or response.status_code == 429:
        raise ProviderError("RATE_LIMITED", "Too many messages were sent. Wait a moment and retry.", True)
    if code in ("TEMPORARY_FAILURE", "UNAVAILABLE") or response.status_code >= 500:
        raise ProviderError(code or "TEMPORARY_FAILURE", "The messaging service had a temporary problem. You can retry.", True)

    raise ProviderError("UNKNOWN", "The message could not be sent.", False)


def refresh_candidate_summary(candidate):
    """Table columns (last message date, status) come from the newest message."""
    latest = candidate.messages.order_by("-created_at").first()
    if latest:
        candidate.status = latest.status
        candidate.last_message = timezone.localtime(latest.created_at).strftime("%d-%m-%Y")
        candidate.save(update_fields=["status", "last_message"])


def deliver(message):
    """Sends one message. A failure is recorded on this message only."""
    try:
        message.provider_message_id = call_provider(message.candidate.mobile_number, message.text)
        message.status = "Sent"
        message.failure_reason = ""
        message.can_retry = False
    except ProviderError as error:
        message.status = "Failed"
        message.failure_reason = error.user_message
        message.can_retry = error.retryable
    message.save()
    refresh_candidate_summary(message.candidate)
    return message


def deliver_many(messages, max_workers=10):
    def send_to_provider(message):
        try:
            return message, call_provider(message.candidate.mobile_number, message.text), None
        except ProviderError as error:
            return message, None, error

    with ThreadPoolExecutor(max_workers=min(len(messages), max_workers)) as executor:
        outcomes = list(executor.map(send_to_provider, messages))

    delivered = []
    for message, provider_message_id, error in outcomes:
        if error:
            message.status = "Failed"
            message.failure_reason = error.user_message
            message.can_retry = error.retryable
        else:
            message.provider_message_id = provider_message_id
            message.status = "Sent"
            message.failure_reason = ""
            message.can_retry = False
        message.save()
        refresh_candidate_summary(message.candidate)
        delivered.append(message)

    return delivered


def deliver_next_queued_message():
    message = (
        Message.objects.select_related("candidate")
        .filter(status="Queued")
        .order_by("created_at")
        .first()
    )
    if message is None:
        return False

    deliver(message)
    return True


def apply_status_update(message, new_status, reason="", retryable=False):
    """Returns True if applied, False if ignored (duplicate or out of order)."""
    if message.status == "Failed":
        return False

    if new_status == "Failed":
        if message.status == "read":
            return False
        message.status = "Failed"
        message.failure_reason = reason or "The message could not be delivered."
        message.can_retry = retryable
    else:
        if RANK[new_status] <= RANK.get(message.status, 0):
            return False
        message.status = new_status

    message.save()
    refresh_candidate_summary(message.candidate)
    return True