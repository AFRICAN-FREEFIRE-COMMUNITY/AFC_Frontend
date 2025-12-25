import { Header } from "@/app/(user)/_components/Header";
import { Footer } from "@/app/_components/Footer";
import { PageHeader } from "@/components/PageHeader";
import React from "react";

const page = () => {
  return (
    <div>
      <Header />
      <div className="container py-10">
        <PageHeader title="AFC Terms of Service" />

        {/* --- START OF TERMS OF SERVICE CONTENT --- */}
        {/* Use space-y-8 to create large gaps between major sections (H2s) */}
        <div className="prose max-w-none text-sm lg:prose-lg mt-6 space-y-4 text-muted-foreground">
          <div className="text-sm italic text-muted-foreground grid gap-1 mb-6">
            <p>
              <strong className="text-black dark:text-white">
                Effective Date:
              </strong>{" "}
              Upon Publication
            </p>
            <p>
              <strong className="text-black dark:text-white">Entity:</strong>{" "}
              African Freefire Community (AFC)
            </p>
            <p>
              <strong className="text-black dark:text-white">
                Jurisdiction:
              </strong>{" "}
              Federal Republic of Nigeria, operating across Africa
            </p>
          </div>

          {/* 1. Introduction & Agreement */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              1. Introduction & Agreement
            </h2>
            <p>
              Welcome to the African Freefire Community (“AFC”, “we”, “our”, or
              “us”). These Terms of Service (“Terms”) govern your use of all AFC
              websites, platforms, tournaments, services, Discord integrations,
              digital storefronts, and any related products.
            </p>
            <p>
              By creating an account, connecting your Discord ID, participating
              in tournaments, using AFC's website, or purchasing virtual items,
              you confirm that:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>You have read, understood, and agree to these Terms.</li>
              <li>You accept AFC’s Privacy Policy.</li>
              <li>You are legally capable of entering this agreement.</li>
            </ul>
            <p>
              If you do not agree to these Terms, you must immediately
              discontinue use of AFC services. AFC reserves the right to update
              these Terms at any time. Continued use of AFC services constitutes
              acceptance of the updated Terms.
            </p>
          </div>

          {/* 2. Definitions */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              2. Definitions
            </h2>
            <p>For clarity throughout this document:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>“User” / “Player” – any individual who uses AFC services.</li>
              <li>
                “Account” – an AFC user profile linked to a Discord identity.
              </li>
              <li>
                “Virtual Items” – digital items, tournament passes, boosts,
                cosmetics, or other non-physical assets sold by AFC.
              </li>
              <li>
                “Services” – all AFC websites, software, tournaments,
                leaderboards, metrics systems, Discord features.
              </li>
              <li>
                “Fraudulent Activity” – cheating, impersonation, chargebacks,
                device manipulation, ban evasion, false information, or any
                activity intended to bypass AFC rules.
              </li>
              <li>
                “Banned/Blacklisted” – restricted from participating in AFC
                events based on AFC rules or investigations.
              </li>
            </ul>
          </div>

          {/* 3. Eligibility Requirements */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              3. Eligibility Requirements
            </h2>
            <p>To use AFC services, you must:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Be at least 13 years old</li>
              <li>Maintain an active Discord account</li>
              <li>Provide accurate account and identification information</li>
              <li>Not be banned, suspended, or blacklisted by AFC</li>
              <li>
                Meet all tournament eligibility and verification requirements
              </li>
            </ul>
            <p>AFC may request proof of age or identity at any time.</p>
          </div>

          {/* 4. Account Creation, Ownership & Responsibilities */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              4. Account Creation, Ownership & Responsibilities
            </h2>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              4.1 Account Creation
            </h3>
            <p>To register an AFC account, you must provide:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Discord ID (mandatory)</li>
              <li>Email address</li>
              <li>IGN & Freefire UID</li>
              <li>Any required competitive data</li>
            </ul>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              4.2 Account Ownership
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                Accounts belong to AFC; you only receive permission to use them.
              </li>
              <li>You may not sell, share, lease, or transfer your account.</li>
              <li>
                You are responsible for keeping your login credentials secure.
              </li>
            </ul>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              4.3 Multi-Accounting
            </h3>
            <p>Strictly prohibited:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Creating multiple accounts</li>
              <li>Using alternate accounts to bypass bans</li>
              <li>Smurfing or duplicating device profiles</li>
            </ul>
            <p>
              AFC may merge, terminate, or permanently ban related accounts.
            </p>
          </div>

          {/* 5. Proper Use of AFC Services */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              5. Proper Use of AFC Services
            </h2>
            <p>Users must not:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Cheat, manipulate, exploit, or use unauthorized software</li>
              <li>Tamper with device identifiers or location data</li>
              <li>Impersonate individuals or teams</li>
              <li>Harass, abuse, or threaten other users</li>
              <li>
                Spread hate speech, explicit content, or illegal materials
              </li>
              <li>Disrupt or attack AFC servers</li>
              <li>Attempt to reverse engineer AFC systems</li>
              <li>Use AFC for unauthorized commercial activities</li>
            </ul>
            <p>AFC may take disciplinary actions against violations.</p>
          </div>

          {/* 6. Tournament Participation & Competitive Integrity */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              6. Tournament Participation & Competitive Integrity
            </h2>
            <p>By entering AFC tournaments, you agree to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Follow all tournament rulebooks</li>
              <li>Accept referee decisions as final</li>
              <li>Undergo verification or identity checks</li>
              <li>Submit required gameplay or device evidence</li>
              <li>Comply with anti-cheat investigations</li>
              <li>Respect metrics, tiering, and ranking outcomes</li>
              <li>Maintain good sportsmanship and professional conduct</li>
            </ul>
            <p>AFC reserves full authority to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Disqualify players or teams</li>
              <li>Adjust standings or scores</li>
              <li>Issue bans or penalties</li>
              <li>Reject fraudulent participation</li>
              <li>Overturn results based on investigations</li>
            </ul>
          </div>

          {/* 7. Enforcement: Bans, Blacklists & Penalties */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              7. Enforcement: Bans, Blacklists & Penalties
            </h2>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              7.1 Grounds for Enforcement
            </h3>
            <p>Violations may include:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Cheating or suspicious behaviour</li>
              <li>Device manipulation or multi-device fraud</li>
              <li>Use of illegal software (aimbots, ESP, macros, etc.)</li>
              <li>Refusal to cooperate with investigations</li>
              <li>Harassment or misconduct</li>
              <li>False information during registration</li>
              <li>Chargeback attempts or financial fraud</li>
              <li>Breach of ToS or tournament rules</li>
            </ul>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              7.2 Team-Level Enforcement (AFC Standard Policy)
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                One banned/blacklisted player = 2-month ban for entire team
              </li>
              <li>Two banned players = 4-month team ban</li>
              <li>Three banned players = 6-month team ban</li>
            </ul>
            <p>(Team may appeal after serving 1 month.)</p>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              7.3 Appeals
            </h3>
            <p>
              Players/teams may submit a structured appeal. AFC holds full
              discretion over final decisions.
            </p>
          </div>

          {/* 8. Payments, Purchases & Digital Goods */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              8. Payments, Purchases & Digital Goods
            </h2>
            <p>
              AFC provides paid services including tournament passes, digital
              goods, and virtual items.
            </p>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              8.1 Payment Processing
            </h3>
            <p>
              All payments are processed via third-party processors (e.g.,
              Paystack, Flutterwave, Stripe). By purchasing, you agree to their
              respective terms.
            </p>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              8.2 Accuracy of Billing Information
            </h3>
            <p>Users must provide valid:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Payment details</li>
              <li>Billing information</li>
              <li>Wallet or account information for payouts</li>
            </ul>
            <p>
              AFC is not responsible for failed transactions caused by
              inaccurate or neglected payment data.
            </p>
          </div>

          {/* 9. Virtual Items Policy (NO REFUNDS) */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              9. Virtual Items Policy (NO REFUNDS)
            </h2>
            <p>Virtual Items include:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Digital tournament passes</li>
              <li>Boosts, cosmetics, perks</li>
              <li>Tier or XP enhancements</li>
              <li>Premium features</li>
              <li>Any non-physical items sold by AFC</li>
            </ul>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              9.1 Strict No-Refund Rule
            </h3>
            <p className="font-bold text-red-600">
              ALL VIRTUAL ITEM SALES ARE FINAL. NO EXCEPTIONS.
            </p>
            <p>Not refundable due to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Accidental purchase</li>
              <li>Unused items</li>
              <li>Misunderstanding the item</li>
              <li>Loss of access due to ban/blacklist</li>
              <li>Device or network issues</li>
              <li>Game performance dissatisfaction</li>
              <li>Duplicate purchases</li>
              <li>Account deletion</li>
            </ul>
            <p>Virtual Items cannot be:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Refunded</li>
              <li>Reversed</li>
              <li>Exchanged</li>
              <li>Converted to money</li>
              <li>Transferred between accounts</li>
            </ul>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              9.2 Modification of Virtual Items
            </h3>
            <p>
              AFC may modify, remove, rebalance, or discontinue Virtual Items at
              any time without compensation.
            </p>
          </div>

          {/* 10. CHARGEBACK POLICY (Strict Enforcement) */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              10. CHARGEBACK POLICY (Strict Enforcement)
            </h2>
            <p>AFC operates a zero-tolerance policy for chargebacks.</p>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              10.1 Chargeback Consequences
            </h3>
            <p>If a user initiates a chargeback, AFC will:</p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Immediately suspend the user’s account</li>
              <li>Place all associated teams under review</li>
              <li>Blacklist the user from all future tournaments</li>
              <li>Revoke any prizes, virtual items, or rankings earned</li>
              <li>Ban or penalize associated accounts</li>
              <li>
                Pursue recovery of losses, including:
                <ul className="list-disc list-inside space-y-1 ml-4 mt-1">
                  <li>Chargeback fees</li>
                  <li>Penalties from processors</li>
                  <li>Administrative costs</li>
                  <li>Damages to tournament integrity</li>
                </ul>
              </li>
              <li>
                Report the incident to partnering esports bodies (if necessary)
              </li>
            </ol>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              10.2 False Chargebacks
            </h3>
            <p>
              Attempting to secure a refund through a chargeback instead of
              through AFC support is treated as fraudulent activity.
            </p>
          </div>

          {/* 11. Payouts, Prizes & Financial Requirements */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              11. Payouts, Prizes & Financial Requirements
            </h2>
            <p>To receive prizes, users must:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Provide accurate payout details</li>
              <li>Complete required identity verification</li>
              <li>Comply with tax/regulatory obligations in their region</li>
              <li>Follow AFC winner verification procedures</li>
            </ul>
            <p>
              AFC is not responsible for bank delays, third-party failures, or
              incorrect user information.
            </p>
          </div>

          {/* 12. Content Ownership & Licensing */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              12. Content Ownership & Licensing
            </h2>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              12.1 User-Generated Content
            </h3>
            <p>
              By submitting content to AFC (videos, gameplay clips, images,
              responses, messages), you grant AFC a worldwide, irrevocable,
              royalty-free license to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Reproduce</li>
              <li>Edit</li>
              <li>Publish</li>
              <li>Distribute</li>
              <li>Display</li>
              <li>
                Share for marketing, highlights, tournament promotions, and
                documentation
              </li>
            </ul>
            <p>This license survives account termination.</p>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              12.2 AFC Property
            </h3>
            <p>
              All AFC designs, tournament structures, rules, software, metrics,
              scoring systems, and branding are AFC’s exclusive intellectual
              property.
            </p>
            <p>
              Users may not copy, redistribute, or replicate AFC systems without
              written permission.
            </p>
          </div>

          {/* 13. Website Usage & Restrictions */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              13. Website Usage & Restrictions
            </h2>
            <p>Users agree not to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Scrape, crawl, or copy website data</li>
              <li>Attempt to access admin-only systems</li>
              <li>Reverse engineer platform features</li>
              <li>Upload viruses or malicious code</li>
              <li>Exploit system vulnerabilities</li>
              <li>Automate interactions using bots</li>
              <li>Interfere with operations or analytics</li>
            </ul>
            <p>AFC may pursue legal action for violations.</p>
          </div>

          {/* 14. Data Privacy */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              14. Data Privacy
            </h2>
            <p>
              AFC processes user data in accordance with the AFC Privacy Policy,
              which is fully integrated into these Terms.
            </p>
            <p>Users acknowledge that:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                AFC collects device, location, gameplay, behavioural, and
                payment data
              </li>
              <li>Anti-cheat data is mandatory and not deletable</li>
              <li>
                Tournament data, metrics, and ranking history are retained
                long-term
              </li>
              <li>Data may be stored in Nigeria or abroad through AWS</li>
              <li>Certain permissions are required for platform operation</li>
            </ul>
          </div>

          {/* 15. Cookies & Tracking Tools */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              15. Cookies & Tracking Tools
            </h2>
            <p>By using AFC services, you consent to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Functional cookies</li>
              <li>Security and device fingerprinting</li>
              <li>Anti-cheat tracking</li>
              <li>Analytics cookies</li>
              <li>Marketing cookies (optional)</li>
            </ul>
            <p>Users may opt out of non-essential cookies.</p>
          </div>

          {/* 16. Service Availability & Modifications */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              16. Service Availability & Modifications
            </h2>
            <p>
              AFC may modify or suspend any service at any time. This includes:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Tournament formats</li>
              <li>Scoring systems</li>
              <li>Leaderboards</li>
              <li>Discord features</li>
              <li>Virtual item availability</li>
              <li>Website functionality</li>
              <li>Prize pools</li>
              <li>Scheduling changes</li>
            </ul>
            <p>
              AFC is not responsible for downtime or losses from service
              interruptions.
            </p>
          </div>

          {/* 17. Termination of Accounts */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              17. Termination of Accounts
            </h2>
            <p>AFC may suspend or terminate accounts for:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Violations of ToS</li>
              <li>Fraudulent behaviour</li>
              <li>Chargebacks</li>
              <li>Security risks</li>
              <li>Misconduct toward staff</li>
              <li>Offensive or illegal behaviour</li>
              <li>Non-cooperation with investigations</li>
            </ul>
            <p>
              Users may request account closure, but AFC will retain competitive
              and anti-cheat data.
            </p>
          </div>

          {/* 18. Disclaimer of Warranties */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              18. Disclaimer of Warranties
            </h2>
            <p>
              AFC services are provided “as is” and “as available.” We do not
              guarantee:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Continuous uptime</li>
              <li>Error-free performance</li>
              <li>Uninterrupted tournaments</li>
              <li>Bug-free website features</li>
              <li>Integration stability with Discord or Freefire</li>
              <li>Accuracy of user-submitted data</li>
              <li>That metrics or analytics will always be precise</li>
            </ul>
            <p>Users assume all risks related to platform use.</p>
          </div>

          {/* 19. Limitation of Liability */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              19. Limitation of Liability
            </h2>
            <p>
              To the fullest extent permitted by law, AFC is not liable for:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Lost opportunities, prizes, or earnings</li>
              <li>Data loss or corruption</li>
              <li>Bans or suspensions</li>
              <li>Payment processor failures</li>
              <li>Connectivity or lag issues</li>
              <li>Delayed payouts</li>
              <li>Website downtime</li>
              <li>Actions of other users</li>
              <li>Indirect or consequential damages</li>
            </ul>
            <p>
              AFC’s maximum liability is limited to the total amount the user
              paid to AFC in the past 12 months.
            </p>
          </div>

          {/* 20. Indemnification */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              20. Indemnification
            </h2>
            <p>
              You agree to indemnify and hold AFC harmless from any claims,
              liabilities, damages, losses, or expenses resulting from:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Your actions or misconduct</li>
              <li>Your breach of these Terms</li>
              <li>Your participation in tournaments</li>
              <li>Third-party disputes involving your behaviour</li>
            </ul>
          </div>

          {/* 21. Governing Law & Dispute Resolution */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              21. Governing Law & Dispute Resolution
            </h2>
            <p>
              These Terms are governed by the laws of the Federal Republic of
              Nigeria. All disputes must be resolved through Nigerian courts or
              any jurisdiction AFC deems appropriate.
            </p>
          </div>

          {/* 22. Contact Information */}
          <div>
            <h2 className="font-medium text-xl md:text-2xl mb-1 text-black dark:text-white">
              22. Contact Information
            </h2>
            <p>African Freefire Community (AFC)</p>
            <p>
              Official Email:{" "}
              <a
                href="mailto:info@africanfreefirecommunity.com"
                className="text-primary hover:underline"
              >
                info@africanfreefirecommunity.com
              </a>
            </p>
            <p>Official Discord Server: AFC Community</p>
          </div>
        </div>
        {/* --- END OF TERMS OF SERVICE CONTENT --- */}
      </div>
      <Footer />
    </div>
  );
};

export default page;
