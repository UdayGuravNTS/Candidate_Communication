import json

from django.test import TestCase
from django.urls import reverse

from .models import Candidate


class CreateCandidateApiTests(TestCase):
    def test_creates_candidate_and_returns_frontend_shape(self):
        response = self.client.post(
            reverse('add_candidate'),
            data=json.dumps({
                'fullName': 'Asha Patel',
                'mobileNumber': '+91 9876543210',
                'email': 'asha@example.com',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        response_data = response.json()
        candidate_data = response_data['data']
        self.assertEqual(candidate_data['fullName'], 'Asha Patel')
        self.assertEqual(candidate_data['mobileNumber'], '+91 9876543210')
        self.assertEqual(candidate_data['email'], 'asha@example.com')
        self.assertEqual(candidate_data['lastMessage'], 'NA')
        self.assertEqual(candidate_data['history'], [])
        self.assertTrue(Candidate.objects.filter(pk=candidate_data['id']).exists())

    def test_rejects_unsupported_methods(self):
        response = self.client.put(reverse('add_candidate'))

        self.assertEqual(response.status_code, 405)


class CandidateCollectionApiTests(TestCase):
    def test_allows_preflight_from_configured_frontend_origin(self):
        for origin in (
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://13.201.107.121',
        ):
            with self.subTest(origin=origin):
                response = self.client.options(
                    reverse('add_candidate'),
                    HTTP_ORIGIN=origin,
                    HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
                    HTTP_ACCESS_CONTROL_REQUEST_HEADERS='content-type',
                )

                self.assertEqual(response.status_code, 204)
                self.assertEqual(response['Access-Control-Allow-Origin'], origin)

    def test_created_candidate_is_returned_after_reloading_list(self):
        create_response = self.client.post(
            reverse('add_candidate'),
            data=json.dumps({
                'fullName': 'Asha Patel',
                'mobileNumber': '+91 9876543210',
                'email': 'asha@example.com',
            }),
            content_type='application/json',
        )

        list_response = self.client.get(reverse('candidate_list'))

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(list_response.status_code, 200)
        saved_candidates = list_response.json()['results']
        self.assertEqual(len(saved_candidates), 1)
        self.assertEqual(
            saved_candidates[0]['id'],
            create_response.json()['data']['id'],
        )

    def test_lists_saved_candidates_in_frontend_shape(self):
        candidate = Candidate.objects.create(
            id='ABC123',
            full_name='Asha Patel',
            mobile_number='+91 9876543210',
            email='asha@example.com',
        )

        response = self.client.get(reverse('candidate_list'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['results'][0]['id'], candidate.id)

    def test_deletes_saved_candidate(self):
        candidate = Candidate.objects.create(
            id='ABC123',
            full_name='Asha Patel',
            mobile_number='+91 9876543210',
            email='asha@example.com',
        )

        response = self.client.delete(reverse('delete_candidate', args=[candidate.id]))

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Candidate.objects.filter(pk=candidate.id).exists())

    def test_delete_returns_not_found_for_unknown_candidate(self):
        response = self.client.delete(reverse('delete_candidate', args=['ABC123']))

        self.assertEqual(response.status_code, 404)
