from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import APIException

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .messaging import (
    apply_status_update,
    check_provider_health,
    deliver,
    deliver_many,
    process_scheduled_messages,
    refresh_candidate_summary,
)
from .models import Candidate, Message, MessageTemplate, ProviderEvent
from django.db.models import Q
import json
import random
import string
import re
import requests

# Fixed prefix for every candidate ID
ID_PREFIX = "A1B2C"

def build_candidate_id():
    existing_ids = Candidate.objects.filter(id__startswith=ID_PREFIX).values_list('id', flat=True)
    numbers = []
    for existing_id in existing_ids:
        number_part = existing_id[len(ID_PREFIX):]
        if number_part.isdigit():
            numbers.append(int(number_part))
    next_number = max(numbers, default=0) + 1
    return f"{ID_PREFIX}{next_number}"


# ---------- helpers: turn database objects into dictionaries ----------
def message_to_dict(m):
    local = timezone.localtime(m.created_at)
    time_part = local.strftime("%I:%M %p").lstrip("0")
    scheduled_str = ""
    if m.scheduled_at:
        sch_local = timezone.localtime(m.scheduled_at)
        scheduled_str = f"{sch_local.strftime('%d-%m-%Y')}, {sch_local.strftime('%I:%M %p').lstrip('0')}"
    return {
        "id": str(m.id),
        "channel": m.channel,
        "provider": m.provider,
        "text": m.text,
        "status": m.status,
        "timestamp": f"{local.strftime('%d-%m-%Y')}, {time_part}",
        "scheduledAt": scheduled_str,
        "failureReason": m.failure_reason,
        "canRetry": m.can_retry,
        "retryCount": m.retry_count,
    }


def candidate_to_dict(candidate):
    messages = sorted(candidate.messages.all(), key=lambda m: m.created_at, reverse=True)
    return {
        "id": candidate.id,
        "fullName": candidate.full_name,
        "mobileNumber": candidate.mobile_number,
        "email": candidate.email,
        "lastMessage": candidate.last_message,
        "status": candidate.status,
        "role": candidate.role,
        "notes": candidate.notes,
        "history": [message_to_dict(m) for m in messages],
    }


def interpolate_candidate_vars(template_text, candidate):
    """Personalizes template placeholders with candidate specific information."""
    if not template_text:
        return ""
    full_name = candidate.full_name or "Candidate"
    first_name = full_name.split()[0] if full_name else "Candidate"
    role = candidate.role or "Candidate"
    email = candidate.email or ""
    phone = candidate.mobile_number or ""
    cid = candidate.id or ""

    mapping = {
        "{candidate_name}": full_name,
        "{candidate}": full_name,
        "{name}": full_name,
        "{first_name}": first_name,
        "{role}": role,
        "{job_role}": role,
        "{position}": role,
        "{email}": email,
        "{phone}": phone,
        "{mobile}": phone,
        "{candidate_id}": cid,
        "{id}": cid,
    }

    result = template_text
    for placeholder, val in mapping.items():
        pattern = re.compile(re.escape(placeholder), re.IGNORECASE)
        result = pattern.sub(str(val), result)
    return result


