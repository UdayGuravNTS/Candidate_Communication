"""
URL configuration for communication project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from candidates.views import (
    add_candidate,
    candidate_list,
    delete_candidate,
    send_message,
    provider_webhook,
    retry_message,
    templates_list_create,
    delete_template,
    provider_health,
    toggle_outage,
    track_message_read,
    mark_message_read,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/candidates/', add_candidate, name='add_candidate'),
    path('api/Get_candidates_lists/', candidate_list, name='candidate_list'),
    path('api/candidates/delete/<str:candidate_id>/', delete_candidate, name='delete_candidate'),
    path('api/candidates/send-message/', send_message, name='send_message'),
    path('api/webhooks/provider/', provider_webhook, name='provider_webhook'),
    path('api/messages/<int:message_id>/retry/', retry_message, name='retry_message'),
    path('api/messages/<int:message_id>/mark_read/', mark_message_read, name='mark_message_read'),
    path('api/track/read/<int:message_id>/', track_message_read, name='track_message_read'),
    path('api/templates/', templates_list_create, name='templates_list_create'),
    path('api/templates/<int:template_id>/', delete_template, name='delete_template'),
    path('api/provider/health/', provider_health, name='provider_health'),
    path('api/provider/toggle-outage/', toggle_outage, name='toggle_outage'),
]
