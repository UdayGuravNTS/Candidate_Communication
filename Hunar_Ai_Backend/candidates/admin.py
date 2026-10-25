from django.contrib import admin
from.models import Candidate,ProviderEvent,Message

admin.site.register(Candidate)
admin.site.register(Message)
admin.site.register(ProviderEvent)