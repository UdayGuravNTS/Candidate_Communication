import time
import uuid
import requests
from concurrent.futures import ThreadPoolExecutor
from django.conf import settings
from django.utils import timezone

from .models import Message

RANK = {"Queued": 0, "Scheduled": 0, "Sent": 1, "Delivered": 2, "read": 3}

PROVIDERS = {
    "Email": {
        "name": "Gmail SMTP Email Service",
        "channel": "Email",
        "description": "Secure Transactional Email Delivery (smtp.gmail.com:587)",
    },
}


class ProviderError(Exception):
    def __init__(self, code, user_message, retryable):
        super().__init__(user_message)
        self.code = code
        self.user_message = user_message
        self.retryable = retryable


def check_provider_health():
    """Checks the health of communication services and returns aggregated metrics."""
    status = "operational"
    is_down = False
    latency_ms = 45

    # Check provider service or simulated outage
    try:
        start_t = time.time()
        resp = requests.get(f"{settings.PROVIDER_URL}/health", timeout=3)
        latency_ms = int((time.time() - start_t) * 1000)
        if resp.status_code == 200:
            p_data = resp.json()
            if p_data.get("status") == "down":
                is_down = True
                status = "outage"
        else:
            is_down = True
            status = "degraded"
    except Exception:
        # If dummy server not running, default to operational for SMTP
        latency_ms = 35

    # Aggregated stats from Message database
    total_messages = Message.objects.count()
    sent_count = Message.objects.filter(status__in=["Sent", "Delivered", "read"]).count()
    delivered_count = Message.objects.filter(status__in=["Delivered", "read"]).count()
    read_count = Message.objects.filter(status="read").count()
    failed_count = Message.objects.filter(status="Failed").count()
    scheduled_count = Message.objects.filter(status="Scheduled").count()

    providers_list = [
        {
            "id": "email",
            "name": PROVIDERS["Email"]["name"],
            "channel": "Email",
            "status": "operational" if not is_down else "outage",
            "latencyMs": latency_ms if not is_down else 0,
            "description": PROVIDERS["Email"]["description"],
        },
    ]

    return {
        "status": status,
        "isDown": is_down,
        "summary": {
            "total": total_messages,
            "sent": sent_count,
            "delivered": delivered_count,
            "read": read_count,
            "failed": failed_count,
            "scheduled": scheduled_count,
        },
        "providers": providers_list,
        "systemMessage": (
            "All communication channels are operating normally."
            if not is_down
            else "Communication provider service is currently unavailable. Deliveries and retries are queued."
        ),
    }


