// Glossary content for the user-facing /glossary page.
// Authored + fact-checked against Free Fire / esports references (Liquipedia, Free Fire Wiki,
// esportsinsider, britishesports) so newcomers to esports can decode the platform.
// Consumed by: app/(user)/glossary/page.tsx (search + category filter render).
// Keep definitions short, plain, and beginner-friendly. No em dashes or en dashes (house rule).

export type GlossaryCategory =
  | "Getting Started"
  | "Game Modes"
  | "Competitive Formats"
  | "Team Roles"
  | "In-Game Terms"
  | "Scoring"
  | "Esports Business";

export interface GlossaryTerm {
  term: string;
  category: GlossaryCategory;
  definition: string;
  also?: string; // optional "also known as" / short form
}

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  "Getting Started",
  "Game Modes",
  "Competitive Formats",
  "Team Roles",
  "In-Game Terms",
  "Scoring",
  "Esports Business",
];

export const GLOSSARY: GlossaryTerm[] = [
  // ── Getting Started ──────────────────────────────────────────────
  {
    term: "Esports",
    category: "Getting Started",
    definition:
      "Short for electronic sports. Organized, competitive video gaming where players or teams face off in matches and tournaments, often for rankings, prizes, and recognition.",
    also: "electronic sports",
  },
  {
    term: "Free Fire",
    category: "Getting Started",
    definition:
      "Garena Free Fire, the mobile battle royale game this community competes in. Matches drop players onto a map where they fight to be the last team standing.",
    also: "FF",
  },
  {
    term: "UID",
    category: "Getting Started",
    definition:
      "Your Unique ID, the number that identifies your Free Fire account. Add it to your AFC profile so teams, organizers, and tournaments can verify and find you.",
    also: "Unique ID",
  },
  {
    term: "IGN",
    category: "Getting Started",
    definition:
      "In-Game Name, the display name other players see in Free Fire. It can differ from your real name and from your AFC username.",
    also: "in-game name",
  },
  {
    term: "Profile",
    category: "Getting Started",
    definition:
      "Your AFC page. Fill in your UID, in-game name, country, and role so you show up correctly in teams, the player market, and event rosters.",
  },
  {
    term: "Roster",
    category: "Getting Started",
    definition:
      "The list of players that make up a team. A competitive squad is usually four players plus one or more substitutes.",
  },

  // ── Game Modes ───────────────────────────────────────────────────
  {
    term: "Battle Royale",
    category: "Game Modes",
    definition:
      "The main Free Fire mode. Many squads drop onto one large map, loot for weapons, and fight as a shrinking safe zone forces everyone together until one team remains.",
    also: "BR",
  },
  {
    term: "Clash Squad",
    category: "Game Modes",
    definition:
      "A fast 4 versus 4 mode played in short rounds on a small map, with players buying weapons each round. The first team to win the set number of rounds takes the match.",
    also: "CS",
  },
  {
    term: "Booyah",
    category: "Game Modes",
    definition:
      "The word Free Fire shows when you win a match. Used as a verb too: to Booyah a game is to win it.",
  },
  {
    term: "Bermuda",
    category: "Game Modes",
    definition:
      "The classic and most-played Free Fire battle royale map, common in competitive play. Other maps include Purgatory, Kalahari, Alpine, and Nexterra.",
  },
  {
    term: "Lobby",
    category: "Game Modes",
    definition:
      "The pre-match room where players gather before a game starts. A custom room or custom lobby is a private match an organizer sets up for scrims or tournaments.",
    also: "custom room",
  },

  // ── Competitive Formats ──────────────────────────────────────────
  {
    term: "Scrims",
    category: "Competitive Formats",
    definition:
      "Practice matches (short for scrimmages). Teams play simulated games to test strategies, drill rotations, and build teamwork before official tournaments. Results are for training, not titles.",
    also: "scrimmages",
  },
  {
    term: "Tournament",
    category: "Competitive Formats",
    definition:
      "An official competition with a set format, schedule, and usually prizes or ranking points. Teams register, then play through stages toward a final.",
  },
  {
    term: "Group Stage",
    category: "Competitive Formats",
    definition:
      "An early phase that splits teams into groups. Teams play within their group and the top finishers advance to the next stage.",
  },
  {
    term: "Finals",
    category: "Competitive Formats",
    definition:
      "The last stage of a tournament, where the best qualified teams play for the title and top prizes. A grand final is the deciding series.",
  },
  {
    term: "Bracket",
    category: "Competitive Formats",
    definition:
      "The chart that maps out which teams play whom and how winners advance. Common types are single elimination, double elimination, and round robin.",
  },
  {
    term: "Seeding",
    category: "Competitive Formats",
    definition:
      "How teams are placed into groups or a bracket, usually by rank or past results, so the strongest teams do not meet too early.",
  },
  {
    term: "Single Elimination",
    category: "Competitive Formats",
    definition:
      "A knockout bracket. Lose once and you are out. Fast, but one bad game ends your run.",
  },
  {
    term: "Double Elimination",
    category: "Competitive Formats",
    definition:
      "A bracket with a winners side and a losers side. A team must lose twice to be eliminated, giving a second chance after one defeat.",
  },
  {
    term: "Round Robin",
    category: "Competitive Formats",
    definition:
      "A format where every team plays every other team in the group. Standings come from total points across all matches.",
  },
  {
    term: "Swiss",
    category: "Competitive Formats",
    definition:
      "A format that pairs teams with similar records each round, without knocking anyone out early. Teams advance once they hit a target number of wins.",
  },
  {
    term: "Qualifier",
    category: "Competitive Formats",
    definition:
      "An early competition that decides which teams earn a slot in a bigger event. Open qualifiers are usually free to enter.",
  },
  {
    term: "LAN",
    category: "Competitive Formats",
    definition:
      "A Local Area Network event, meaning players compete in person at one venue on a shared local network. The opposite of an online or remote event.",
    also: "in person event",
  },
  {
    term: "Point Rush",
    category: "Competitive Formats",
    definition:
      "A format where points carry forward and a team can clinch by reaching a target score, so a strong run can end the stage early.",
  },

  // ── Team Roles ───────────────────────────────────────────────────
  {
    term: "IGL",
    category: "Team Roles",
    definition:
      "In-Game Leader, the team's shotcaller and strategist. Decides when to rotate, which fights to take, and how to play the final zones.",
    also: "In-Game Leader, shotcaller",
  },
  {
    term: "Rusher",
    category: "Team Roles",
    definition:
      "The aggressive entry fragger who pushes enemies and wins close-range fights. Usually the most mechanically skilled player on the squad.",
    also: "attacker, entry fragger",
  },
  {
    term: "Sniper",
    category: "Team Roles",
    definition:
      "The long-range specialist who picks off enemies from distance and watches open ground, often holding angles while teammates rotate.",
  },
  {
    term: "Grenadier",
    category: "Team Roles",
    definition:
      "The utility and explosives expert. Uses grenades and tools like the Gloo Melter to flush enemies out of cover and break defenses so rushers can push.",
    also: "nader",
  },
  {
    term: "Support",
    category: "Team Roles",
    definition:
      "The teammate who covers, heals, revives, drops utility, and trades fights to keep the squad alive. Plays for the team rather than for personal kills.",
  },
  {
    term: "Substitute",
    category: "Team Roles",
    definition:
      "A backup player on the roster who steps in when a starter cannot play. Often called a sub or stand-in.",
    also: "sub, stand-in",
  },
  {
    term: "Coach",
    category: "Team Roles",
    definition:
      "The person who trains the team, reviews matches, plans strategy, and prepares the squad for opponents. Usually not one of the five players in game.",
  },
  {
    term: "Manager",
    category: "Team Roles",
    definition:
      "The person who handles a team's off-game business: scheduling, registrations, contracts, communication, and logistics.",
  },

  // ── In-Game Terms ────────────────────────────────────────────────
  {
    term: "Gloo Wall",
    category: "In-Game Terms",
    definition:
      "A throwable that creates an instant wall of cover. Teams use it to block enemy fire, reload, heal, revive, or cover a rotation.",
  },
  {
    term: "Rotation",
    category: "In-Game Terms",
    definition:
      "Moving the squad from one position to the next, usually to stay inside the safe zone or to take better ground. Good rotations decide most battle royale games.",
  },
  {
    term: "Zone",
    category: "In-Game Terms",
    definition:
      "The shrinking safe area on the map. Staying inside keeps you safe; the area outside (the gas or storm) drains your health.",
    also: "safe zone, circle",
  },
  {
    term: "Knock",
    category: "In-Game Terms",
    definition:
      "To down an enemy so they are crawling and need a teammate to revive them. A knocked player who is not revived in time is eliminated.",
    also: "knockdown, down",
  },
  {
    term: "Revive",
    category: "In-Game Terms",
    definition:
      "Bringing a knocked teammate back into the fight before their timer runs out.",
  },
  {
    term: "Third Party",
    category: "In-Game Terms",
    definition:
      "Jumping in on two teams already fighting each other, then cleaning up both while they are weak.",
  },
  {
    term: "Camp",
    category: "In-Game Terms",
    definition:
      "Holding a fixed position, often in cover or a building, to defend ground or wait for enemies rather than pushing.",
  },
  {
    term: "Loadout",
    category: "In-Game Terms",
    definition:
      "The set of weapons, utility, and items a player carries, such as a rifle plus a shotgun, grenades, and Gloo Walls.",
  },
  {
    term: "Ping",
    category: "In-Game Terms",
    definition:
      "The delay between your device and the game server, measured in milliseconds. High ping (lag) makes the game feel slow or jumpy.",
    also: "lag",
  },

  // ── Scoring ──────────────────────────────────────────────────────
  {
    term: "Placement Points",
    category: "Scoring",
    definition:
      "Points a team earns based on where it finishes in a battle royale match. Higher placement means more points. Set by the event's point system.",
  },
  {
    term: "Kill Points",
    category: "Scoring",
    definition:
      "Points earned per elimination. A common setup gives one point per kill, added on top of placement points.",
    also: "elimination points",
  },
  {
    term: "WWCD",
    category: "Scoring",
    definition:
      "Winner Winner Chicken Dinner, a battle royale phrase for finishing first in a match. In Free Fire the win screen says Booyah.",
  },
  {
    term: "MVP",
    category: "Scoring",
    definition:
      "Most Valuable Player, the standout performer of a match or event, often the player with the biggest impact rather than just the most kills.",
  },
  {
    term: "Tiebreaker",
    category: "Scoring",
    definition:
      "The rule used to separate teams level on points, for example most wins, then most kills, then best last-match placement.",
  },

  // ── Esports Business ─────────────────────────────────────────────
  {
    term: "Organization",
    category: "Esports Business",
    definition:
      "An esports org is the brand that owns and runs one or more teams, handling sponsors, salaries, branding, and operations. On AFC, organizers can host their own events.",
    also: "org",
  },
  {
    term: "Sponsor",
    category: "Esports Business",
    definition:
      "A brand that funds a team or event in exchange for exposure. Sponsorships are a core way esports organizations and tournaments make money.",
  },
  {
    term: "Prize Pool",
    category: "Esports Business",
    definition:
      "The total money or rewards shared among the top finishers of a tournament, split by a prize distribution that is set before the event.",
  },
  {
    term: "Payout",
    category: "Esports Business",
    definition:
      "The actual money paid to a team or player from a prize pool or contract after an event finishes.",
  },
  {
    term: "Free Agent",
    category: "Esports Business",
    definition:
      "A player not signed to any team, free to join a new roster. The player market is where free agents and recruiting teams find each other.",
  },
  {
    term: "Transfer Window",
    category: "Esports Business",
    definition:
      "A set period when teams are allowed to sign, swap, or release players. Outside the window, rosters are usually locked.",
  },
  {
    term: "Bootcamp",
    category: "Esports Business",
    definition:
      "An intense training block, often with the team living and practicing together, to sharpen teamwork and strategy before a major tournament.",
  },
  {
    term: "Slot",
    category: "Esports Business",
    definition:
      "A reserved spot for a team in an event or league. Teams earn a slot by invite, by ranking, or by winning a qualifier.",
  },
  {
    term: "Tier",
    category: "Esports Business",
    definition:
      "A level of competition or ranking. On AFC, events carry a tier and teams are sorted into tiers that reflect how strong they are.",
  },
  {
    term: "Promotion and Relegation",
    category: "Esports Business",
    definition:
      "A system where top teams move up to a higher division (promotion) and bottom teams drop to a lower one (relegation) between seasons.",
  },
  {
    term: "Caster",
    category: "Esports Business",
    definition:
      "A commentator who narrates a match live for viewers, explaining the action and the strategy. Also called a shoutcaster.",
    also: "shoutcaster, commentator",
  },
  {
    term: "Ghost Team",
    category: "Esports Business",
    definition:
      "A placeholder team or player record AFC creates for an entity not yet on the platform, so their results still count. The real team can later claim it to inherit the history and ranking.",
    also: "ghost player",
  },
];
