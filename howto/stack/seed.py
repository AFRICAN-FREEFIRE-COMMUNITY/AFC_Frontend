# Seed for the how-to clips database (afc_howto). Run by `stack.py reset <scenario>` inside
# manage.py shell, after a fresh migrate, so every take starts from the same state.
#
# One SCENARIO per clip (HOWTO_SCENARIO, from the clip's meta.seed). Every name here is invented
# and every address is a demo one; nothing is ever copied from a real record (owner brief: "never
# real people's data on frame"). Dates are relative to today, so a take made next month still finds
# an open transfer window and a tournament taking registrations.
#
# Called by: howto/stack/stack.py (reset). Talks to: afc_auth (User, UserProfile, Roles, UserRoles),
# afc_team (Team, TeamMembers), afc_rankings (Season), afc_tournament_and_scrims (Event, Stages,
# StageGroups, Match, TournamentTeam, TournamentTeamMember, StageGroupCompetitor, Leaderboard),
# afc_organizers (Organization, OrganizationMember).
import datetime
import os

from django.conf import settings
from django.utils import timezone

assert settings.DATABASES["default"]["NAME"] == "afc_howto", "seed.py only ever runs on afc_howto"

from afc_auth.models import Roles, User, UserProfile, UserRoles  # noqa: E402
from afc_organizers.models import Organization, OrganizationMember  # noqa: E402
from afc_rankings.models import Season  # noqa: E402
from afc_team.models import Team, TeamMembers  # noqa: E402
from afc_tournament_and_scrims.models import (  # noqa: E402
    Event, Leaderboard, Match, StageGroupCompetitor, StageGroups, Stages, TournamentTeam,
    TournamentTeamMember,
)

SCENARIO = os.environ.get("HOWTO_SCENARIO", "")
# The language of the take (render.mjs sets it per take), so a player's own language setting can
# never switch a French or Portuguese take back to English.
LANG = os.environ.get("HOWTO_LANG", "en")
PASSWORD = "Kofi#2026play"  # the demo password every invented player shares (never shown: it is typed as dots)
TODAY = timezone.localdate()


def day(n):
    return TODAY + datetime.timedelta(days=n)


# ── common: a season whose transfer window is open today, so teams can be made and changed ──────
def season():
    Season.objects.get_or_create(
        name=f"Season {(TODAY.month - 1) // 3 + 1} {TODAY.year}",
        defaults=dict(quarter=(TODAY.month - 1) // 3 + 1, year=TODAY.year, start_date=day(-11),
                      end_date=day(80), transfer_window_open=day(-3), transfer_window_close=day(20),
                      is_active=True))


def player(username, full_name, uid, country="Ghana"):
    """A verified player who has finished setup and seen the welcome tour (the clips are about one
    task each, not about first-login screens)."""
    user = User.objects.filter(username=username).first()
    if user:
        return user
    user = User(username=username, full_name=full_name, email=f"{username.lower()}.demo@gmail.com",
                uid=uid, role="player", country=country, is_active=True, has_seen_welcome=True,
                has_completed_onboarding=True, language=LANG)
    user.set_password(PASSWORD)
    user.save()
    UserProfile.objects.get_or_create(user=user)
    return user


def team(name, tag, owner, members, country="Ghana"):
    t = Team.objects.create(team_name=name, team_tag=tag, join_settings="by_request", team_creator=owner,
                            team_owner=owner, country=country)
    TeamMembers.objects.create(team=t, member=owner, management_role="team_captain", in_game_role="rusher")
    for m, role in zip(members, ("support", "grenader", "sniper", "support")):
        TeamMembers.objects.create(team=t, member=m, management_role="member", in_game_role=role)
    return t


def banner(event, line2):
    """A plain banner, as an organizer would upload one: without it the site shows its grey
    "600 x 400" placeholder on the card and the event page (first take of clip 3). Flat dark
    surface, the event name in DM Sans (the font files the site's share cards use,
    assets/fonts/og, path handed over by stack.py as HOWTO_FONTS), one line in the AFC green."""
    import io as _io

    from django.core.files.base import ContentFile
    from PIL import Image, ImageDraw, ImageFont

    fonts = os.environ.get("HOWTO_FONTS", "")
    img = Image.new("RGB", (1200, 800), (16, 20, 24))
    draw = ImageDraw.Draw(img)
    title = ImageFont.truetype(os.path.join(fonts, "DMSans-800.ttf"), 112)
    sub = ImageFont.truetype(os.path.join(fonts, "DMSans-700.ttf"), 44)
    small = ImageFont.truetype(os.path.join(fonts, "DMSans-700.ttf"), 30)
    draw.text((80, 300), event.event_name.upper(), font=title, fill=(245, 245, 245))
    draw.text((84, 450), line2, font=sub, fill=(34, 163, 90))
    draw.text((84, 690), "AFRICAN FREE FIRE COMMUNITY", font=small, fill=(150, 156, 160))
    # One file per event: earlier takes left lagos-clash-cup_<random>.jpg copies behind.
    folder = os.path.join(settings.MEDIA_ROOT, "event_banner")
    if os.path.isdir(folder):
        for name in os.listdir(folder):
            if name.startswith(event.slug):
                os.remove(os.path.join(folder, name))
    buf = _io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    event.event_banner.save(f"{event.slug}.jpg", ContentFile(buf.getvalue()), save=True)


