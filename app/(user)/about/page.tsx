import { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generatePageMetadata } from "@/lib/seo";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = generatePageMetadata({
  title: "About Us",
  description:
    "Learn about the African Free Fire Community (AFC) - our mission to foster competitive esports, develop talent, and create opportunities for Free Fire players across Africa.",
  keywords: [
    "about AFC",
    "African esports organization",
    "Free Fire African mission",
    "esports community Africa",
  ],
  url: "/about",
});

export default function AboutPage() {
  return (
    <div>
      <PageHeader title="About AFC" />
      <div className="space-y-4">
        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle>Our Mission</CardTitle>
          </CardHeader>
          <CardContent className="text-sm md:text-base text-muted-foreground">
            <p>
              The African Free Fire Community (AFC) is dedicated to fostering a
              competitive and supportive environment for Freefire players across
              Africa. Our mission is to promote esports, develop talent, and
              create opportunities for players to showcase their skills on a
              global stage.
            </p>
          </CardContent>
        </Card>

        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle>Our Vision</CardTitle>
          </CardHeader>
          <CardContent className="text-sm md:text-base text-muted-foreground">
            <p>
              We envision a thriving African Free Fire esports scene that is
              recognized worldwide for its talent, passion, and professionalism.
              Through our efforts, we aim to elevate African players and teams
              to compete at the highest levels of international tournaments.
            </p>
          </CardContent>
        </Card>

        {/* What the platform does + how Google sign-in uses data (owner 2026-06-20).
            This page is the homepage URL set on the Google OAuth consent screen, so it
            must state the app's purpose AND what Google user data is used and why. */}
        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle>What the AFC Hub does</CardTitle>
          </CardHeader>
          <CardContent className="text-sm md:text-base text-muted-foreground">
            <p>
              The AFC Hub is a competitive Free Fire esports platform. Players create a
              profile, build and manage teams, register for tournaments and scrims, climb
              the monthly rankings, and track their match stats and achievements, all in
              one place.
            </p>
          </CardContent>
        </Card>

        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle>Signing in with Google</CardTitle>
          </CardHeader>
          <CardContent className="text-sm md:text-base text-muted-foreground">
            <p>
              Signing in with Google is optional. If you choose it, AFC only uses your
              name and email address to create and sign you into your AFC account. We
              never post to your Google account or access any other Google data. See our{" "}
              <a href="/privacy-policy" className="text-primary hover:underline">
                Privacy Policy
              </a>{" "}
              for how your data is handled.
            </p>
          </CardContent>
        </Card>

        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle>Our Values</CardTitle>
          </CardHeader>
          <CardContent className="text-sm md:text-base text-muted-foreground">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Integrity: We uphold the highest standards of fair play and
                sportsmanship.
              </li>
              <li>
                Community: We foster a supportive and inclusive environment for
                all players.
              </li>
              <li>
                Excellence: We strive for continuous improvement and excellence
                in all our endeavors.
              </li>
              <li>
                Innovation: We embrace new technologies and strategies to
                advance the Freefire esports scene.
              </li>
              <li>
                Empowerment: We provide resources and opportunities for players
                to develop their skills and achieve their goals.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
