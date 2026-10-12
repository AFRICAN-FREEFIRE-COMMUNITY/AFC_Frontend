"""The how-to clips stack: build, serve and play the backend's part in a clip (howto/README.md).

Run with the BACKEND's Python, because it imports the backend:

    $AFC_BACKEND_PYTHON howto/stack/stack.py reset [scenario] fresh database afc_howto + seed.py's scenario
    $AFC_BACKEND_PYTHON howto/stack/stack.py token <username>  a session for an invented player (clips 2-4)
    $AFC_BACKEND_PYTHON howto/stack/stack.py invite <username> the newest unanswered team invite id
    $AFC_BACKEND_PYTHON howto/stack/stack.py serve            runserver on HOWTO_BACKEND_PORT (8094)
    $AFC_BACKEND_PYTHON howto/stack/stack.py code <email>     the newest sign-up code mailed to <email>
    $AFC_BACKEND_PYTHON howto/stack/stack.py link <username> <provider> <name> <id>
    $AFC_BACKEND_PYTHON howto/stack/stack.py seen <username>   the welcome tour counts as seen

AFC_BACKEND_TREE is the backend checkout to run (a worktree on the backend's main). Its migrations
are not committed (AFC-B .gitignore: they are generated on the server), so `reset` runs
makemigrations in that tree first; on a tree that already has migration files it only adds what is
missing. Every command goes through clips_settings.py, so nothing is ever sent and the database is
always afc_howto.

Called by: howto/render.mjs (code, link) and by hand (reset, serve). Talks to: the backend's
manage.py, afc_auth.connections.links.link_account (the same function Discord's callback calls).
"""
import io
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUTBOX = os.path.join(os.path.dirname(HERE), "out", "outbox.txt")
SAFE_DB = "afc_howto"


def backend_tree():
    tree = os.environ.get("AFC_BACKEND_TREE", "")
    if not tree or not os.path.isfile(os.path.join(tree, "manage.py")):
        sys.exit("stack.py: set AFC_BACKEND_TREE to a backend checkout (the folder holding manage.py)")
    return os.path.abspath(tree)


def env():
    e = dict(os.environ)
    e["PYTHONPATH"] = HERE + os.pathsep + e.get("PYTHONPATH", "")
    e["DJANGO_SETTINGS_MODULE"] = "clips_settings"
    e["PYTHONIOENCODING"] = "utf-8"
    return e


def manage(*args, stdin=None):
    """Run the backend's manage.py through clips_settings. Raises on a non-zero exit."""
    return subprocess.run(
        [sys.executable, "manage.py", *args],
        cwd=backend_tree(), env=env(), input=stdin, text=True, check=True,
    )


def shell(code):
    """Run Python inside the backend (manage.py shell) and return what it printed."""
    out = subprocess.run(
        [sys.executable, "manage.py", "shell", "-c", code],
        cwd=backend_tree(), env=env(), text=True, capture_output=True, check=False,
    )
    if out.returncode != 0:
        sys.exit(out.stderr[-2000:])
    return out.stdout


# ── reset: drop and rebuild afc_howto, then seed ─────────────────────────────────────────────────
def reset(scenario=""):
    # The guard comes first and reads the SAME settings the commands below will use, so a typo in
    # HOWTO_DB can never point the DROP at the development or a copied production database.
    name = shell("from django.conf import settings; print(settings.DATABASES['default']['NAME'])").strip().splitlines()[-1]
    if name != SAFE_DB:
        sys.exit(f"stack.py: refusing to reset database {name!r}; only {SAFE_DB!r} is ever dropped")
    shell(
        "from django.conf import settings\n"
        "import MySQLdb\n"
        "d = settings.DATABASES['default']\n"
        "c = MySQLdb.connect(host=d['HOST'], user=d['USER'], passwd=d['PASSWORD'], port=int(d.get('PORT') or 3306))\n"
        f"cur = c.cursor(); cur.execute('DROP DATABASE IF EXISTS {SAFE_DB}');"
        f" cur.execute('CREATE DATABASE {SAFE_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'); c.close()\n"
    )
    manage("makemigrations", "--noinput", "-v", "0")
    manage("migrate", "--noinput", "-v", "0")
    # The clip's own starting state (seed.py SCENARIOS, picked by the clip's meta.seed).
    os.environ["HOWTO_SCENARIO"] = scenario
    os.environ["HOWTO_FONTS"] = os.path.join(os.path.dirname(os.path.dirname(HERE)), "assets", "fonts", "og")
    with io.open(os.path.join(HERE, "seed.py"), encoding="utf-8") as fh:
        print(shell(fh.read()).strip())
    if os.path.exists(OUTBOX):
        os.remove(OUTBOX)
    print(f"reset: {SAFE_DB} rebuilt and seeded")