def call_provider(to, body, channel="WhatsApp", email="", message_id=None, public_base_url=""):
    """Calls the appropriate communication provider."""

    if channel == "Email":
        # ── Real Email via Django SMTP (Gmail) ──────────────────────────────
        if not email or "@" not in email or "." not in email:
            raise ProviderError("INVALID_RECIPIENT", "Candidate has no valid email address.", False)

        from django.core.mail import send_mail, BadHeaderError
        from django.conf import settings as django_settings

        # Smart subject line based on candidate communication content
        subject = "Hunar AI — Candidate Communication"
        first_line = (body or "").strip().split("\n")[0].strip()
        if first_line.lower().startswith("subject:"):
            subject = first_line[8:].strip()
            lines = (body or "").strip().split("\n")
            body = "\n".join(lines[1:]).strip()
            plain_body = body
        elif "interview" in body.lower():
            subject = "Interview Update — Hunar AI Recruitment"
        elif "assessment" in body.lower() or "test link" in body.lower():
            subject = "Technical Assessment — Hunar AI"
        elif "offer" in body.lower():
            subject = "Job Offer Discussion — Hunar AI"
        elif "onboarding" in body.lower() or "document" in body.lower():
            subject = "Pre-Onboarding Document Verification — Hunar AI"
        elif "received" in body.lower() or "applying" in body.lower():
            subject = "Application Received — Hunar AI Talent Acquisition"
        elif "screening" in body.lower():
            subject = "Initial Screening Call — Hunar AI"
        else:
            subject = "Message from Hunar AI Recruiter"
        plain_body = body

        # Open tracking pixel and interactive acknowledgement link
        action_button = ""
        tracking_pixel = ""
        if message_id:
            api_base = (
                public_base_url
                or getattr(django_settings, 'PUBLIC_API_URL', '')
                or 'https://nest-compile-beef-donna.trycloudflare.com'
            ).rstrip('/')
            track_url = f"{api_base}/api/track/read/{message_id}/"
            tracking_pixel = f'<img src="{track_url}" width="1" height="1" style="display:none;width:1px;height:1px;border:0;" alt="" />'
            action_button = f"""
    <div style="margin-top:24px;padding:16px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;text-align:center;">
      <p style="font-size:13px;color:#475569;margin:0 0 10px;font-weight:500;">Please acknowledge receipt of this message:</p>
      <a href="{track_url}?redirect=true" target="_blank"
         style="display:inline-block;background:#4F46E5;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:6px;font-size:13px;font-weight:600;">
        ✓ Confirm &amp; Mark as Read
      </a>
    </div>"""

        # Simple HTML wrapper for a professional look
        html_body = f"""
<html>
<body style="font-family:Arial,sans-serif;color:#1a1a2e;max-width:600px;margin:auto;padding:24px;">
  <div style="background:linear-gradient(135deg,#6C63FF,#8B5CF6);padding:20px 24px;border-radius:10px 10px 0 0;">
    <h2 style="color:#ffffff;margin:0;font-size:18px;">Hunar AI — Recruiter Message</h2>
  </div>
  <div style="background:#f9f9fc;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
    <p style="font-size:15px;line-height:1.7;white-space:pre-wrap;color:#1e293b;">{body}</p>
    {action_button}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
    <p style="font-size:12px;color:#6b7280;margin:0;">
      This message was sent via the Hunar AI Candidate Communication Platform.
    </p>
    {tracking_pixel}
  </div>
</body>
</html>"""

        try:
            send_mail(
                subject=subject,
                message=plain_body,
                from_email=django_settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                html_message=html_body,
                fail_silently=False,
            )
            # Return a synthetic message ID for tracking
            return f"email_{uuid.uuid4().hex[:12]}"
        except BadHeaderError:
            raise ProviderError("INVALID_RECIPIENT", "Invalid email header detected. Cannot send.", False)
        except Exception as exc:
            err_str = str(exc).lower()
            if "authentication" in err_str or "username" in err_str or "password" in err_str:
                raise ProviderError(
                    "AUTH_FAILED",
                    "Email authentication failed. Please check EMAIL_HOST_USER and EMAIL_HOST_PASSWORD environment variables.",
                    False,
                )
            if "connect" in err_str or "timeout" in err_str or "network" in err_str:
                raise ProviderError(
                    "UNAVAILABLE",
                    "Could not connect to the email server. Please check your internet connection and try again.",
                    True,
                )
            raise ProviderError("UNKNOWN", f"Email could not be sent: {exc}", False)

    # ── WhatsApp / SMS — route through dummy provider ──────────────────────
    # First check if provider is down
    try:
        health_resp = requests.get(f"{settings.PROVIDER_URL}/health", timeout=2)
        if health_resp.status_code == 200 and health_resp.json().get("status") == "down":
            raise ProviderError("UNAVAILABLE", "The communication provider is currently unavailable. Please try again later.", True)
    except requests.RequestException:
        pass

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
        return response.json().get("id", f"msg_{uuid.uuid4().hex[:12]}")

    try:
        code = response.json().get("code", "")
    except ValueError:
        code = ""

    if code == "INVALID_RECIPIENT":
        raise ProviderError(code, f"Recipient contact information is not valid for {channel}.", False)
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


def deliver(message, public_base_url=""):
    """Sends one message. A failure is recorded on this message only."""
    try:
        message.provider_message_id = call_provider(
            message.candidate.mobile_number,
            message.text,
            channel=message.channel,
            email=message.candidate.email,
            message_id=message.id,
            public_base_url=public_base_url,
        )
        message.status = "Delivered" if message.channel == "Email" else "Sent"
        message.failure_reason = ""
        message.can_retry = False
    except ProviderError as error:
        message.status = "Failed"
        message.failure_reason = error.user_message
        message.can_retry = error.retryable
    message.save()
    refresh_candidate_summary(message.candidate)
    return message


def deliver_many(messages, max_workers=10, public_base_url=""):
    def send_to_provider(message):
        try:
            pid = call_provider(
                message.candidate.mobile_number,
                message.text,
                channel=message.channel,
                email=message.candidate.email,
                message_id=message.id,
                public_base_url=public_base_url,
            )
            return message, pid, None
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
            message.status = "Delivered" if message.channel == "Email" else "Sent"
            message.failure_reason = ""
            message.can_retry = False
        message.save()
        refresh_candidate_summary(message.candidate)
        delivered.append(message)

    return delivered


def process_scheduled_messages():
    """Finds messages whose scheduled_at has arrived and delivers them."""
    now = timezone.now()
    due_messages = list(
        Message.objects.select_related("candidate")
        .filter(status="Scheduled", scheduled_at__lte=now)
        .order_by("scheduled_at")[:50]
    )
    if not due_messages:
        return 0

    deliver_many(due_messages)
    return len(due_messages)


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
        if RANK.get(new_status, 0) <= RANK.get(message.status, 0):
            return False
        message.status = new_status

    message.save()
    refresh_candidate_summary(message.candidate)
    return True