import { Footer } from "@/app/_components/Footer";
import { Header } from "@/app/_components/Header";
import { PageHeader } from "@/components/PageHeader";
import React from "react";

const page = () => {
  return (
    <div>
      <Header />
      <div className="container py-10">
        <PageHeader title="AFC Privacy Policy Agreement" />

        {/* --- START OF PRIVACY POLICY CONTENT --- */}
        {/* Use space-y-8 to create large gaps between major sections (H2s) */}
        <div className="prose max-w-none text-sm lg:prose-lg mt-6 space-y-4 text-muted-foreground">
          {/* Section for Effective Date / Jurisdiction */}
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
          </div>

          {/* 1. Introduction */}
          <div>
            <h2 className="font-medium text-lg md:text-xl mb-1 text-black dark:text-white">
              1. Introduction
            </h2>
            <p>
              The African Freefire Community (“AFC”, “we”, “our”, or “us”)
              operates a competitive esports and community platform serving
              players across Africa. This Privacy Policy explains how AFC
              collects, uses, stores, protects, and shares information when
              users access the AFC website, participate in tournaments, engage
              with the AFC metrics system, or use any AFC-integrated services.
            </p>
            <p>
              By creating an account or participating in AFC activities, you
              agree to the practices described in this Policy.
            </p>
          </div>

          {/* 2. Information We Collect */}
          <div>
            <h2 className="font-medium text-lg md:text-xl mb-1 text-black dark:text-white">
              2. Information We Collect
            </h2>
            <p>
              We collect data required to operate tournaments, maintain
              competitive integrity, enhance user experience, and secure the
              platform. This includes:
            </p>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              2.1 Identity & Profile Data
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Name (optional)</li>
              <li>Username / IGN</li>
              <li>Freefire UID</li>
              <li>Discord ID (for OAuth and verification)</li>
              <li>Email address</li>
              <li>Profile information you provide</li>
            </ul>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              2.2 Device & Technical Data
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Device type</li>
              <li>Operating system</li>
              <li>Browser type</li>
              <li>Device identifiers</li>
              <li>Advertising identifiers</li>
              <li>IP address</li>
              <li>Location data (coarse and device-based)</li>
              <li>Session activity</li>
              <li>
                Device fingerprinting data (anti-cheat and fraud prevention)
              </li>
            </ul>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              2.3 Gameplay & Performance Data
            </h3>
            <p>
              Collected automatically when you participate in AFC
              tournaments/scrims:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Kills, damage, placements</li>
              <li>Team participation</li>
              <li>Tournament rankings</li>
              <li>Metrics and tier progression</li>
              <li>Ban or blacklist information</li>
            </ul>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              2.4 Payment & Transaction Data
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                Payment card or wallet information (processed through
                third-party processors)
              </li>
              <li>Purchase history</li>
              <li>Prize payout records</li>
              <li>Financial verifications (if required)</li>
            </ul>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              2.5 Behavioural & Interaction Data
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Clickstream data</li>
              <li>Time on page</li>
              <li>Session analytics</li>
              <li>Engagement with website features</li>
              <li>
                Device behaviour signals used for anti-cheat and fraud
                prevention
              </li>
            </ul>
          </div>

          {/* 3. How We Use Your Information */}
          <div>
            <h2 className="font-medium text-lg md:text-xl mb-1 text-black dark:text-white">
              3. How We Use Your Information
            </h2>
            <p>
              AFC processes collected data for the following business-critical
              purposes:
            </p>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              3.1 Security, Integrity & Anti-Cheat
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                Detect cheating, fraud, smurfing, multi-accounting,
                impersonation
              </li>
              <li>Enforce bans, penalties, and blacklist decisions</li>
              <li>Protect tournament fairness</li>
              <li>Monitor suspicious device or location activity</li>
            </ul>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              3.2 Tournament Operations
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Verify player identity and eligibility</li>
              <li>Rank players and calculate metrics</li>
              <li>Manage leaderboards, rewards, and qualifications</li>
              <li>Maintain historical competition records</li>
            </ul>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              3.3 Platform Analytics & Personalisation
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Improve user experience</li>
              <li>Personalize tournaments, recommendations, and content</li>
              <li>Conduct performance analytics</li>
              <li>Monitor website usage and engagement</li>
            </ul>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              3.4 Marketing & Communications
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Send tournament updates, notifications, newsletters</li>
              <li>Deliver sponsor or partner announcements</li>
              <li>Discord-linked communications</li>
            </ul>
            <p>(Users may opt out of marketing.)</p>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              3.5 Payments & Financial Processing
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Manage tournament prize payouts</li>
              <li>Handle user purchases</li>
              <li>Verify financial transactions for compliance</li>
            </ul>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              3.6 Legal & Compliance
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Respond to lawful requests</li>
              <li>Maintain audit trails</li>
              <li>Protect AFC’s legal, financial, and operational interests</li>
            </ul>
          </div>

          {/* 4. Third-Party Data Processors */}
          <div>
            <h2 className="font-medium text-lg md:text-xl mb-1 text-black dark:text-white">
              4. Third-Party Data Processors
            </h2>
            <p>
              Your data may be shared with trusted third parties who support AFC
              operations. These partners process data strictly under AFC’s
              instructions.
            </p>
            <p>These include:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>AWS – hosting and infrastructure</li>
              <li>Discord – identity verification and communication</li>
              <li>
                Analytics providers (Google Analytics, Mixpanel, or equivalent)
              </li>
              <li>Payment processors (e.g., Stripe, Paystack, Flutterwave)</li>
              <li>Anti-cheat or security providers</li>
              <li>Email service providers</li>
              <li>Development partners under NDA</li>
            </ul>
            <p>AFC does not sell user data.</p>
          </div>

          {/* 5. Data Retention */}
          <div>
            <h2 className="font-medium text-lg md:text-xl mb-1 text-black dark:text-white">
              5. Data Retention
            </h2>
            <p>
              To preserve competitive integrity, prevent abuse, and maintain
              historical records, AFC retains certain data long-term.
            </p>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              5.1 Retention Schedule
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                Account Data: retained for as long as the account remains
                active, and up to 10 years after inactivity.
              </li>
              <li>Tournament Data: retained indefinitely.</li>
              <li>
                Metrics, Rankings & Historical Performance: retained
                indefinitely.
              </li>
              <li>Ban / Blacklist Records: retained indefinitely.</li>
              <li>Device & Location Logs: retained for 5–7 years.</li>
              <li>
                Payment & Financial Data: retained for up to 7 years (standard
                financial compliance).
              </li>
            </ul>
          </div>

          {/* 6. User Rights */}
          <div>
            <h2 className="font-medium text-lg md:text-xl mb-1 text-black dark:text-white">
              6. User Rights
            </h2>
            <p>
              AFC respects user rights while balancing the operational needs of
              esports integrity. Users may request:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Access to their personal data</li>
              <li>Correction of inaccurate data</li>
              <li>Opt-out from marketing communications</li>
              <li>Opt-out from non-essential analytics tracking</li>
            </ul>
            <p>Users cannot request deletion of:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Tournament performance data</li>
              <li>Metrics, rankings, and historical records</li>
              <li>Ban or blacklist information</li>
              <li>Device or fraud-prevention identifiers</li>
              <li>Data tied to prize winnings or financial records</li>
              <li>Anti-cheat data</li>
            </ul>
            <p>
              These categories are exempt from deletion to preserve competitive
              fairness and security.
            </p>
          </div>

          {/* 7. Children’s Privacy */}
          <div>
            <h2 className="font-medium text-lg md:text-xl mb-1 text-black dark:text-white">
              7. Children’s Privacy
            </h2>
            <p>
              Participation in AFC requires users to be at least 13 years old,
              aligning with global online service standards and Discord’s
              minimum age requirement.
            </p>
            <p>We do not knowingly collect information from anyone under 13.</p>
            <p>Accounts found to be underage will be disabled.</p>
          </div>

          {/* 8. Cookies & Tracking Technologies */}
          <div>
            <h2 className="font-medium text-lg md:text-xl mb-1 text-black dark:text-white">
              8. Cookies & Tracking Technologies
            </h2>
            <p>
              AFC uses cookies and tracking tools for functionality, analytics,
              and security.
            </p>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              8.1 Mandatory Cookies (cannot opt-out)
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Functional site operations</li>
              <li>Authentication</li>
              <li>Anti-cheat and device fingerprinting</li>
              <li>Security monitoring</li>
              <li>Session management</li>
            </ul>

            <h3 className="font-medium mt-4 text-black dark:text-white">
              8.2 Optional Cookies (opt-out allowed)
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Marketing cookies</li>
              <li>Analytics not tied to security or anti-cheat</li>
              <li>UX testing cookies</li>
              <li>Advertising identifiers</li>
            </ul>
            <p>
              Users can manage preferences in their browser settings and AFC
              cookie banner.
            </p>
          </div>

          {/* 9. Data Security Measures */}
          <div>
            <h2 className="font-medium text-lg md:text-xl mb-1 text-black dark:text-white">
              9. Data Security Measures
            </h2>
            <p>We implement industry-standard security protocols, including:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>End-to-end encrypted data storage</li>
              <li>
                Strict access controls limited to developers and core management
              </li>
              <li>Two-factor authentication for admin access</li>
              <li>Audit logs for data exports</li>
              <li>No storage of personal data on staff devices</li>
              <li>Routine security reviews</li>
              <li>Automated threat monitoring</li>
            </ul>
          </div>

          {/* 10. Cross-Border Data Transfers */}
          <div>
            <h2 className="font-medium text-lg md:text-xl mb-1 text-black dark:text-white">
              10. Cross-Border Data Transfers
            </h2>
            <p>
              By using AFC, you acknowledge that your data may be processed in
              Nigeria and other countries where we operate or maintain cloud
              infrastructure (including AWS regions).
            </p>
            <p>
              We use reasonable technical and contractual safeguards to protect
              data regardless of location.
            </p>
          </div>

          {/* 11. Data Breach Policy */}
          <div>
            <h2 className="font-medium text-lg md:text-xl mb-1 text-black dark:text-white">
              11. Data Breach Policy
            </h2>
            <p>
              AFC maintains a structured incident response protocol. In the
              event of a breach involving user data, AFC will:
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Contain the breach and secure systems</li>
              <li>Conduct a full investigation</li>
              <li>Notify high-risk affected users</li>
              <li>Provide disclosure within 72 hours when legally required</li>
              <li>Document all findings and remediation steps</li>
              <li>Apply sanctions for internal violations or misuse</li>
            </ol>
          </div>

          {/* 12. Legal Basis for Processing */}
          <div>
            <h2 className="font-medium text-lg md:text-xl mb-1 text-black dark:text-white">
              12. Legal Basis for Processing
            </h2>
            <p>Depending on your region, AFC processes data based on:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                Contractual necessity (running tournaments, verifying
                eligibility)
              </li>
              <li>
                Legitimate interest (site security, anti-cheat, analytics)
              </li>
              <li>Consent (marketing, optional cookies)</li>
              <li>
                Legal obligations (financial records, fraud investigations)
              </li>
            </ul>
          </div>

          {/* 13. Changes to This Policy */}
          <div>
            <h2 className="font-medium text-lg md:text-xl mb-1 text-black dark:text-white">
              13. Changes to This Policy
            </h2>
            <p>
              AFC may update this Privacy Policy periodically. Material changes
              will be communicated through the website, Discord, or email
              notifications.
            </p>
            <p>
              Continued use of AFC services constitutes acceptance of changes.
            </p>
          </div>

          {/* 14. Contact Information */}
          <div>
            <h2 className="font-medium text-lg md:text-xl mb-1 text-black dark:text-white">
              14. Contact Information
            </h2>
            <p>For data queries, complaints, or access requests, contact:</p>
            <p>African Freefire Community (AFC)</p>
            <p>
              Email:{" "}
              <a
                href="mailto:info@africanfreefirecommunity.com"
                className="text-primary hover:underline"
              >
                info@africanfreefirecommunity.com
              </a>
            </p>
            <p>Discord: Official AFC Server</p>
          </div>
        </div>
        {/* --- END OF PRIVACY POLICY CONTENT --- */}
      </div>
      <Footer />
    </div>
  );
};

export default page;
