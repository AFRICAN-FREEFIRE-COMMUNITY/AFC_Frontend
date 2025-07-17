import type React from "react"
import Layout from "@/components/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

const data = [
  { name: "Jan", kills: 40, wins: 5 },
  { name: "Feb", kills: 45, wins: 6 },
  { name: "Mar", kills: 55, wins: 8 },
  { name: "Apr", kills: 60, wins: 10 },
  { name: "May", kills: 75, wins: 12 },
  { name: "Jun", kills: 80, wins: 15 },
]

const Dashboard: React.FC = () => {
  return (
    <Layout>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Kills</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-[#FFD700]">355</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tournament Wins</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-[#FFD700]">15</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>MVPs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-[#FFD700]">8</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Current Rank</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-[#FFD700]">#3</p>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="kills" stroke="#FFD700" />
              <Line yAxisId="right" type="monotone" dataKey="wins" stroke="#FF4655" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </Layout>
  )
}

export default Dashboard
