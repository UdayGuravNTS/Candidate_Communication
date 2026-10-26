from django.db import models


class Candidate(models.Model):
    id = models.CharField(max_length=6, primary_key=True)
    full_name = models.CharField(max_length=100)
    mobile_number = models.CharField(max_length=20)
    email = models.EmailField(max_length=254)
    last_message = models.CharField(max_length=20, default='NA')
    status = models.CharField(max_length=20, default='NA')
    role = models.CharField(max_length=100, default='Candidate')
    notes = models.TextField(default='Newly registered candidate.')
    history = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.full_name} ({self.id})'


class Message(models.Model):
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name="messages")
    channel = models.CharField(max_length=30, default="WhatsApp")
    provider = models.CharField(max_length=50, default="WhatsApp Cloud")
    text = models.TextField()
    status = models.CharField(max_length=20, default="Queued")   # Queued, Scheduled, Sent, Delivered, read, Failed
    scheduled_at = models.DateTimeField(null=True, blank=True, db_index=True)
    provider_message_id = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    failure_reason = models.CharField(max_length=255, blank=True, default="")
    can_retry = models.BooleanField(default=False)
    retry_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class MessageTemplate(models.Model):
    title = models.CharField(max_length=120)
    category = models.CharField(max_length=60, default="General")
    channel = models.CharField(max_length=30, default="All")
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['category', 'title']

    def __str__(self):
        return f"{self.title} ({self.category})"


class ProviderEvent(models.Model):
    event_id = models.CharField(max_length=64, unique=True)
    received_at = models.DateTimeField(auto_now_add=True)