def tournament(name, slug, **extra):
    fields = dict(
        competition_type="tournament", participant_type="squad", event_type="internal",
        max_teams_or_players=16, event_name=name, slug=slug, event_mode="virtual",
        start_date=day(5), end_date=day(6), registration_open_date=day(-2), registration_end_date=day(4),
        # No money on frame (owner, 12 Oct 2026: "i dont want fake money to be showing on the website"):
        # the prize is a trophy, never an invented amount. prizepool is required and printed as written.
        prizepool="Trophy", event_rules="Standard AFC tournament rules.", event_status="upcoming",
        registration_link="https://africanfreefirecommunity.com", number_of_stages=1,
        is_public=True, is_draft=False)
    fields.update(extra)
    return Event.objects.create(**fields)


# ── clip 2: Kofi makes a team and invites Ama ────────────────────────────────────────────────────
def team_invite():
    season()
    player("KofiPlays", "Kofi Mensah", "2104567311")
    player("AmaPlays", "Ama Owusu", "2104567322")
    print("seed team-invite: KofiPlays and AmaPlays, no team, window open")


# ── clip 3: Kofi's team registers for an open tournament ────────────────────────────────────────
def register_tournament():
    season()
    kofi = player("KofiPlays", "Kofi Mensah", "2104567311")
    mates = [player("AmaPlays", "Ama Owusu", "2104567322"), player("YawPlays", "Yaw Boateng", "2104567333"),
             player("EsiPlays", "Esi Addo", "2104567344")]
    team("Accra Hawks", "ACH", kofi, mates)
    banner(tournament("Lagos Clash Cup", "lagos-clash-cup"), "SQUADS   REGISTRATION OPEN")
    print("seed register-tournament: Accra Hawks (4 players), Lagos Clash Cup open for registration")


# ── clip 4: an organizer enters a map's results ─────────────────────────────────────────────────
def organizer_results():
    season()
    tolu = player("ToluHost", "Tolu Adeyemi", "2104567400", country="Nigeria")
    org = Organization.objects.create(slug="lagos-esports-hub", name="Lagos Esports Hub",
                                      description="Weekly Free Fire tournaments in Lagos.")
    OrganizationMember.objects.create(
        organization=org, user=tolu, role="owner", status="active", can_create_events=True,
        can_edit_events=True, can_upload_results=True, can_manage_registrations=True,
        can_submit_designs=True, can_view_metrics=True, can_view_reviews=True, can_manage_members=True,
        can_answer_support=True)
    role, _ = Roles.objects.get_or_create(role_name="organizer", defaults={"description": "Organizer"})
    UserRoles.objects.get_or_create(user=tolu, role=role)

    event = tournament("Lagos Clash Cup", "lagos-clash-cup", organization=org, creator=tolu,
                       event_status="ongoing", start_date=day(0), end_date=day(1),
                       registration_open_date=day(-10), registration_end_date=day(-1))
    banner(event, "SQUADS   GROUP STAGE TODAY")
    stage = Stages.objects.create(event=event, stage_name="Group Stage", start_date=day(0), end_date=day(0),
                                  number_of_groups=1, stage_format="br", teams_qualifying_from_stage=2,
                                  stage_status="ongoing")
    group = StageGroups.objects.create(stage=stage, group_name="Group A", playing_date=day(0),
                                       playing_time="18:00", teams_qualifying=2, match_count=2,
                                       match_maps=["bermuda", "kalahari"])
    Match.objects.create(group=group, match_number=1, match_map="bermuda")
    Match.objects.create(group=group, match_number=2, match_map="kalahari")

    rosters = [
        ("Accra Hawks", "ACH", "Ghana", [("KofiPlays", "Kofi Mensah"), ("AmaPlays", "Ama Owusu"),
                                         ("YawPlays", "Yaw Boateng"), ("EsiPlays", "Esi Addo")]),
        ("Lagos Lions", "LGL", "Nigeria", [("Chidi_FF", "Chidi Okafor"), ("BisiFF", "Bisi Lawal"),
                                           ("EmekaFF", "Emeka Obi"), ("NgoziFF", "Ngozi Eze")]),
        ("Nairobi Storm", "NRS", "Kenya", [("WanjiruFF", "Wanjiru Kamau"), ("OtienoFF", "Otieno Odhiambo"),
                                           ("AchiengFF", "Achieng Atieno"), ("KipFF", "Kip Rotich")]),
        ("Kumasi Kings", "KMK", "Ghana", [("KwameFF", "Kwame Asante"), ("AbenaFF", "Abena Badu"),
                                          ("KojoFF", "Kojo Frimpong"), ("AkuaFF", "Akua Sarpong")]),
    ]
    uid = 2104568000
    for name, tag, country, people in rosters:
        users = []
        for username, full in people:
            uid += 1
            users.append(player(username, full, str(uid), country=country))
        t = team(name, tag, users[0], users[1:], country=country)
        tt = TournamentTeam.objects.create(event=event, team=t, status="active")
        for u in users:
            TournamentTeamMember.objects.create(tournament_team=tt, user=u, event=event, status="active")
        StageGroupCompetitor.objects.create(stage_group=group, tournament_team=tt)

    Leaderboard.objects.create(
        leaderboard_name="Group A", event=event, stage=stage, group=group, creator=tolu,
        placement_points={"1": 12, "2": 9, "3": 8, "4": 7, "5": 6, "6": 5, "7": 4, "8": 3,
                          "9": 2, "10": 1, "11": 0, "12": 0},
        kill_point=1.0, leaderboard_method="manual")
    print("seed organizer-results: Lagos Esports Hub, Tolu, Lagos Clash Cup Group A with 4 teams, 2 maps")


SCENARIOS = {
    "": lambda: print("seed: nothing to add for clip 1"),
    "signup-discord": lambda: print("seed: nothing to add for clip 1"),
    "team-invite": team_invite,
    "register-tournament": register_tournament,
    "organizer-results": organizer_results,
}
SCENARIOS[SCENARIO]()
