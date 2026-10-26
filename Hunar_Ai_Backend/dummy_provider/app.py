import os
import threading
import time
import uuid

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

BACKEND_URL = os.environ.get("BACKEND_URL") or os.environ.get("HUNAR_AI_BACKEND_URL", "http://localhost:8001")
WEBHOOK_URL = os.environ.get("WEBHOOK_URL", f"{BACKEND_URL.rstrip('/')}/api/webhooks/provider/")
WEBHOOK_SECRET = os.environ.get("PROVIDER_WEBHOOK_SECRET", "dev-secret")

messages = {}
failed_once = set()
state = {"down": False}
stats = {"sent": 0, "delivered": 0, "failed": 0}


def push_event(message_id, status, reason=None, retryable=False, times=1):
    payload = {
        "eventId": str(uuid.uuid4()),
        "messageId": message_id,
        "status": status,
        "reason": reason,
        "retryable": retryable,
    }
    for _ in range(times):
        try:
            requests.post(
                WEBHOOK_URL,
                json=payload,
                headers={"X-Provider-Secret": WEBHOOK_SECRET},
                timeout=5,
            )
        except requests.RequestException as exc:
            print("Webhook failed:", exc)


def lifecycle(message_id, last4):
    time.sleep(2)

    if last4 == "3333":
        messages[message_id]["status"] = "failed"
        stats["failed"] += 1
        push_event(message_id, "failed", "The recipient's phone was unreachable.", True)
        return

    if last4 == "4444":
        messages[message_id]["status"] = "failed"
        stats["failed"] += 1
        push_event(message_id, "failed", "The recipient has not opted in to receive messages.", False)
        return

    messages[message_id]["status"] = "delivered"
    stats["delivered"] += 1
    push_event(message_id, "delivered", times=2)   # duplicate on purpose

    time.sleep(3)
    messages[message_id]["status"] = "read"
    push_event(message_id, "read")


@app.post("/v1/messages")
def send_message():
    if state["down"]:
        return jsonify(code="UNAVAILABLE", message="Service unavailable"), 503

    body = request.get_json(force=True)
    digits = "".join(ch for ch in body.get("to", "") if ch.isdigit())
    if len(digits) < 10:
        return jsonify(code="INVALID_RECIPIENT", message="Invalid phone number"), 400

    last4 = digits[-4:]

    if last4 == "0000":
        return jsonify(code="INVALID_RECIPIENT", message="Number not on WhatsApp"), 400

    if last4 == "1111" and digits not in failed_once:
        failed_once.add(digits)
        return jsonify(code="RATE_LIMITED", message="Too many requests"), 429

    if last4 == "2222" and digits not in failed_once:
        failed_once.add(digits)
        return jsonify(code="TEMPORARY_FAILURE", message="Try again later"), 503

    message_id = "msg_" + uuid.uuid4().hex[:12]
    messages[message_id] = {"to": digits, "body": body.get("body", ""), "status": "sent"}
    stats["sent"] += 1
    threading.Thread(target=lifecycle, args=(message_id, last4), daemon=True).start()
    return jsonify(id=message_id, status="sent"), 202


@app.get("/v1/messages/<message_id>")
def get_message(message_id):
    message = messages.get(message_id)
    if not message:
        return jsonify(code="NOT_FOUND"), 404
    return jsonify(id=message_id, status=message["status"])


@app.post("/admin/outage")
def outage():
    state["down"] = bool(request.get_json(force=True).get("down"))
    return jsonify(down=state["down"])


@app.get("/health")
def health():
    return jsonify(status="down" if state["down"] else "operational", **stats)


if __name__ == "__main__":
    app.run(port=9000)