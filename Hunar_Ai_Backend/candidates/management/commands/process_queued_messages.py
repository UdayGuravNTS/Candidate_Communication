import time

from django.core.management.base import BaseCommand

from candidates.messaging import deliver_next_queued_message


class Command(BaseCommand):
    help = "Deliver persisted queued candidate messages."

    def handle(self, *args, **options):
        self.stdout.write("Processing queued messages. Press Ctrl+C to stop.")
        try:
            while True:
                if not deliver_next_queued_message():
                    time.sleep(1)
        except KeyboardInterrupt:
            self.stdout.write("\nStopped queued-message worker.")
