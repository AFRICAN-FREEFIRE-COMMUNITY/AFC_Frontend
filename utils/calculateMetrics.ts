type MoneyRange = {
  min: number
  max: number | null
  points: number
}

type KillsRange = {
  min: number
  max: number | null
  points: number
}

type SocialMediaRange = {
  min: number
  max: number | null
  points: number
}

const MONEY_RANGES: MoneyRange[] = [
  { min: 0, max: 100000, points: 5 },
  { min: 101000, max: 300000, points: 10 },
  { min: 301000, max: 500000, points: 15 },
  // ... add all ranges
]

const KILLS_RANGES: KillsRange[] = [
  { min: 0, max: 100, points: 1 },
  { min: 101, max: 300, points: 3 },
  { min: 301, max: 500, points: 5 },
  // ... add all ranges
]

const SOCIAL_MEDIA_RANGES: SocialMediaRange[] = [
  { min: 0, max: 500, points: 1 },
  { min: 501, max: 1000, points: 2 },
  { min: 1001, max: 2500, points: 5 },
  // ... add all ranges
]

export function calculateTierPoints(data: {
  tournamentWins: number
  moneyEarned: number
  kills: number
  placements: number[]
  finalsAppearances: number
  socialMedia: {
    instagramFollowers: number
    instagramPosts: number
    tiktokFollowers: number
    tiktokLikes: number
    tiktokPosts: number
  }
  scrims: {
    wins: number
    kills: number
    placements: number[]
  }
}) {
  let points = 0

  // Tournament Wins
  points += data.tournamentWins * 20

  // Money Earned
  const moneyRange = MONEY_RANGES.find(
    (range) => data.moneyEarned >= range.min && (range.max === null || data.moneyEarned <= range.max),
  )
  if (moneyRange) points += moneyRange.points

  // Tournament Kills
  const killsRange = KILLS_RANGES.find(
    (range) => data.kills >= range.min && (range.max === null || data.kills <= range.max),
  )
  if (killsRange) points += killsRange.points

  // Placements
  data.placements.forEach((placement) => {
    if (placement === 1) points += 0.5
    else if (placement === 2) points += 0.4
    else if (placement === 3) points += 0.3
    else if (placement <= 6) points += 0.2
    else if (placement <= 12) points += 0.1
  })

  // Finals Appearances
  points += data.finalsAppearances * 5

  // Social Media
  const socialMetrics = [
    data.socialMedia.instagramFollowers,
    data.socialMedia.instagramPosts,
    data.socialMedia.tiktokFollowers,
    data.socialMedia.tiktokLikes,
    data.socialMedia.tiktokPosts,
  ]

  socialMetrics.forEach((metric) => {
    const range = SOCIAL_MEDIA_RANGES.find(
      (range) => metric >= range.min && (range.max === null || metric <= range.max),
    )
    if (range) points += range.points
  })

  // Scrims
  points += data.scrims.wins * 0.5

  const scrimKillsRange = KILLS_RANGES.find(
    (range) => data.scrims.kills >= range.min && (range.max === null || data.scrims.kills <= range.max),
  )
  if (scrimKillsRange) points += scrimKillsRange.points * 0.5

  data.scrims.placements.forEach((placement) => {
    if (placement === 1) points += 0.2
    else if (placement === 2) points += 0.15
    else if (placement === 3) points += 0.1
    else if (placement <= 6) points += 0.05
    else if (placement <= 12) points += 0.02
  })

  return {
    points,
    tier: points >= 70 ? 1 : points >= 50 ? 2 : 3,
  }
}

export function calculatePlayerRanking(data: {
  tournamentKills: number
  mvps: number
  finalsAppearances: number
  teamWins: number
  scrimKills: number
  scrimWins: number
}) {
  let points = 0

  // Tournament Kills
  const killsRange = KILLS_RANGES.find(
    (range) => data.tournamentKills >= range.min && (range.max === null || data.tournamentKills <= range.max),
  )
  if (killsRange) points += killsRange.points

  // MVPs
  points += data.mvps * 5

  // Finals Appearances
  points += data.finalsAppearances * 3

  // Team Wins
  points += data.teamWins * 20

  // Scrim Kills
  const scrimKillsRange = KILLS_RANGES.find(
    (range) => data.scrimKills >= range.min && (range.max === null || data.scrimKills <= range.max),
  )
  if (scrimKillsRange) points += scrimKillsRange.points

  // Scrim Wins
  points += data.scrimWins * 0.5

  return points
}
