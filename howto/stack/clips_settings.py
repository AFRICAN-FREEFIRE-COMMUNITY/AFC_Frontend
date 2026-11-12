"""Django settings for the how-to clips stack (howto/README.md).

The clips are recorded on a LOCAL copy of AFC with a database built fresh from the models, so no
real person's data can ever be on frame (owner brief, 2026-10-10: "Never the live site, never real
people's data on frame"). This module sits on top of the backend's own settings and changes only
what the recording needs:

  - the database is afc_howto, never afc_db (stack.py refuses any other name before it drops one)
  - nothing leaves the machine: every email, WhatsApp message and Discord DM goes to the outbox
    file instead (afc_auth/outbox.py), which is also how the clip reads the sign-up code
  - no DeepL, no bot check (Turnstile), no Celery broker (tasks run inline)
  - a dummy Discord app, so the Discord row is listed and "Connect" builds its consent address;
    nothing is ever authorized with it (the clip never follows it, see howto/clips/signup-discord.mjs)

How it is loaded: stack.py runs the backend's manage.py with PYTHONPATH=howto/stack and
DJANGO_SETTINGS_MODULE=clips_settings. manage.py only setdefault()s the settings module, so the
environment wins.
"""
import os

from afc.settings import *  # noqa: F401,F403
from afc.settings import DATABASES

_HERE = os.path.dirname(os.path.abspath(__file__))
_OUT = os.path.join(os.path.dirname(_HERE), "out")
os.makedirs(_OUT, exist_ok=True)

# ── ports: the clips stack runs beside any other local walk (8093/3093) without touching it ──
HOWTO_BACKEND_PORT = int(os.environ.get("HOWTO_BACKEND_PORT", "8094"))
HOWTO_FRONTEND_PORT = int(os.environ.get("HOWTO_FRONTEND_PORT", "3094"))

DATABASES["default"]["NAME"] = os.environ.get("HOWTO_DB", "afc_howto")
DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]
CORS_ALLOW_ALL_ORIGINS = True
FRONTEND_URL = f"http://localhost:{HOWTO_FRONTEND_PORT}"
FRONTEND_URL_LOCAL = FRONTEND_URL
SITE_URL = FRONTEND_URL

# ── nothing leaves the machine ──
OUTBOUND_DELIVERY = "outbox"
OUTBOUND_OUTBOX_FILE = os.path.join(_OUT, "outbox.txt")
DEEPL_API_KEY = ""
TURNSTILE_SECRET_KEY = ""
# afc_auth/bot_protection.py reads the Turnstile secret from the ENVIRONMENT, not from settings
# (found on the first recording: the sign-up answered bot_check_failed), and .env has already put
# it there by the time this module runs. Blank it, and DeepL's, where they are actually read.
os.environ["TURNSTILE_SECRET_KEY"] = ""
os.environ["DEEPL_API_KEY"] = ""
# Every other outside service blanked too, so a code path that skips the outbox chokepoint still
# has nothing to call with.
OPENAI_API_KEY = ""
GEMINI_API_KEY = ""
DISCORD_BOT_TOKEN = ""
WHATSAPP_ACCESS_TOKEN = ""
WHATSAPP_PHONE_NUMBER_ID = ""

# ── Celery: no broker on this machine, so a .delay() runs inline instead of hanging ──
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = False

# ── one process, one cache: the sign-up code and the rate limits live in runserver's memory ──
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# ── dummy Discord app: lists the provider and builds the consent address, authorizes nothing ──
DISCORD_CLIENT_ID = "howto-clips-client"
DISCORD_CLIENT_SECRET = "howto-clips-secret"
DISCORD_REDIRECT_URI = f"http://localhost:{HOWTO_BACKEND_PORT}/auth/connect-discord/callback/"
