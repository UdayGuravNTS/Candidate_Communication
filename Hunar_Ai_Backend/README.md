# Hunar AI backend and message provider

Run Django, the dummy messaging provider, and the Vite frontend in separate terminals.
The send API delivers messages to selected candidates concurrently and reports the
provider's actual Sent/Failed result. Provider webhooks update messages to Delivered/read.
The Django `manage.py` file is in this directory, not in `dummy_provider`.

## 1. Start Django

From `Hunar_Ai_Backend`:

```powershell
.\venv\Scripts\Activate.ps1
python manage.py migrate
python manage.py runserver 8000
```

If the terminal is currently in `dummy_provider`, run Django with the backend
virtual-environment interpreter and the relative path to `manage.py`:

```powershell
..\venv\Scripts\python.exe ..\manage.py migrate
..\venv\Scripts\python.exe ..\manage.py runserver 8000
```

## 2. Optional: process messages queued by an earlier version

New sends do not require the worker. If the database contains old messages with status
`Queued`, run this in another terminal from `Hunar_Ai_Backend` to finish processing them:

```powershell
.\venv\Scripts\Activate.ps1
python manage.py process_queued_messages
```

## 3. Start the dummy messaging provider

In another terminal, from `Hunar_Ai_Backend\dummy_provider`:

```powershell
.\venv\Scripts\Activate.ps1
python app.py
```

This Flask application listens on `http://localhost:9000`, matching Django's
`PROVIDER_URL` setting. It is started with `python app.py`, not `manage.py runserver`.

## 4. Start the frontend

In a third terminal, from `Hunar_Ai_Frontend\Candidate_Communication`:

```powershell
npm run dev
```

Keep Django, the provider, and the frontend terminals running while using the application.
The frontend uses Django at `http://localhost:8000`; Django sends messages to the provider
at port 9000.

For deployment, set `DJANGO_SECRET_KEY` and set the same `PROVIDER_WEBHOOK_SECRET` in
both Django and the provider environment. Do not commit either value; local development
uses non-production defaults.