@api_view(['POST'])
@permission_classes([AllowAny])
def add_candidate(request):
    data = request.data
    full_name = data.get("fullName")
    mobile_number = data.get("mobileNumber")
    email = data.get("email")

    new_id = build_candidate_id()

    candidate = Candidate.objects.create(
        id=new_id,
        full_name=full_name,
        mobile_number=mobile_number,
        email=email,
    )

    return Response(
        {
            "status": True,
            "message": "Candidate created successfully",
            "data": candidate_to_dict(candidate),
        },
        status=status.HTTP_201_CREATED
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def candidate_list(request):
    try:
        # Check and deliver any scheduled messages that are now due
        process_scheduled_messages()

        status_filter = request.GET.get('status', 'all')
        search = request.GET.get('search', '').strip()

        candidates = Candidate.objects.prefetch_related("messages")

        # Status filter
        if status_filter.lower() != 'all':
            candidates = candidates.filter(status__iexact=status_filter)

        # Search
        if search:
            candidates = candidates.filter(
                Q(full_name__icontains=search) |
                Q(email__icontains=search) |
                Q(mobile_number__icontains=search) |
                Q(id__icontains=search) |
                Q(status__icontains=search) |
                Q(last_message__icontains=search)
            )

        # Latest first
        candidates = candidates.order_by('-created_at')

        # Pagination
        try:
            page_size = int(request.GET.get('page_size', 10))
        except ValueError:
            page_size = 10
        page_size = max(1, min(page_size, 100))

        paginator = PageNumberPagination()
        paginator.page_size = page_size
        paginated_qs = paginator.paginate_queryset(candidates, request)

        data = [candidate_to_dict(candidate) for candidate in paginated_qs]
        return paginator.get_paginated_response(data)

    except APIException:
        raise
    except Exception as e:
        return Response(
            {"error": "Something went wrong", "details": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@permission_classes([AllowAny])
def delete_candidate(request, candidate_id):
    try:
        candidate = Candidate.objects.get(id=candidate_id)
    except Candidate.DoesNotExist:
        return Response(
            {"status": False, "message": "Candidate not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    candidate.delete()
    return Response(
        {"status": True, "message": "Candidate deleted successfully"},
        status=status.HTTP_200_OK
    )


# ---------- send message (single or bulk, immediate or scheduled) ----------
@api_view(['POST'])
@permission_classes([AllowAny])
def send_message(request):
    data = request.data
    channel = data.get("channel", "Email")
    provider_name = data.get("provider", "Gmail SMTP")
    raw_text = data.get("message", "")
    candidate_ids = data.get("candidateIds", [])
    is_scheduled = bool(data.get("isScheduled", False))
    scheduled_date_str = data.get("scheduledDate")

    if not isinstance(raw_text, str) or not raw_text.strip():
        return Response({"message": "A non-empty message is required."}, status=400)
    if not isinstance(candidate_ids, list) or not candidate_ids:
        return Response({"message": "Select at least one candidate."}, status=400)

    candidate_ids = list(dict.fromkeys(candidate_ids))
    candidates = list(Candidate.objects.filter(id__in=candidate_ids))
    if len(candidates) != len(candidate_ids):
        return Response({"message": "One or more selected candidates could not be found."}, status=404)

    # Process due scheduled messages before dispatching
    process_scheduled_messages()

    # SCHEDULED MESSAGES
    if is_scheduled and scheduled_date_str:
        scheduled_dt = parse_datetime(scheduled_date_str)
        if not scheduled_dt:
            try:
                from datetime import datetime
                scheduled_dt = timezone.make_aware(
                    datetime.fromisoformat(scheduled_date_str.replace("Z", "+00:00"))
                )
            except Exception:
                scheduled_dt = timezone.now() + timezone.timedelta(hours=1)

        messages = []
        results = []
        for candidate in candidates:
            personalized_text = interpolate_candidate_vars(raw_text.strip(), candidate)
            msg = Message.objects.create(
                candidate=candidate,
                channel=channel,
                provider=provider_name or f"{channel} Provider",
                text=personalized_text,
                status="Scheduled",
                scheduled_at=scheduled_dt,
            )
            candidate.status = "Scheduled"
            candidate.last_message = timezone.localtime(scheduled_dt).strftime("%d-%m-%Y")
            candidate.save(update_fields=["status", "last_message"])
            messages.append(msg)
            results.append({
                "candidateId": candidate.id,
                "fullName": candidate.full_name,
                "messageId": str(msg.id),
                "status": "Scheduled",
                "failureReason": "",
                "canRetry": False,
            })

        refreshed = Candidate.objects.prefetch_related("messages").filter(id__in=candidate_ids)
        local_time_str = timezone.localtime(scheduled_dt).strftime("%d-%m-%Y at %I:%M %p")
        return Response({
            "status": True,
            "message": f"Message scheduled for {len(results)} candidate{'s' if len(results) > 1 else ''} on {local_time_str}.",
            "summary": {
                "total": len(results),
                "sent": 0,
                "scheduled": len(results),
                "failed": 0,
            },
            "results": results,
            "data": [candidate_to_dict(c) for c in refreshed],
        }, status=200)

    # IMMEDIATE DELIVERY
    messages = []
    for candidate in candidates:
        personalized_text = interpolate_candidate_vars(raw_text.strip(), candidate)
        msg = Message.objects.create(
            candidate=candidate,
            channel=channel,
            provider=provider_name or f"{channel} Provider",
            text=personalized_text,
            status="Sending",
        )
        messages.append(msg)

    delivered_messages = deliver_many(messages)

    results = [{
            "candidateId": message.candidate_id,
            "fullName": message.candidate.full_name,
            "messageId": str(message.id),
            "status": message.status,
            "failureReason": message.failure_reason,
            "canRetry": message.can_retry,
        }
        for message in delivered_messages
    ]
    failed = sum(1 for result in results if result["status"] == "Failed")
    sent = len(results) - failed

    refreshed = Candidate.objects.prefetch_related("messages").filter(id__in=candidate_ids)

    return Response({
        "status": failed == 0,
        "message": f"{sent} sent, {failed} failed",
        "summary": {
            "total": len(results),
            "sent": sent,
            "scheduled": 0,
            "failed": failed,
        },
        "results": results,
        "data": [candidate_to_dict(c) for c in refreshed],
    }, status=200)


# ---------- webhook: the provider calls this with status updates ----------
STATUS_MAP = {"delivered": "Delivered", "read": "read", "failed": "Failed"}

@api_view(['POST'])
@permission_classes([AllowAny])
def provider_webhook(request):
    if request.headers.get("X-Provider-Secret") != settings.PROVIDER_WEBHOOK_SECRET:
        return Response({"message": "Unauthorized"}, status=401)

    event_id = request.data.get("eventId")
    provider_id = request.data.get("messageId")
    new_status = STATUS_MAP.get(request.data.get("status"))
    if not event_id or not provider_id or not new_status:
        return Response({"message": "Invalid event"}, status=400)

    with transaction.atomic():
        message = Message.objects.select_for_update().filter(provider_message_id=provider_id).first()
        if not message:
            return Response({"message": "Unknown message"}, status=404)

        _, created = ProviderEvent.objects.get_or_create(event_id=event_id)
        if not created:
            return Response({"message": "Duplicate event ignored"}, status=200)

        applied = apply_status_update(
            message,
            new_status,
            reason=request.data.get("reason") or "",
            retryable=bool(request.data.get("retryable")),
        )

    return Response({"message": "Updated" if applied else "Ignored"}, status=200)


# ---------- retry a failed message ----------
@api_view(['POST'])
@permission_classes([AllowAny])
def retry_message(request, message_id):
    message = get_object_or_404(Message, id=message_id)
    candidate = Candidate.objects.prefetch_related("messages").get(id=message.candidate_id)

    if message.status != "Failed":
        return Response({
            "status": False,
            "message": "Only failed messages can be retried.",
            "data": candidate_to_dict(candidate)
        }, status=400)

    if not message.can_retry:
        return Response({
            "status": False,
            "message": f"This failure is permanent ({message.failure_reason or 'Recipient unavailable'}). The message cannot be retried.",
            "data": candidate_to_dict(candidate)
        }, status=400)

    # Check provider health before retrying
    health = check_provider_health()
    if health.get("isDown"):
        return Response({
            "status": False,
            "message": "Communication provider service is currently unavailable. Please wait until the provider is restored before retrying.",
            "data": candidate_to_dict(candidate)
        }, status=503)

    message.retry_count += 1
    deliver(message)

    refreshed_candidate = Candidate.objects.prefetch_related("messages").get(id=message.candidate_id)
    return Response({
        "status": message.status != "Failed",
        "message": "Message sent again." if message.status != "Failed" else (message.failure_reason or "Retry failed."),
        "data": candidate_to_dict(refreshed_candidate),
    }, status=200)


# ---------- Message Templates API ----------
DEFAULT_TEMPLATES = [
    {
        "title": "Interview Invitation - First Round",
        "category": "Interview Scheduling",
        "channel": "Email",
        "body": "Dear {candidate_name},\n\nThank you for your interest in the {role} position at Hunar AI. We were impressed by your profile and would love to invite you for a first-round interview.\n\nPlease reply with your preferred days and time slots over the coming week so we can schedule the call.\n\nWarm regards,\nHunar AI Recruitment Team",
    },
    {
        "title": "Technical Assessment Round",
        "category": "Assessments",
        "channel": "Email",
        "body": "Hi {candidate_name},\n\nCongratulations on progressing to the assessment round for the {role} role at Hunar AI.\n\nPlease complete the technical skills assessment within the next 48 hours. Ensure you have a quiet environment and good internet connection.\n\nBest of luck!\nHunar AI Hiring Team",
    },
    {
        "title": "Final Interview with Leadership",
        "category": "Interview Scheduling",
        "channel": "Email",
        "body": "Dear {candidate_name},\n\nCongratulations on clearing the previous evaluation rounds! We would like to invite you for the final discussion for the {role} position with our leadership team.\n\nPlease let us know your availability over the next couple of days.\n\nBest regards,\nHunar AI Leadership Team",
    },
    {
        "title": "Interview Reminder",
        "category": "Interview Scheduling",
        "channel": "Email",
        "body": "Hi {first_name},\n\nThis is a quick reminder for your upcoming interview for the {role} position scheduled for tomorrow.\n\nPlease ensure your camera and microphone are ready. If you need to reschedule or have any questions beforehand, feel free to reply to this email.\n\nBest of luck,\nHunar AI Recruitment Team",
    },
    {
        "title": "Application Received & Under Review",
        "category": "Application & Screening",
        "channel": "Email",
        "body": "Hello {candidate_name},\n\nThank you for applying for the {role} position at Hunar AI (Candidate ID: {candidate_id}).\n\nOur recruitment team has received your application and is currently reviewing your profile. We will update you on the next steps shortly.\n\nBest regards,\nHunar AI Talent Acquisition",
    },
    {
        "title": "Initial Screening Call Invitation",
        "category": "Application & Screening",
        "channel": "Email",
        "body": "Hi {first_name},\n\nWe came across your profile for the {role} position and would like to schedule a brief 15-minute introductory call to learn more about your background.\n\nPlease let us know your availability over the next two days.\n\nBest regards,\nHunar AI Recruitment Team",
    },
    {
        "title": "Job Offer Discussion",
        "category": "Job Offer & Onboarding",
        "channel": "Email",
        "body": "Dear {candidate_name},\n\nWe are thrilled to inform you that you have been selected for the {role} position at Hunar AI!\n\nWe would love to schedule a call to walk you through your official offer details, compensation package, and tentative start date. Please let us know your availability today or tomorrow.\n\nWarmest congratulations,\nHunar AI Recruitment Team",
    },
    {
        "title": "Document Verification & Pre-Onboarding",
        "category": "Job Offer & Onboarding",
        "channel": "Email",
        "body": "Hi {candidate_name},\n\nCongratulations on your selection for the {role} position!\n\nTo proceed with your onboarding and verification, please share soft copies of your ID proof, educational certificates, and previous experience documents within 3 business days.\n\nWelcome to Hunar AI,\nHR Operations Team",
    },
    {
        "title": "Application Follow-Up / Status Update",
        "category": "Status Updates",
        "channel": "Email",
        "body": "Dear {candidate_name},\n\nWe wanted to provide you with a quick update on your candidacy for the {role} position. Our hiring team is completing candidate evaluations and will share an update by the end of this week.\n\nThank you for your patience,\nHunar AI Talent Team",
    },
    {
        "title": "Polite Rejection / Talent Pool",
        "category": "Status Updates",
        "channel": "Email",
        "body": "Dear {candidate_name},\n\nThank you for taking the time to interview for the {role} position at Hunar AI. While we were impressed with your background, we have decided to move forward with another candidate whose experience more closely matches our current needs.\n\nWe will keep your profile in our talent pool for future openings and wish you the best in your job search.\n\nSincerely,\nHunar AI Talent Acquisition",
    },
]

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def templates_list_create(request):
    if request.method == 'GET':
        if MessageTemplate.objects.count() == 0:
            for item in DEFAULT_TEMPLATES:
                MessageTemplate.objects.create(**item)

        templates = MessageTemplate.objects.all().order_by('category', 'title')
        data = [
            {
                "id": t.id,
                "title": t.title,
                "category": t.category,
                "channel": t.channel,
                "body": t.body,
                "createdAt": t.created_at.isoformat() if t.created_at else None,
            }
            for t in templates
        ]
        return Response({"status": True, "data": data}, status=200)

    elif request.method == 'POST':
        title = request.data.get("title", "").strip()
        body = request.data.get("body", "").strip()
        category = request.data.get("category", "General").strip() or "General"
        channel = request.data.get("channel", "All").strip() or "All"

        if not title or not body:
            return Response({"status": False, "message": "Both title and template content are required."}, status=400)

        template = MessageTemplate.objects.create(
            title=title,
            category=category,
            channel=channel,
            body=body,
        )
        return Response({
            "status": True,
            "message": "Template saved successfully",
            "data": {
                "id": template.id,
                "title": template.title,
                "category": template.category,
                "channel": template.channel,
                "body": template.body,
            }
        }, status=201)


@api_view(['DELETE'])
@permission_classes([AllowAny])
def delete_template(request, template_id):
    try:
        t = MessageTemplate.objects.get(id=template_id)
        t.delete()
        return Response({"status": True, "message": "Template deleted successfully."}, status=200)
    except MessageTemplate.DoesNotExist:
        return Response({"status": False, "message": "Template not found."}, status=404)


# ---------- Provider Health & Outage API ----------
@api_view(['GET'])
@permission_classes([AllowAny])
def provider_health(request):
    health = check_provider_health()
    return Response(health, status=200)


@api_view(['POST'])
@permission_classes([AllowAny])
def toggle_outage(request):
    down = request.data.get("down", True)
    try:
        resp = requests.post(
            f"{settings.PROVIDER_URL}/admin/outage",
            json={"down": bool(down)},
            timeout=3,
        )
        outage_state = resp.json() if resp.status_code == 200 else {"down": down}
    except Exception as e:
        outage_state = {"down": down, "error": str(e)}

    health = check_provider_health()
    return Response({
        "status": True,
        "message": f"Provider outage mode set to: {'ACTIVE (Down)' if down else 'INACTIVE (Operational)'}",
        "outageState": outage_state,
        "health": health,
    }, status=200)


# ---------- Email Open & Read Tracking Endpoints ----------
# 1x1 transparent GIF bytes for email open tracking pixel
TRANSPARENT_GIF = b'GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'

@api_view(['GET'])
@permission_classes([AllowAny])
def track_message_read(request, message_id):
    """Tracking pixel / click endpoint: when candidate opens or clicks confirm, status is updated to read."""
    from django.http import HttpResponse
    try:
        msg = Message.objects.select_related("candidate").get(id=message_id)
        msg.status = "read"
        msg.failure_reason = ""
        msg.save()
        refresh_candidate_summary(msg.candidate)
    except Message.DoesNotExist:
        pass

    redirect_req = request.GET.get('redirect', '').lower() in ('true', '1', 'yes')
    if redirect_req:
        html = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Hunar AI &mdash; Message Read Confirmation</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
        .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 36px 28px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06); }
        .icon { width: 56px; height: 56px; border-radius: 50%; background: #dcfce7; color: #16a34a; font-size: 28px; line-height: 56px; margin: 0 auto 18px; }
        h1 { font-size: 20px; font-weight: 700; margin: 0 0 10px; color: #0f172a; }
        p { font-size: 14px; line-height: 1.6; color: #64748b; margin: 0 0 24px; }
        .badge { display: inline-block; background: #e8f5e9; color: #2e7d32; font-size: 13px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; margin-bottom: 20px; }
        .btn { display: inline-block; background: #64748b; color: #ffffff; border: none; padding: 10px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s ease; }
        .btn:hover { background: #475569; }
        .hint { display: none; margin-top: 16px; font-size: 13px; color: #64748b; line-height: 1.4; }
    </style>   
</head>
<body>
    <div class="card">
        <div class="icon">&#10003;</div>
        <div class="badge">Status: read</div>
        <h1>Message Confirmed</h1>
        <p>Thank you! Your recruiter has been notified that this email was opened and read.</p>
        <button type="button" class="btn" id="closeBtn" onclick="closeThisTab(event);">Close</button>
        <p id="closeHint" class="hint">&#9432; You can now safely close this browser tab.</p>
    </div>
    <script>
    function closeThisTab(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        window.close();
        setTimeout(function() {
            var h = document.getElementById('closeHint');
            if (h) {
                h.style.display = 'block';
            }
        }, 120);
        return false;
    }
    </script>
</body>
</html>"""
        return HttpResponse(html, content_type="text/html")

    response = HttpResponse(TRANSPARENT_GIF, content_type="image/gif")
    response['Cache-Control'] = 'no-cache, no-store, must-revalidate, private'
    response['Pragma'] = 'no-cache'
    response['Expires'] = '0'
    return response


@api_view(['POST'])
@permission_classes([AllowAny])
def mark_message_read(request, message_id):
    """Allows marking message as read from recruiter dashboard."""
    try:
        msg = Message.objects.select_related("candidate").get(id=message_id)
        msg.status = "read"
        msg.failure_reason = ""
        msg.save()
        refresh_candidate_summary(msg.candidate)
        return Response({
            "status": True,
            "message": "Message status updated to read.",
            "data": candidate_to_dict(msg.candidate)
        }, status=200)
    except Message.DoesNotExist:
        return Response({"status": False, "message": "Message not found."}, status=404)


