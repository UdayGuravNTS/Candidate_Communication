
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

from .messaging import apply_status_update, deliver_many
from .models import Candidate, Message, ProviderEvent
from django.db.models import Q
from .models import Candidate
import json
import random
import string

# Fixed prefix for every candidate ID
ID_PREFIX = "A1B2C"

def build_candidate_id():
    # Get all IDs that start with A1B2C
    existing_ids = Candidate.objects.filter(id__startswith=ID_PREFIX).values_list('id', flat=True)

    # Collect the numbers after the prefix (1, 2, 3, ...)
    numbers = []
    for existing_id in existing_ids:
        number_part = existing_id[len(ID_PREFIX):]
        if number_part.isdigit():
            numbers.append(int(number_part))

    # Highest number + 1
    next_number = max(numbers, default=0) + 1

    return f"{ID_PREFIX}{next_number}"     # A1B2C1, A1B2C2, A1B2C3, ...




# ---------- helpers: turn database objects into dictionaries ----------
def message_to_dict(m):
    local = timezone.localtime(m.created_at)
    time_part = local.strftime("%I:%M %p").lstrip("0")
    return {
        "id": str(m.id),
        "channel": m.channel,
        "text": m.text,
        "status": m.status,
        "timestamp": f"{local.strftime('%d-%m-%Y')}, {time_part}",
        "failureReason": m.failure_reason,
        "canRetry": m.can_retry,
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




@api_view(['POST'])
@permission_classes([AllowAny])
def add_candidate(request):
    data = request.data

    full_name = data.get("fullName")
    mobile_number = data.get("mobileNumber")
    email = data.get("email")

    # Generate ID like A1B2C1
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
            "data": {
                "id": candidate.id,
                "fullName": candidate.full_name,
                "mobileNumber": candidate.mobile_number,
                "email": candidate.email,
                "lastMessage": candidate.last_message,
                "status": candidate.status,
                "role": candidate.role,
                "notes": candidate.notes,
                "history": candidate.history,
            }
        },
        status=status.HTTP_201_CREATED
    )



@api_view(['GET'])
@permission_classes([AllowAny])
def candidate_list(request):
    try:
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






# ---------- send message (single or bulk) ----------
@api_view(['POST'])
@permission_classes([AllowAny])
def send_message(request):
    data = request.data
    channel = data.get("channel", "WhatsApp")
    text = data.get("message")
    candidate_ids = data.get("candidateIds", [])

    if not isinstance(text, str) or not text.strip():
        return Response({"message": "A non-empty message is required."}, status=400)
    if not isinstance(candidate_ids, list) or not candidate_ids:
        return Response({"message": "Select at least one candidate."}, status=400)

    candidate_ids = list(dict.fromkeys(candidate_ids))
    candidates = list(Candidate.objects.filter(id__in=candidate_ids))
    if len(candidates) != len(candidate_ids):
        return Response({"message": "One or more selected candidates could not be found."}, status=404)

    messages = []
    for candidate in candidates:
        message = Message.objects.create(
            candidate=candidate, channel=channel, text=text.strip(), status="Sending"
        )
        messages.append(message)

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

    refreshed = Candidate.objects.prefetch_related("messages").filter(id__in=candidate_ids)

    return Response({
        "status": failed == 0,
        "message": f"{len(results) - failed} sent, {failed} failed",
        "summary": {"total": len(results), "sent": len(results) - failed, "failed": failed},
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

    if message.status != "Failed":
        return Response({"message": "Only failed messages can be retried."}, status=400)
    if not message.can_retry:
        return Response({"message": "This failure is permanent, so the message cannot be retried."}, status=400)

    message.retry_count += 1
    deliver(message)

    candidate = Candidate.objects.prefetch_related("messages").get(id=message.candidate_id)
    return Response({
        "status": message.status != "Failed",
        "message": "Message sent again." if message.status != "Failed" else message.failure_reason,
        "data": candidate_to_dict(candidate),
    }, status=200)
