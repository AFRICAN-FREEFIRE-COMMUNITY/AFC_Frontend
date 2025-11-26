import { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "About Us",
  description:
    "Learn about the African Freefire Community (AFC) - our mission to foster competitive esports, develop talent, and create opportunities for Free Fire players across Africa.",
  keywords: [
    "about AFC",
    "African esports organization",
    "Free Fire Africa mission",
    "esports community Africa",
  ],
  url: "/about",
});

export default function AboutPage() {
  return (
    <div>
      <h1 className="text-3xl md:text-4xl mb-8 font-bold">About AFC</h1>
      <div className="space-y-4">
        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle>Our Mission</CardTitle>
          </CardHeader>
          <CardContent className="text-sm md:text-base text-muted-foreground">
            <p>
              The African Freefire Community (AFC) is dedicated to fostering a
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
              We envision a thriving African Freefire esports scene that is
              recognized worldwide for its talent, passion, and professionalism.
              Through our efforts, we aim to elevate African players and teams
              to compete at the highest levels of international tournaments.
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
