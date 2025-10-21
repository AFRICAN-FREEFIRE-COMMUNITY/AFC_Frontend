// Base interfaces
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Dashboard interfaces
export interface DashboardStats {
  totalPlayers: number;
  totalTeams: number;
  activeEvents: number;
  totalMatches: number;
  recentRegistrations: number;
  pendingApprovals: number;
}

export interface RecentActivity {
  id: string;
  type: 'player_registration' | 'team_creation' | 'match_result' | 'event_creation';
  description: string;
  timestamp: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface AnalyticsData {
  period: string;
  playerGrowth: number[];
  teamGrowth: number[];
  eventParticipation: number[];
  labels: string[];
}

// Event interfaces
export interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  endDate?: string;
  format: 'Battle Royale' | 'Clash Squad' | 'Hybrid';
  type: 'tournament' | 'scrim';
  status: 'Planning' | 'Registration Open' | 'Ongoing' | 'Completed' | 'Cancelled';
  maxTeams: number;
  registeredTeams: number;
  prizePool?: number;
  rules?: string;
  image?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventFilters extends PaginationParams {
  format?: string;
  type?: string;
  status?: string;
}

// Team interfaces
export interface Team {
  id: string;
  name: string;
  tag: string;
  logo?: string;
  description?: string;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  status: 'Active' | 'Inactive' | 'Suspended';
  captain: {
    id: string;
    name: string;
    inGameName: string;
  };
  members: TeamMember[];
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
    totalKills: number;
    averageKills: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  playerId: string;
  playerName: string;
  inGameName: string;
  role: 'Captain' | 'Player' | 'Substitute';
  joinedAt: string;
  status: 'Active' | 'Inactive';
}

export interface TeamFilters extends PaginationParams {
  tier?: string;
  status?: string;
  country?: string;
}

// Player interfaces
export interface Player {
  id: string;
  fullName: string;
  inGameName: string;
  uid: string;
  email: string;
  country: string;
  profilePic?: string;
  team?: {
    id: string;
    name: string;
    tag: string;
  };
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  status: 'Active' | 'Inactive' | 'Banned';
  banReason?: string;
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    kills: number;
    deaths: number;
    kd: number;
    mvps: number;
    finalsAppearances: number;
    points: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PlayerFilters extends PaginationParams {
  team?: string;
  country?: string;
  tier?: string;
  status?: string;
}

// News interfaces
export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  image?: string;
  category: 'tournament-updates' | 'team-news' | 'rankings' | 'general' | 'announcements';
  status: 'draft' | 'published' | 'archived';
  author: {
    id: string;
    username: string;
    name: string;
  };
  event?: {
    id: string;
    name: string;
  };
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewsFilters extends PaginationParams {
  category?: string;
  status?: string;
  author?: string;
}

// Leaderboard interfaces
export interface Leaderboard {
  id: string;
  name: string;
  event: {
    id: string;
    name: string;
  };
  type: 'overall' | 'kills' | 'placement';
  stage: string;
  group?: string;
  status: 'draft' | 'active' | 'finalized';
  teams: LeaderboardTeam[];
  pointSystem: PointSystem;
  createdAt: string;
  updatedAt: string;
}

export interface LeaderboardTeam {
  teamId: string;
  teamName: string;
  teamLogo?: string;
  position: number;
  points: number;
  kills: number;
  placement: number;
  matches: LeaderboardMatch[];
}

export interface LeaderboardMatch {
  matchId: string;
  matchNumber: number;
  kills: number;
  placement: number;
  points: number;
}

export interface PointSystem {
  placementPoints: { [key: number]: number };
  killPoints: number;
  bonusPoints?: { [key: string]: number };
}

// Ranking interfaces
export interface Ranking {
  id: string;
  name: string;
  type: 'player' | 'team';
  description: string;
  metrics: RankingMetric[];
  status: 'active' | 'inactive';
  lastCalculated: string;
  createdAt: string;
  updatedAt: string;
}

export interface RankingMetric {
  id: string;
  name: string;
  description: string;
  weight: number;
  calculation: string;
  isActive: boolean;
}

// Tier interfaces
export interface Tier {
  id: string;
  name: string;
  description: string;
  color: string;
  minPoints: number;
  maxPoints: number;
  benefits: string[];
  requirements: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Shop interfaces
export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'weapons' | 'characters' | 'emotes' | 'bundles';
  image: string;
  stock: number;
  isActive: boolean;
  isLimited: boolean;
  limitedUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopOrder {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  items: ShopOrderItem[];
  total: number;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopOrderItem {
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  isGift: boolean;
  giftEmail?: string;
}

// Infraction interfaces
export interface Infraction {
  id: string;
  type: 'warning' | 'suspension' | 'ban' | 'disqualification';
  reason: string;
  description: string;
  player: {
    id: string;
    name: string;
    inGameName: string;
  };
  team?: {
    id: string;
    name: string;
  };
  event?: {
    id: string;
    name: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'appealed' | 'overturned';
  duration?: number; // in days
  expiresAt?: string;
  issuedBy: {
    id: string;
    name: string;
  };
  appeal?: {
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    submittedAt: string;
    reviewedBy?: string;
    reviewedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Draft interfaces
export interface Draft {
  id: string;
  type: 'news' | 'event' | 'announcement';
  title: string;
  content: any; // JSON content
  author: {
    id: string;
    name: string;
  };
  status: 'draft' | 'review' | 'approved' | 'rejected';
  scheduledFor?: string;
  createdAt: string;
  updatedAt: string;
}

// History interfaces
export interface AdminHistory {
  id: string;
  action: string;
  description: string;
  user: {
    id: string;
    name: string;
    role: string;
  };
  target?: {
    type: string;
    id: string;
    name: string;
  };
  metadata?: any;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

// Match Result interfaces
export interface MatchResult {
  id: string;
  event: {
    id: string;
    name: string;
  };
  matchNumber: number;
  teams: MatchTeamResult[];
  status: 'pending' | 'approved' | 'rejected';
  submittedBy: {
    id: string;
    name: string;
  };
  reviewedBy?: {
    id: string;
    name: string;
  };
  rejectionReason?: string;
  evidence?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MatchTeamResult {
  teamId: string;
  teamName: string;
  placement: number;
  kills: number;
  points: number;
  players: MatchPlayerResult[];
}

export interface MatchPlayerResult {
  playerId: string;
  playerName: string;
  kills: number;
  damage: number;
  survival: number;
}

// Upload interfaces
export interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  url: string;
  type: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
}

// Partner interfaces
export interface RosterVerification {
  teamId: string;
  teamName: string;
  tournament: string;
  roster: RosterPlayer[];
  status: 'pending' | 'verified' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

export interface RosterPlayer {
  playerId: string;
  playerName: string;
  inGameName: string;
  uid: string;
  role: 'Captain' | 'Player' | 'Substitute';
  isEligible: boolean;
  eligibilityReason?: string;
}