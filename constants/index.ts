export const countries = [
  "Algeria",
  "Angola",
  "Benin",
  "Botswana",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cameroon",
  "Central African Republic",
  "Chad",
  "Comoros",
  "Congo (Brazzaville)",
  "Congo (Kinshasa)",
  "Côte d’Ivoire",
  "Djibouti",
  "Egypt",
  "Equatorial Guinea",
  "Eritrea",
  "Eswatini",
  "Ethiopia",
  "Gabon",
  "Gambia",
  "Ghana",
  "Guinea",
  "Guinea-Bissau",
  "Kenya",
  "Lesotho",
  "Liberia",
  "Libya",
  "Madagascar",
  "Malawi",
  "Mali",
  "Mauritania",
  "Mauritius",
  "Morocco",
  "Mozambique",
  "Namibia",
  "Niger",
  "Nigeria",
  "Rwanda",
  "São Tomé and Príncipe",
  "Senegal",
  "Seychelles",
  "Sierra Leone",
  "Somalia",
  "South Africa",
  "South Sudan",
  "Sudan",
  "Tanzania",
  "Togo",
  "Tunisia",
  "Uganda",
  "Zambia",
  "Zimbabwe",
] as const;

export const DEFAULT_PROFILE_PICTURE =
  "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg";

export const newsCategories = [
  { value: "general", label: "General News" },
  { value: "tournament", label: "Tournament Updates" },
  { value: "bans", label: "Banned Player/Team Updates" },
  // { value: "maintenance", label: "Maintenance Updates" },
  // { value: "events", label: "Event Announcements" },
];

export const relatedEvents = [
  { value: "event1", label: "Summer Showdown 2024" },
  { value: "event2", label: "Fall Classic 2024" },
  { value: "event3", label: "Winter Cup 2024" },
  { value: "event4", label: "Spring Championship 2025" },
];

export const availableBanReasons = [
  {
    id: "conduct",
    label: "Conduct/Toxic Behavior",
    description:
      "Repeated instances of abusive language, harassment, or unsportsmanlike conduct",
  },
  {
    id: "cheating",
    label: "Cheating",
    description:
      "Use of unauthorized software, exploits, or other forms of cheating",
  },
  {
    id: "collusion",
    label: "Collusion",
    description:
      "Cooperating with other teams or players to gain an unfair advantage",
  },
  {
    id: "account_sharing",
    label: "Account Sharing",
    description:
      "Multiple players using the same account or a player using someone else's account",
  },
  {
    id: "confidentiality",
    label: "Breach of Confidentiality",
    description:
      "Sharing confidential information about tournaments, scrims, or other teams",
  },
];
