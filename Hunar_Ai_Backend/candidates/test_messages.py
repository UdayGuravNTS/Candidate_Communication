import re
from threading import Barrier
from unittest.mock import patch

from django.conf import settings
from django.test import TestCase
from django.urls import reverse

from .messaging import deliver_many, deliver_next_queued_message
from .models import Candidate, Message


class SendMessageApiTests(TestCase):
    def setUp(self):
        self.candidate = Candidate.objects.create(
            id='ABC123',
            full_name='Asha Patel',
            mobile_number='+91 9876543210',
            email='asha@example.com',
        )

    @patch('candidates.messaging.call_provider', return_value='provider-message-123')
    def test_saves_message_date_and_history_for_selected_candidate(self, _call_provider):
        response = self.client.post(
            reverse('send_message'),
            data={
                'channel': 'WhatsApp',
                'message': 'Interview scheduled for tomorrow.',
                'candidateIds': [self.candidate.id],
                'isScheduled': False,
                'scheduledDate': None,
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        _call_provider.assert_called_once_with(
            self.candidate.mobile_number,
            'Interview scheduled for tomorrow.',
        )
        self.assertEqual(response.json()['results'][0]['status'], 'Sent')
        message = self.candidate.messages.get()
        self.assertEqual(message.status, 'Sent')

        self.candidate.refresh_from_db()
        self.assertRegex(self.candidate.last_message, re.compile(r'^\d{2}-\d{2}-\d{4}$'))
        self.assertEqual(self.candidate.status, 'Sent')
        self.assertEqual(message.text, 'Interview scheduled for tomorrow.')
        self.assertEqual(message.status, 'Sent')

        history_item = response.json()['data'][0]['history'][0]
        self.assertEqual(history_item['text'], 'Interview scheduled for tomorrow.')
        self.assertRegex(
            history_item['timestamp'],
            re.compile(r'^\d{2}-\d{2}-\d{4}, \d{1,2}:\d{2} [AP]M$'),
        )
        self.assertEqual(history_item['status'], 'Sent')

    @patch('candidates.views.requests.get')
    def test_provider_health_includes_channel_specific_message_counts(self, get_health):
        get_health.return_value.ok = True
        get_health.return_value.json.return_value = {'status': 'operational'}
        Message.objects.create(
            candidate=self.candidate,
            channel='WhatsApp',
            text='Delivered message',
            status='Delivered',
            provider_message_id='whatsapp-1',
        )
        Message.objects.create(
            candidate=self.candidate,
            channel='WhatsApp',
            text='Failed message',
            status='Failed',
        )
        Message.objects.create(
            candidate=self.candidate,
            channel='SMS',
            text='SMS message',
            status='Sent',
            provider_message_id='sms-1',
        )

        response = self.client.get(reverse('provider_health'))

        self.assertEqual(response.status_code, 200)
        providers = {
            provider['name']: provider
            for provider in response.json()['data']['providers']
        }
        self.assertEqual(
            providers['WhatsApp']['counts'],
            {'sent': 1, 'delivered': 1, 'failed': 1},
        )
        self.assertEqual(
            providers['SMS']['counts'],
            {'sent': 1, 'delivered': 0, 'failed': 0},
        )

    @patch('candidates.messaging.call_provider', return_value='provider-message-123')
    def test_candidate_list_shows_delivered_and_read_webhook_statuses(self, _call_provider):
        response = self.client.post(
            reverse('send_message'),
            data={
                'channel': 'WhatsApp',
                'message': 'Interview scheduled.',
                'candidateIds': [self.candidate.id],
            },
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        event_url = reverse('provider_webhook')

        for event_status in ('delivered', 'read'):
            response = self.client.post(
                event_url,
                data={
                    'eventId': f'event-{event_status}',
                    'messageId': 'provider-message-123',
                    'status': event_status,
                },
                content_type='application/json',
                HTTP_X_PROVIDER_SECRET=settings.PROVIDER_WEBHOOK_SECRET,
            )
            self.assertEqual(response.status_code, 200)

            list_response = self.client.get(reverse('candidate_list'))
            history_item = list_response.json()['results'][0]['history'][0]
            expected_status = 'Delivered' if event_status == 'delivered' else 'read'
            self.assertEqual(history_item['status'], expected_status)

    @patch('candidates.messaging.call_provider', return_value='provider-message-123')
    def test_candidate_list_returns_persisted_message_history(self, _call_provider):
        response = self.client.post(
            reverse('send_message'),
            data={
                'channel': 'WhatsApp',
                'message': 'Interview scheduled.',
                'candidateIds': [self.candidate.id],
            },
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.get(reverse('candidate_list'))

        self.assertEqual(response.status_code, 200)
        listed_candidate = response.json()['results'][0]
        self.assertEqual(listed_candidate['id'], self.candidate.id)
        self.assertEqual(len(listed_candidate['history']), 1)
        self.assertEqual(listed_candidate['history'][0]['text'], 'Interview scheduled.')
        self.assertEqual(listed_candidate['history'][0]['status'], 'Sent')

    def test_rejects_empty_message_without_saving(self):
        response = self.client.post(
            reverse('send_message'),
            data={'message': '  ', 'candidateIds': [self.candidate.id]},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.candidate.messages.count(), 0)
        self.candidate.refresh_from_db()
        self.assertEqual(self.candidate.last_message, 'NA')

    def test_rejects_unknown_candidate_without_partial_save(self):
        response = self.client.post(
            reverse('send_message'),
            data={
                'message': 'Interview scheduled.',
                'candidateIds': [self.candidate.id, 'ZZZ999'],
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.candidate.messages.count(), 0)

    @patch('candidates.messaging.call_provider', return_value='provider-message-123')
    def test_worker_delivers_queued_messages(self, _call_provider):
        message = self.candidate.messages.create(
            channel='WhatsApp',
            text='Interview scheduled.',
            status='Queued',
        )

        self.assertTrue(deliver_next_queued_message())

        message.refresh_from_db()
        self.candidate.refresh_from_db()
        self.assertEqual(message.status, 'Sent')
        self.assertEqual(self.candidate.status, 'Sent')
        _call_provider.assert_called_once_with(
            self.candidate.mobile_number,
            'Interview scheduled.',
        )
        self.assertFalse(deliver_next_queued_message())

    @patch('candidates.messaging.call_provider')
    def test_bulk_send_calls_provider_concurrently_and_saves_actual_statuses(self, call_provider):
        second_candidate = Candidate.objects.create(
            id='DEF123',
            full_name='Ravi Kumar',
            mobile_number='+91 9876543211',
            email='ravi@example.com',
        )
        barrier = Barrier(2)

        def provider_response(_to, _body):
            barrier.wait(timeout=3)
            return 'provider-message'

        call_provider.side_effect = provider_response
        messages = [
            self.candidate.messages.create(text='Hello', status='Queued'),
            second_candidate.messages.create(text='Hello', status='Queued'),
        ]

        delivered = deliver_many(messages)

        self.assertEqual([message.status for message in delivered], ['Sent', 'Sent'])
        self.assertEqual(call_provider.call_count, 2)
