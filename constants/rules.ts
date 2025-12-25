import {
  IconAlertCircle,
  IconChartBar,
  IconCircleCheck,
  IconDeviceMobile,
  IconFileCheck,
  IconGavel,
  IconMessageExclamation,
  IconScale,
  IconTrophy,
  IconUsers,
} from "@tabler/icons-react";

export const AFC_RULES_DATA = [
  {
    id: "player-eligibility",
    category: "Player Eligibility & Requirements",
    description:
      "Core requirements for player participation including account, age, and regional criteria.",
    icon: IconUsers,
    rules: [
      {
        title: "Account Requirements",
        content:
          "Players must own an active FreeFire account achieving a minimal level of 20 at the Platinum IV ranking. In-game names cannot be changed during tournaments unless authorized by moderators - violations are treated as using an unregistered player. Players must operate official FreeFire accounts at or above set rank and level milestones, with any name changes requiring communication and authorization from tournament officials.",
        citations: "[General Rules 2.1, Player Rules 3.1]",
      },
      {
        title: "Age Requirements",
        content:
          "Participants must be at least 16 years old as defined by tournament regulation. For LAN events, underage participants must possess parental consent.",
        citations: "[General Rules 2.1]",
      },
      {
        title: "Regional Eligibility",
        content:
          "Only players whose accounts are registered in tournament-approved regions can compete. For Nigerian-specific tournaments, only players of Nigerian nationality may participate. Each team may include only one player of Nigerian nationality residing outside Nigeria.",
        citations: "[General Rules 2.1]",
      },
      {
        title: "Account Integrity and Security",
        content:
          "Sharing of personal game accounts is strictly forbidden, including among teammates. Each player is expected to maintain sole control and responsibility for their account to ensure fair play and accountability.",
        citations: "[Player Rules 3.4]",
      },
      {
        title: "Multiple Team Restriction",
        content:
          "Players may not play for or contract with more than one team at a time. This applies to both tournament and scrim participation.",
        citations: "[Code of Conduct 2.3, Game Participation 3.2]",
      },
    ],
  },
  {
    id: "team-registration",
    category: "Team Registration & Roster Management",
    description:
      "Guidelines for team formation, registration processes, and roster submissions.",
    icon: IconFileCheck,
    rules: [
      {
        title: "Registration Process",
        content:
          "Teams are required to register via the designated official platform within the assigned time frame. Registration must include full roster details consisting of starting players and substitutes. Teams must register on the official AFC website at www.africanfreefirecommunity.com. Only teams listed on the website are eligible for participation.",
        citations: "[Team Registration 2.2, AFC Metrics Doc Section 10.1-10.2]",
      },
      {
        title: "Roster Submission Requirements",
        content:
          "Comprehensive team information must be accurate. Fees may be applicable for certain registration particulars or amendments. Teams must register initial rosters, including all starters and substitutes, before an official competition begins using tools provided by tournament officials.",
        citations: "[Team Registration 2.2, Team Regulations 4.2]",
      },
      {
        title: "Social Media Requirements",
        content:
          "Teams are required to have a team Instagram account (not a personal account of one person) and must follow tournament sponsors and organizers on social media.",
        citations: "[Team Regulations 4.2]",
      },
      {
        title: "Contract Submission Mandate",
        content:
          "Teams registering for tournaments must have contracts with all players submitted to the organizer and stored in the database. All contracts must be submitted via the AFC's Discord Contract Submission Channel.",
        citations: "[Team Regulations 4.2, Contract Guidelines Section 2.1]",
      },
      {
        title: "Player Database Registration",
        content:
          "All teams and players must be registered in the tournament's official player/team database before participation.",
        citations: "[Game Participation 3.2]",
      },
    ],
  },
  {
    id: "code-of-conduct",
    category: "Code of Conduct & Player Behavior",
    description:
      "Standards of sportsmanship, prohibited behaviors, and professional interaction guidelines.",
    icon: IconScale,
    rules: [
      {
        title: "Player Conduct Standards",
        content:
          "Participants must exhibit behavior reflecting sportsmanship and adhere to integrity standards. Players must maintain a healthy lifestyle and play to the best of their ability. Disrespectful behavior towards officials or use of offensive language can result in penalties, typically in the form of point deductions or bans.",
        citations: "[Code of Conduct 2.3, Conduct Standards 3.3]",
      },
      {
        title: "Prohibited Behaviors - Cheating",
        content:
          "Cheating, stream sniping, using VPNs, and forming alliances with other competitors for unfair advantage (collusion) are strictly prohibited. Use of unauthorized software, including emulators and hacking tools, will lead to immediate disqualification. Use of hacks by any team member results in major offense penalties.",
        citations:
          "[Code of Conduct 2.3, Conduct Standards 3.3, Disciplinary 6.1]",
      },
      {
        title: "Scandal Management and Reputation Standards",
        content:
          "Players must maintain the highest standards of personal conduct both within and outside of esports activities. Any involvement in scandals, irrespective of the domain, that could potentially harm the reputation of tournament organizers may result in disciplinary measures. The tournament organizers reserve the right to ban the player involved and impose sanctions on their team, should the scandal impact the tournament's integrity or public perception negatively, regardless of the allegations' veracity. Teams who play scrims or other tournaments with sanctioned players will also be banned.",
        citations: "[Conduct Standards 3.3]",
      },
      {
        title: "False Rumor Prohibition",
        content:
          "Players are prohibited from spreading false rumors about fellow players, teams, organizers, or the tournament itself. Such actions undermine the integrity of the competition and warrant sanctions by organizers, which may extend to include penalties against the responsible player's team.",
        citations: "[Conduct Standards 3.3]",
      },
      {
        title: "Defamatory Statements",
        content:
          "Players may not defame any part of the Tournament, participants, or its affiliates. Team members are forbidden from disclosing any confidential or proprietary information shared by the Tournament Organizer. Making defamatory statements is strictly prohibited.",
        citations: "[Conduct Standards 3.3, Communication 3.5]",
      },
      {
        title: "Controlled Substances and Prescription Drugs",
        content:
          "The use, possession, or distribution of controlled substances is strictly prohibited during any tournament-related event. Prescription drugs must only be used as directed.",
        citations: "[Conduct Standards 3.3]",
      },
      {
        title: "Bribery",
        content:
          "Offering or accepting gifts or rewards to influence match outcomes is prohibited and constitutes a major offense.",
        citations: "[Disciplinary 6.1]",
      },
    ],
  },
  {
    id: "game-participation",
    category: "Game Participation & Evidence Requirements",
    description:
      "Protocols for match participation, recording requirements, and submission of game evidence.",
    icon: IconDeviceMobile,
    rules: [
      {
        title: "Game Evidence Submission",
        content:
          "Each team must provide screenshots of their game results when requested by tournament moderators. Teams must also submit full game recordings (not replay recordings) upon request to ensure compliance and fairness. In-game recordings of all players in a team must be available no matter what.",
        citations: "[Game Participation 3.2]",
      },
      {
        title: "Recording Protocol",
        content:
          "Recording must start from the lobby and continue until the team is eliminated. Recording should only end when that team is eliminated from the match.",
        citations: "[Game Participation 3.2, Tournament Rules Doc]",
      },
      {
        title: "Player Readiness",
        content:
          "Players must be logged into the game and positioned in their assigned slots before matches begin. Inactivity or incorrect positioning during this time can result in point forfeiture. Players must remain seated and in-game until the conclusion of the match.",
        citations: "[During Match Conduct 5.3]",
      },
      {
        title: "No Pauses Policy",
        content:
          "No breaks or pauses are permitted during gameplay once initiated, barring exceptional circumstances like network failures or environmental disruptions.",
        citations: "[During Match Conduct 5.3, Tournament Rules Doc]",
      },
      {
        title: "Pre-Match Protocols",
        content:
          "Teams must perform pre-match checks, including network and device validation for LAN events. Issues must be reported immediately to organizers. Players must confirm all settings are correct and complete a checklist to ensure compliance and readiness before match commencement. Before each match, lobby IDs and passwords will be provided through designated channels.",
        citations: "[Pre-Match Checks 5.2]",
      },
    ],
  },
  {
    id: "equipment-technical",
    category: "Equipment & Technical Standards",
    description:
      "Approved devices, prohibited equipment, and technical compliance requirements.",
    icon: IconDeviceMobile,
    rules: [
      {
        title: "Approved Devices",
        content:
          "Participants are required to use handheld devices running Android or iOS operating systems. No other type of device, such as emulators or PCs, is permitted. Use of emulators, PCs, or peripheral adapters (keyboards, mice, controllers) are forbidden.",
        citations: "[Equipment Guidelines 7.1, Technical Conduct 3.4]",
      },
      {
        title: "Prohibited Equipment",
        content:
          "The use of peripheral devices such as adapters, controllers, Bluetooth keyboards, and mice is strictly forbidden unless officially approved by tournament organizers. Unauthorized equipment, including physical/air triggers or any form outside normal game use, will result in a ban.",
        citations: "[Equipment Guidelines 7.1]",
      },
      {
        title: "Supported Accessories",
        content:
          "Players may only bring and use their own headsets or noise-canceling devices, as long as they comply with the tournament's policy.",
        citations: "[Equipment Guidelines 7.1]",
      },
      {
        title: "Unauthorized Technical Tools",
        content:
          "Use of unauthorized equipment, such as non-standard peripherals or devices classified as hacks, is strictly forbidden. Violations may result in disqualification. Installation of external third-party software or usage of browsers during the LAN finale without admin permission constitutes a major offense.",
        citations: "[Technical Conduct 3.4, Disciplinary 6.1]",
      },
      {
        title: "Studio Equipment (LAN Events)",
        content:
          "Tampering with studio equipment at LAN events is not allowed.",
        citations: "[Technical Conduct 3.4]",
      },
    ],
  },
  {
    id: "dress-code",
    category: "Dress Code & Uniform Requirements",
    description:
      "Official uniform standards and appearance requirements for tournament participation.",
    icon: IconUsers,
    rules: [
      {
        title: "Team Uniform Requirements",
        content:
          "All players must wear official team uniforms, including jerseys, jackets, hats, and pants, during public tournament appearances such as LAN events. Uniforms should prominently feature team logos on the front and may include sponsor logos within limits set by organizers. Players are required to wear long pants and closed-toe shoes at tournaments.",
        citations: "[Dress Code 7.2]",
      },
      {
        title: "Competition-Themed Apparel",
        content:
          "If provided, teams may be required to wear official competition-themed apparel for special events and interviews. Failure to comply with dress code requirements can result in temporary use of official competition apparel, with directives to update uniforms by a set deadline.",
        citations: "[Dress Code 7.2]",
      },
      {
        title: "Coaches and Business Attire",
        content:
          "Coaches, when present, should be dressed in business attire or team merchandise at all tournaments and public-facing events.",
        citations: "[Dress Code 7.2]",
      },
      {
        title: "Improper Attire Penalties",
        content:
          "Failure to wear proper attire (e.g., slippers or shorts are not allowed; proper attire mandates closed shoes, trousers, and team jerseys as guided by organizers) constitutes a major offense.",
        citations: "[Disciplinary 6.1]",
      },
      {
        title: "Identity Verification",
        content:
          "Players must not obscure their identity with hats or sunglasses unless it is part of approved team apparel.",
        citations: "[Unauthorized Communications 5.4]",
      },
      {
        title: "Apparel Compliance Authority",
        content:
          "The tournament organizer holds ultimate authority over uniform standards, with the right to refuse entry or participation to any team member failing to adhere to these guidelines.",
        citations: "[Dress Code 7.2]",
      },
    ],
  },
  {
    id: "team-ownership",
    category: "Team Ownership & Management",
    description:
      "Rules governing team ownership, transfers, and management responsibilities.",
    icon: IconGavel,
    rules: [
      {
        title: "Ownership Rights",
        content:
          "The registered Owner(s) of a team retain the sole rights to their team's slot in official competitions, as governed by general and competition-specific rules. Team ownership, including the rights to roster progression in competitions, belongs strictly to the Owner(s), not individual team members.",
        citations: "[Team Ownership 4.1]",
      },
      {
        title: "Ownership Transfers",
        content:
          "Ownership transfers to third parties must be approved in writing by the tournament organizer and require the transferee to adhere to all applicable rules. Any change in ownership requires prior notification and approval.",
        citations: "[Team Ownership 4.1]",
      },
      {
        title: "Team Flipping Policy",
        content:
          "If an Owner sells a team, they may not own a new team for one full Split (competitive season), maintaining competitive integrity.",
        citations: "[Team Ownership 4.1]",
      },
      {
        title: "Ownership Restrictions",
        content:
          "Owners cannot control more than one team per region or more than two teams across all regions, except for specific team categories like Academy or female rosters. Owners must not have stakes in multiple teams unless explicitly permitted by the organizer.",
        citations: "[Team Ownership 4.1]",
      },
      {
        title: "Team Branding Requirements",
        content:
          "Team names and logos must be unique, with any similarities modified for clear distinction.",
        citations: "[Team Ownership 4.1]",
      },
      {
        title: "LAN Tournament Slot Forfeiture",
        content:
          "For LAN tournaments, if a team was not one hundred percent sure they will not be able to attend and did not alert the organizer at least seven (7) days before they were required to show up, then such team will incur heavy penalties. A team will own a slot so far they can make it to the event; if they cannot, the tournament organizer retains the right to give said slot to the next in line available team.",
        citations: "[Team Ownership 4.1]",
      },
    ],
  },
  {
    id: "roster-transfers",
    category: "Roster Changes, Transfers & Player Loans",
    description:
      "Guidelines for roster modifications, transfer windows, and player loan agreements.",
    icon: IconFileCheck,
    rules: [
      {
        title: "Transfer Periods",
        content:
          "Transfer periods are pre-scheduled before the competitive year starts. Exact periods will be announced publicly, allowing roster changes only during these intervals, unless otherwise approved.",
        citations: "[Roster Changes 4.2]",
      },
      {
        title: "Player Loan Policy",
        content:
          "Each team may take on one player on loan from another team during a competitive season. Teams can loan only one player from another team per season. The player must have been registered with the previous team for at least six months before the loan starts. Loans from teams already participating in the current tournament are not permitted.",
        citations:
          "[Roster Changes 4.2, Special Provisions 9.3, Tournament Rules Doc]",
      },
      {
        title: "Loan Duration",
        content:
          "Players on loan must have been registered with their prior team for a minimum of six months before the loan starts, with the contract not exceeding a one-year duration.",
        citations: "[Special Provisions 9.3]",
      },
      {
        title: "Loan Financial Responsibilities",
        content:
          "Borrowing teams must pay a loan fee to the lending team. Borrowing teams are responsible for player salaries and tournament expenses. Players must return to their lending team at the end of the loan period unless otherwise agreed.",
        citations: "[Contract Guidelines 4.2]",
      },
      {
        title: "Mid-Term Recall",
        content:
          "Lending teams may recall players under specific conditions (e.g., injury replacement).",
        citations: "[Contract Guidelines 4.2]",
      },
    ],
  },
  {
    id: "slot-trading",
    category: "Slot Buying & Selling",
    description:
      "Complete framework for tournament slot acquisitions, sales, and transfers.",
    icon: IconCircleCheck,
    rules: [
      {
        title: "Minimum Slot Price",
        content:
          "The minimum price for any tournament slot is set at 50% of the lowest prize pool allocation for the tournament. Example: If the total prize pool is ₦1,000,000 and the last place allocation is ₦100,000, then the minimum slot price is ₦50,000. This ensures slot valuations align with the competitive and financial structure of the tournament.",
        citations: "[Slot Guidelines 5.2.1]",
      },
      {
        title: "AFC Transaction Fee",
        content:
          "AFC charges a 10% transaction fee on sales lower than ₦150,000 and 5% on sales from and higher than ₦150,000 on the slot sale price. This fee supports AFC's community development, infrastructure, and operational costs. Example: For a ₦200,000 slot price, the 10% fee is ₦20,000 to AFC.",
        citations: "[Slot Guidelines 5.2.2]",
      },
      {
        title: "Slot Transfer Timeline",
        content:
          "All slot transfers must be completed at least 3 days before the tournament begins to allow for verification and roster updates. Late transfers will not be approved.",
        citations: "[Slot Guidelines 5.2.3]",
      },
      {
        title: "Slot Resale Restriction",
        content:
          "Purchased slots cannot be resold within 6 months unless explicitly approved by the AFC. This prevents speculative buying and selling of slots.",
        citations: "[Slot Guidelines 5.2.4]",
      },
      {
        title: "Selling Team Responsibilities",
        content:
          "Selling teams must provide accurate information about the slot, including its eligibility, current roster, and outstanding obligations. They must inform AFC of the intended sale through Discord or email, settle all outstanding fees such as tournament registration costs before completing the transfer, and relinquish all rights to the slot upon completion of the transaction.",
        citations: "[Slot Guidelines 5.3.1]",
      },
      {
        title: "Buying Team Responsibilities",
        content:
          "Buying teams must fulfill all financial commitments, including the slot price and AFC transaction fee. They must ensure compliance with tournament rules and eligibility requirements, and submit an updated team roster and relevant details to AFC within 3 days of completing the purchase.",
        citations: "[Slot Guidelines 5.3.2]",
      },
      {
        title: "AFC's Role in Slot Transfers",
        content:
          "AFC verifies transfers to ensure compliance with minimum price requirements, transaction fee payment, and tournament eligibility rules. Transfers are valid only upon formal approval by AFC. Approval notifications will be sent via Discord or email. The slot fee will be paid to AFC, after which AFC will send the money to the selling team after removal of its fee. All transfers will be documented in the AFC database.",
        citations: "[Slot Guidelines 5.4]",
      },
      {
        title: "Slot Transfer Dispute Resolution",
        content:
          "Common disputes include non-payment (if buying team fails to pay, the transfer is canceled and selling team retains ownership) and misrepresentation (if selling team provides false information, the transfer is voided and penalties may apply). Disputes must be reported via Discord (#report-slot-transfer channel) or email. AFC will mediate disputes within 48 hours and issue a binding resolution.",
        citations: "[Slot Guidelines 5.5]",
      },
      {
        title: "Slot Transfer Penalties",
        content:
          "For selling teams: failure to notify AFC results in warning for first offense, fines or suspension for repeated offenses. False information leads to immediate cancellation and potential suspension. For buying teams: non-payment of fees means slot will not be transferred and participation may be barred. Roster violations result in disqualification and slot forfeiture.",
        citations: "[Slot Guidelines 5.7]",
      },
    ],
  },
  {
    id: "contracts",
    category: "Contract Submission & Management",
    description:
      "Comprehensive guidelines for submitting, reviewing, and enforcing all esports contracts.",
    icon: IconFileCheck,
    rules: [
      {
        title: "Contract Submission Process",
        content:
          "All contracts must be submitted via the AFC's Discord Contract Submission Channel. Contracts must be submitted in PDF format to prevent unauthorized changes. Include all communication history as evidence of agreement.",
        citations: "[Contract Guidelines 2.1, 7.1]",
      },
      {
        title: "Ticket Naming Format",
        content:
          "Esports Player Acquisition Contract: 'EPAC [Player name - Acquiring team name]'. Player Loan: 'EPLC [Lending team name - Borrowing team name]'. Team Sale: 'TSAC [Name of team being sold]'.",
        citations: "[Contract Guidelines 2.1]",
      },
      {
        title: "Required Contract Details",
        content:
          "Submissions must include: (1) Full legal names of all parties involved, (2) Type of contract, (3) Start and end dates of the agreement, (4) Summary of key terms (salary, obligations, non-compete clauses for player contracts; loan fee, salary responsibilities, return terms for player loans; sale price, payment structure, asset transfer details for team sales), (5) Attached contract in PDF format, (6) Evidence of agreement (email/chat logs).",
        citations: "[Contract Guidelines 2.1, 7.2]",
      },
      {
        title: "Mandatory Contract Clauses",
        content:
          "All contracts must include: (1) Non-Compete Clause preventing parties from engaging in conflicting agreements during contract term, (2) Confidentiality Clause protecting sensitive information, (3) Termination Clause clearly defining conditions for contract termination, (4) Revenue Sharing Clause (if applicable) outlining prize pool or sponsorship revenue splits, (5) Transition Terms for loans and team sales specifying timelines and conditions for transfers.",
        citations: "[Contract Guidelines 2.2]",
      },
      {
        title: "Esports Player Contract Guidelines",
        content:
          "Teams must provide clear salary terms, benefits, and obligations. Contracts may include a 30-day probation period to evaluate player performance. Specify conditions for mutual or one-sided termination. Define how tournament winnings or sponsorship revenue will be split.",
        citations: "[Contract Guidelines 4.1]",
      },
      {
        title: "Team Sale Contract Requirements",
        content:
          "The seller must provide full access to team branding, player contracts, and tournament slots. Sellers must disclose any debts or pending financial obligations. Prevent buyers from reselling the team within a specified period (e.g., 12 months).",
        citations: "[Contract Guidelines 4.3]",
      },
      {
        title: "Contract Verification and Approval",
        content:
          "AFC moderators review contracts to ensure compliance with AFC regulations and regional laws, clear and balanced obligations for all parties, and inclusion of all mandatory clauses. Once approved, the contract receives an 'AFC Approved' stamp and a copy is archived in the AFC Discord database.",
        citations: "[Contract Guidelines 3]",
      },
      {
        title: "Contract Conflict Resolution",
        content:
          "AFC acts as a neutral mediator for disputes arising from approved contracts. Process: (1) A private Discord channel (ticket) is created for all parties and AFC moderators, (2) Each party presents their case, (3) AFC mediators facilitate discussions and propose resolutions, (4) A binding resolution is documented and archived.",
        citations: "[Contract Guidelines 6, Slot Guidelines 5.5]",
      },
    ],
  },
  {
    id: "sponsor-regulations",
    category: "Sponsor & Advertising Regulations",
    description:
      "Rules governing team sponsorships, advertising obligations, and promotional activities.",
    icon: IconTrophy,
    rules: [
      {
        title: "Sponsor Approval Process",
        content:
          "Any updates related to sponsorships or team jerseys must receive pre-approval from tournament officials with sufficient preparation time.",
        citations: "[Sponsor Regulations 4.3]",
      },
      {
        title: "Marketing and Promotional Obligations",
        content:
          "Teams and their members must adhere to all marketing and promotional requirements as set out by the tournament organizer. Repeated failure to meet the tournament organizer's requirements, such as advertising obligations, constitutes a major offense.",
        citations: "[Team Obligations 4.4, Disciplinary 6.1]",
      },
      {
        title: "Advertising Approval and Exclusivity",
        content:
          "Teams require advance written approval for any advertising or promotional programs. They may not participate in third-party events during the tournament timeframe unless approved. Teams or players cannot participate in third-party competitions on day of tournament without tournament organizer approval.",
        citations: "[Team Obligations 4.4, Special Provisions 9.1]",
      },
    ],
  },
  {
    id: "competition-structure",
    category: "Competition Structure & Scheduling",
    description:
      "Match formats, scheduling protocols, and mandatory tournament events.",
    icon: IconTrophy,
    rules: [
      {
        title: "Match Format",
        content:
          "Matches are conducted following a round-robin or knockout format, depending on the stage of the tournament. The tournament comprises both online and offline phases, with initial rounds held virtually and finals organized at a physical venue.",
        citations: "[Competition Structure 5.1, Introduction 1.1]",
      },
      {
        title: "Scheduling and Attendance",
        content:
          "The Tournament Organizer is responsible for announcing match schedules, including exact dates and times. All teams must adhere to the announced schedule and be present at the designated time. Being late for Media Day or event game days constitutes a minor offense.",
        citations: "[Competition Structure 5.1, Disciplinary 6.1]",
      },
      {
        title: "Mandatory Test Events",
        content:
          "Teams are required to participate in rehearsal and test matches organized prior to main events. Absence without prior approval may lead to penalties.",
        citations: "[Pre-Match Checks 5.2]",
      },
      {
        title: "Communication Restrictions During Matches",
        content:
          "During matches, only approved and designated communication channels may be used. Unauthorized use of text, emails, or other mediums is prohibited. Usage of unauthorized communication devices and methods during matches is forbidden.",
        citations: "[Unauthorized Communications 5.4, Communication 3.5]",
      },
    ],
  },
  {
    id: "communication",
    category: "Communication with Organizers",
    description:
      "Response requirements, confidentiality obligations, and communication protocols.",
    icon: IconMessageExclamation,
    rules: [
      {
        title: "Response Time Requirements",
        content:
          "Team members must respond to official communications within specified deadlines: within one business day for emails and within twelve hours if contacted across multiple channels.",
        citations: "[Communication 3.5]",
      },
      {
        title: "Payment Information Requests",
        content:
          "Failure to provide necessary information for prize distribution within 3 days will lead to prize forfeiture. Teams must submit complete and accurate prize request details within three (3) days after being requested by the Tournament Organizer.",
        citations: "[Communication 3.5, Prize Distribution 8.2]",
      },
      {
        title: "Confidentiality Requirements",
        content:
          "Players must not disclose any confidential information received from the Tournament Organizer. Team members are forbidden from disclosing any confidential or proprietary information shared by the Tournament Organizer.",
        citations: "[Communication 3.5, Conduct Standards 3.3]",
      },
    ],
  },
  {
    id: "disciplinary",
    category: "Disciplinary Actions & Violations",
    description:
      "Classification of offenses, investigation procedures, and sanction frameworks.",
    icon: IconAlertCircle,
    rules: [
      {
        title: "Minor Offenses",
        content:
          "Minor offenses include: (1) Late submission of media and team details when requested by organizers, (2) Usage of alternative game accounts without informing tournament officials, (3) Inappropriate nicknames during official matches, (4) Being late for Media Day or event game days.",
        citations: "[Disciplinary 6.1]",
      },
      {
        title: "Major Offenses",
        content:
          "Major offenses include: (1) Use of non-registered game accounts, (2) Failure to wear proper attire, (3) Posting match results publicly before they are officially streamed when pre-recorded, (4) Installation of external third-party software or browser usage during LAN finale without admin permission, (5) Repeated failure to meet tournament organizer's requirements such as advertising obligations, (6) Use of hacks by any team member, (7) Bribery.",
        citations: "[Disciplinary 6.1]",
      },
      {
        title: "Investigation Procedures",
        content:
          "Tournament organizers maintain the right to investigate rule breaches thoroughly. Participants must cooperate by providing accurate information and not withholding evidence.",
        citations: "[Disciplinary 6.2]",
      },
      {
        title: "Sanctions Framework",
        content:
          "Sanctions imposed vary based on severity and frequency of offense. They include: (1) Verbal or public written warnings, (2) Game and tournament forfeitures, (3) Point deductions, (4) Prize forfeitures, (5) Suspension or disqualification from current and future tournaments.",
        citations: "[Disciplinary 6.2]",
      },
      {
        title: "Repeated Infractions Policy",
        content:
          "Repeated rule violations may lead to escalating consequences, including heavier sanctions or permanent disqualification.",
        citations: "[Disciplinary 6.2]",
      },
      {
        title: "Interim Measures",
        content:
          "Temporary sanctions may be imposed during ongoing investigations, particularly for severe allegations, and may be revised as more information becomes available.",
        citations: "[Disciplinary 6.2]",
      },
      {
        title: "Final Determinations",
        content:
          "The tournament organizer reserves the right to make binding decisions regarding offenses and sanctions, evaluating rule breaches irrespective of intent.",
        citations: "[Disciplinary 6.2]",
      },
    ],
  },
  {
    id: "prize-distribution",
    category: "Prize Distribution & Forfeiture",
    description:
      "Prize money framework, payment timelines, and conditions for prize forfeiture.",
    icon: IconTrophy,
    rules: [
      {
        title: "Payment Timeline",
        content:
          "All prize money will be disbursed to the designated contact for each team within 90 days following the conclusion of the tournament finals, provided all necessary payment information has been submitted by the specified deadline.",
        citations: "[Prize Distribution 8.1]",
      },
      {
        title: "Prize Execution Conditions",
        content:
          "Prize distribution is conditional upon the team fulfilling all tournament obligations, including participation in all matches and completion of required promotional activities. Prize money will be distributed by the Tournament Organizer only to the team. Players must agree to internal team arrangements for distribution.",
        citations: "[Prize Distribution 8.1, Team Obligations 4.4]",
      },
      {
        title: "Submission Deadlines for Prize Claims",
        content:
          "Teams must submit complete and accurate prize request details, including all required information, within three (3) days after being requested by the Tournament Organizer. Delays or failure to submit prize-related information in a timely or complete manner may result in forfeiture of the prize money.",
        citations: "[Prize Distribution 8.2]",
      },
      {
        title: "Intellectual Property Rights Transfer",
        content:
          "Teams are required to transfer all rights, titles, and interests, including intellectual property rights related to tournament-created content, as a condition of receiving prize money.",
        citations: "[Prize Distribution 8.2]",
      },
    ],
  },
  {
    id: "ip-media-rights",
    category: "Intellectual Property & Media Rights",
    description:
      "Ownership rights, usage permissions, and exploitation of tournament content.",
    icon: IconFileCheck,
    rules: [
      {
        title: "Ownership Rights",
        content:
          "The Tournament Organizer retains all rights to any materials created as part of the tournament. This includes content, broadcasts, and any derivative works.",
        citations: "[Special Provisions 9.2]",
      },
      {
        title: "Usage Permissions",
        content:
          "Teams and players do not gain ownership or any rights to the tournament's intellectual property. Unauthorized use is considered a rights infringement.",
        citations: "[Special Provisions 9.2]",
      },
      {
        title: "Exploitation Rights",
        content:
          "The Organizer can exploit the Tournament IP across various media formats without restrictions, and it may assign these rights to third parties as deemed necessary.",
        citations: "[Special Provisions 9.2]",
      },
    ],
  },
  {
    id: "organizer-authority",
    category: "Organizer Veto Rights & Rule Alterations",
    description:
      "Tournament organizer's discretionary powers and authority over competition format.",
    icon: IconGavel,
    rules: [
      {
        title: "Organizer Discretion",
        content:
          "The Tournament Organizer has the ultimate decision-making authority over various aspects of the tournament. These include the overall format, number of teams participating, prize pool allocations (without reducing the previously announced amount), and studio set-up.",
        citations: "[Special Provisions 9.1]",
      },
      {
        title: "Rule Alterations",
        content:
          "Adjustments to tournament rules may be made with the intention of improving operations or the tournament's goodwill. Announcement will be made after an update or addition to the rules.",
        citations: "[Special Provisions 9.1]",
      },
      {
        title: "Final Interpretation Authority",
        content:
          "AFC admins have final veto rights regarding rule interpretation and alterations. The tournament organizer reserves the right to make binding decisions regarding offenses and sanctions.",
        citations: "[Special Provisions 9.1, Disciplinary 6.2]",
      },
    ],
  },
  {
    id: "monthly-ranking",
    category: "Monthly Ranking System",
    description:
      "Short-term performance measurement system updated monthly for teams and players.",
    icon: IconChartBar,
    rules: [
      {
        title: "Ranking System Purpose",
        content:
          "The ranking system measures short-term performance to determine active and high-performing teams or players monthly. It encourages consistent competition and ensures ongoing participation throughout each season.",
        citations: "[AFC Metrics 3.1]",
      },
      {
        title: "Ranking Operation",
        content:
          "Rankings are updated monthly and reset at the start of each new month. Teams can compare their standing across all other AFC-registered teams, irrespective of their tier level.",
        citations: "[AFC Metrics 3.2]",
      },
      {
        title: "Team Ranking Criteria",
        content:
          "Tournament Wins: 20 points per win. Tournament Kills (Cumulative): 0–5,000 kills scale (1 pt for 0-100 kills, 3 pts for 101-300, 5 pts for 301-500, 8 pts for 501-1,000, 12 pts for 1,001-1,500, 15 pts for 1,501-2,000, 18 pts for 2,001-2,500, 20 pts for 2,501-3,000, 23 pts for 3,001-3,500, 25 pts for 3,501-4,000, 28 pts for 4,001-4,500, 30 pts for 4,501-5,000). Tournament Placements: 0–1,000+ placement scale. Scrim Wins: 0.5 points per win. Scrim Kills and Placements: Same scales as tournament metrics.",
        citations: "[AFC Metrics 3.3]",
      },
      {
        title: "Scrim Weighting Limitation",
        content:
          "Scrim-based points shall not exceed 30% of the total ranking points accumulated by a team per month. Tournament data remains the dominant factor in determining rank standings.",
        citations: "[AFC Metrics 3.4]",
      },
      {
        title: "Player Ranking System",
        content:
          "Players are ranked monthly based on: Tournament Kills (same scale as team kills), MVPs (5 points per MVP), Tournament Finals (3 points per appearance), Tournament Wins (20 points per team win), Scrim Kills (same scale as team scrim kills), Scrim Wins (0.5 points per win).",
        citations: "[AFC Metrics 6]",
      },
    ],
  },
  {
    id: "quarterly-tiering",
    category: "Quarterly Tiering System",
    description:
      "Long-term performance grading system determining competitive classification and benefits.",
    icon: IconChartBar,
    rules: [
      {
        title: "Tiering Purpose",
        content:
          "Tiering defines the overall performance grade of each team within the AFC ecosystem. Tiers determine access to higher-level competitions, perks, and recognition within the community.",
        citations: "[AFC Metrics 4.1]",
      },
      {
        title: "Tiering Duration and Seasons",
        content:
          "Tiers are assigned every three (3) months. There are four competitive seasons per year: Season 1 (January–March), Season 2 (April–June), Season 3 (July–September), Season 4 (October–December). Tiers reset at the beginning of each new season. All tier points accumulate across the entire year for the annual leaderboard and awards.",
        citations: "[AFC Metrics 4.2]",
      },
      {
        title: "Tier Retention",
        content:
          "Once a team is assigned a tier, it retains that tier for the full quarter. Example: A team assigned to Tier 1 in March retains that tier from April to June, with changes only occurring after the next evaluation.",
        citations: "[AFC Metrics 4.3]",
      },
      {
        title: "Tiering Criteria - Tournament Wins",
        content: "20 points per tournament win.",
        citations: "[AFC Metrics 5.1]",
      },
      {
        title: "Tiering Criteria - Prize Money",
        content:
          "Prize money earned contributes to tier points on a sliding scale: ₦0–100,000 (5 pts), ₦101,000–300,000 (10 pts), ₦301,000–500,000 (15 pts), ₦501,000–750,000 (20 pts), ₦751,000–1,000,000 (25 pts), ₦1,000,001–1,500,000 (30 pts), ₦1,500,001–2,000,000 (35 pts), ₦2,000,001–2,500,000 (40 pts), ₦2,500,001–3,000,000 (45 pts), ₦3,000,001–3,500,000 (50 pts), ₦3,500,001–4,000,000 (55 pts), ₦4,000,001–4,500,000 (60 pts), ₦4,500,001–5,000,000 (65 pts).",
        citations: "[AFC Metrics 5.2]",
      },
      {
        title: "Tiering Criteria - Tournament Kills",
        content:
          "Cumulative tournament kills contribute on a scale: 0–100 (1 pt), 101–300 (3 pts), 301–500 (5 pts), 501–1,000 (8 pts), 1,001–1,500 (12 pts), 1,501–2,000 (15 pts), 2,001–2,500 (18 pts), 2,501–3,000 (20 pts), 3,001–3,500 (23 pts), 3,501–4,000 (25 pts), 4,001–4,500 (28 pts), 4,501–5,000 (30 pts).",
        citations: "[AFC Metrics 5.3]",
      },
      {
        title: "Tiering Criteria - Tournament Placements",
        content:
          "Placement points scored: 0–100 (0.02 per placement), 101–300 (0.05), 301–500 (0.10), 501–1,000 (0.15), 1,001+ (0.20).",
        citations: "[AFC Metrics 5.4]",
      },
      {
        title: "Tiering Criteria - Tournament Finals",
        content: "5 points per tournament finals appearance.",
        citations: "[AFC Metrics 5.5]",
      },
      {
        title: "Tiering Criteria - Social Media Metrics",
        content:
          "Measured across Instagram and TikTok for followers, posts, and likes: 0–500 (1 pt), 501–1,000 (2 pts), 1,001–2,500 (5 pts), 2,501–5,000 (8 pts), 5,001–10,000 (12 pts), 10,001–20,000 (15 pts), 20,001–50,000 (20 pts), 50,001–75,000 (30 pts), 75,001–100,000 (35 pts), 100,000+ (40 pts).",
        citations: "[AFC Metrics 5.6]",
      },
      {
        title: "Tiering Criteria - Scrim Metrics",
        content:
          "Scrim metrics (maximum 30% overall weight): Scrim Wins (0.5 per win), Scrim Kills Cumulative (0.5–11 pts scale), Scrim Placements (0–0.2 scale, same as tournaments).",
        citations: "[AFC Metrics 5.7]",
      },
    ],
  },
  {
    id: "tier-classifications",
    category: "Team Tier Classifications & Benefits",
    description:
      "Tier levels, point thresholds, and privileges associated with each classification.",
    icon: IconTrophy,
    rules: [
      {
        title: "Tier Classifications",
        content:
          "Teams are graded into three tiers: Tier 1 (Elite: 70+ points), Tier 2 (Competitive: 50-69 points), Tier 3 (Developing: Below 50 points).",
        citations: "[AFC Metrics 8]",
      },
      {
        title: "Tier 1 Team Benefits",
        content:
          "Tier 1 teams enjoy the following privileges: (1) Automatic invitations to AFC Invitational Tournaments, (2) Exposure via interviews and community features, (3) Special Discord recognition roles, (4) Access to private AFC or partner scrims, (5) Qualification for the AFC Community Cup.",
        citations: "[AFC Metrics 9]",
      },
      {
        title: "Tournament Classification",
        content:
          "Tournaments are tiered based on prize pool and structure: Tier 1 (₦ equivalent of $1,000+ or official FreeFire event), Tier 2 (₦ equivalent of $300–$999 or LAN event), Tier 3 (Below $300). Tiering affects prestige and visibility on the AFC platform. Tournament points remain consistent across all tiers, but higher-tier events receive badge recognition on the AFC website.",
        citations: "[AFC Metrics 7]",
      },
    ],
  },
  {
    id: "metrics-compliance",
    category: "Metrics System Compliance & Penalties",
    description:
      "Rules governing data verification, point resets, and compliance requirements.",
    icon: IconAlertCircle,
    rules: [
      {
        title: "Registration Requirements",
        content:
          "Teams must register on the official AFC website at www.africanfreefirecommunity.com. Only teams listed on the website are eligible for metrics tracking.",
        citations: "[AFC Metrics 10.1-10.2]",
      },
      {
        title: "Point Reset for Violations",
        content:
          "Hacking, cheating, or account manipulation results in a total point reset for both teams and players. Teams with no monthly rank will have their points reset to zero.",
        citations: "[AFC Metrics 10.3-10.4]",
      },
      {
        title: "Banned Team Eligibility",
        content:
          "Banned or blacklisted teams are ineligible for points during suspension.",
        citations: "[AFC Metrics 10.5]",
      },
      {
        title: "Professional Conduct Requirement",
        content:
          "Professional conduct is mandatory during all AFC-sanctioned activities.",
        citations: "[AFC Metrics 10.6]",
      },
      {
        title: "Data Verification Process",
        content:
          "All performance data are verified by AFC Administrators. The verification process includes: (1) Tournament and scrim result validation, (2) Media and social metric checks, (3) Cross-platform consistency audits. Only AFC-sanctioned and verified events contribute to rankings and tiering.",
        citations: "[AFC Metrics 11]",
      },
      {
        title: "Data Visibility",
        content:
          "Public view displays each team's total points and current tier. Private view shows full metric breakdown (kills, earnings, media, scrims) accessible on each team's profile. Annual Leaderboard displays cumulative yearly tier points used for AFC Awards and recognition.",
        citations: "[AFC Metrics 12]",
      },
    ],
  },
];