# ── serve: the backend the clips talk to ─────────────────────────────────────────────────────────
def serve():
    port = os.environ.get("HOWTO_BACKEND_PORT", "8094")
    manage("runserver", f"127.0.0.1:{port}", "--noreload")


# ── code: what the player reads in their inbox ───────────────────────────────────────────────────
def code(email):
    """The newest 6-digit code in an email to `email` in the outbox, the way the player finds it."""
    if not os.path.exists(OUTBOX):
        sys.exit("stack.py: no outbox yet (has the sign-up been sent?)")
    text = io.open(OUTBOX, encoding="utf-8").read()
    found = None
    for entry in text.split("\n---\n"):
        head, _, body = entry.partition("\n")
        if " email " in f" {head} " and f"to={email!r}" in head:
            m = re.search(r"(?<!\d)(\d{6})(?!\d)", re.sub(r"<[^>]+>", " ", body))
            if m:
                found = m.group(1)
    if not found:
        sys.exit(f"stack.py: no code mailed to {email} in the outbox")
    print(found)


# ── link: the answer the provider gives after the player presses Authorize ───────────────────────
def link(username, provider, name, provider_user_id):
    """Link an outside account exactly as finish_connection does after a real consent screen.

    The clip never shows or imitates the provider's page; it says in a caption what the player does
    there, then this records what the provider would answer, and the browser lands on the address
    the real callback redirects to (/profile/connected-apps?connected=<provider>)."""
    print(shell(
        "from afc_auth.models import User\n"
        "from afc_auth.connections.links import link_account\n"
        f"u = User.objects.get(username={username!r})\n"
        f"link_account(u, {provider!r}, {{'provider_user_id': {provider_user_id!r}, 'username': {name!r}}})\n"
        "print('linked', u.username)\n"
    ).strip())


# ── seen: the player has already closed the welcome tour ─────────────────────────────────────────
def seen(username):
    """Mark the welcome tour as seen (User.has_seen_welcome, what the tour's own Skip button sets
    through /auth/mark-welcome-seen/). A clip about one task calls this before a full page load,
    or the first-run tour opens over the very screen the clip is pointing at (first recording)."""
    print(shell(
        "from afc_auth.models import User\n"
        f"n = User.objects.filter(username={username!r}).update(has_seen_welcome=True)\n"
        "print('seen', n)\n"
    ).strip())


# ── token: start a clip already signed in as an invented player ──────────────────────────────────
def token(username):
    """A fresh SessionToken for `username`, printed alone on the last line. Clips 2 to 4 are about a
    task, not about logging in (clip 1 shows that), so the recorder puts this in the auth_token
    cookie, the same cookie the login form sets. Only ever on afc_howto (clips_settings)."""
    print(shell(
        "import secrets\n"
        "from afc_auth.models import SessionToken, User\n"
        f"u = User.objects.get(username={username!r})\n"
        "t = SessionToken.objects.create(user=u, token=secrets.token_hex(32))\n"
        "print(t.token)\n"
    ).strip().splitlines()[-1])


# ── invite: the address of the invitation a player received (what their invite email links to) ───
def invite(username):
    """The newest unanswered team invite for `username`, printed alone on the last line. The
    invite email (in the outbox) carries the same /invite/<id> link; reading the row is simpler
    than parsing the email and lands on the same page."""
    print(shell(
        "from afc_team.models import Invite\n"
        f"i = Invite.objects.filter(invitee__username={username!r}, status_of_invite='unattended_to')"
        ".order_by('-created_at').first()\n"
        "print(i.invite_id if i else '')\n"
    ).strip().splitlines()[-1])


if __name__ == "__main__":
    cmd, *rest = sys.argv[1:] or ["help"]
    if cmd == "invite" and len(rest) == 1:
        invite(rest[0])
        sys.exit(0)
    if cmd == "reset" and len(rest) <= 1:
        reset(*rest)
    elif cmd == "token" and len(rest) == 1:
        token(rest[0])
    elif cmd == "serve":
        serve()
    elif cmd == "code" and len(rest) == 1:
        code(rest[0])
    elif cmd == "link" and len(rest) == 4:
        link(*rest)
    elif cmd == "seen" and len(rest) == 1:
        seen(rest[0])
    else:
        sys.exit(__doc__)
