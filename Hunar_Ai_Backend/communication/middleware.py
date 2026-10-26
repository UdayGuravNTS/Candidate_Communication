from django.conf import settings
from django.http import HttpResponse
from django.utils.cache import patch_vary_headers


class ApiCorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get('Origin')
        allow_all = getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', False)
        is_allowed_origin = (
            allow_all
            or (origin in settings.CORS_ALLOWED_ORIGINS)
            or (origin and ('.vercel.app' in origin or 'localhost' in origin or '127.0.0.1' in origin))
        )

        if request.method == 'OPTIONS' and is_allowed_origin:
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)

        if is_allowed_origin and origin:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
            patch_vary_headers(response, ['Origin'])

        return response
