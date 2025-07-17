import Layout from "@/components/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AboutPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">About AFC</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Our Mission</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              The African Freefire Community (AFC) is dedicated to fostering a competitive and supportive environment
              for Freefire players across Africa. Our mission is to promote esports, develop talent, and create
              opportunities for players to showcase their skills on a global stage.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Our Vision</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              We envision a thriving African Freefire esports scene that is recognized worldwide for its talent,
              passion, and professionalism. Through our efforts, we aim to elevate African players and teams to compete
              at the highest levels of international tournaments.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Our Values</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2">
              <li>Integrity: We uphold the highest standards of fair play and sportsmanship.</li>
              <li>Community: We foster a supportive and inclusive environment for all players.</li>
              <li>Excellence: We strive for continuous improvement and excellence in all our endeavors.</li>
              <li>Innovation: We embrace new technologies and strategies to advance the Freefire esports scene.</li>
              <li>
                Empowerment: We provide resources and opportunities for players to develop their skills and achieve
                their goals.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
