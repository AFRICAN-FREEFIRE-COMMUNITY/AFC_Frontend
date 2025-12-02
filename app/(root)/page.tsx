"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import {
  Trophy,
  Users,
  Calendar,
  Star,
  Target,
  Shield,
  Award,
  GamepadIcon,
  Crown,
  Flame,
} from "lucide-react";
import { formatMoneyInput } from "@/lib/utils";
import axios from "axios";
import { env } from "@/lib/env";
import { Footer } from "../_components/Footer";
import { Header } from "../(user)/_components/Header";

const page = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const features = [
    {
      icon: Trophy,
      title: "Competitive Tournaments",
      description:
        "Join high-stakes tournaments with amazing prizes and recognition in the AFC community.",
    },
    {
      icon: Users,
      title: "Team Management",
      description:
        "Create and manage your esports team with advanced roster and strategy tools.",
    },
    {
      icon: Target,
      title: "Skill Rankings",
      description:
        "Track your progress with our comprehensive ranking system and leaderboards.",
    },
    {
      icon: Calendar,
      title: "Event Scheduling",
      description:
        "Never miss a match with our integrated calendar and notification system.",
    },
    {
      icon: Shield,
      title: "Fair Play",
      description:
        "Compete in a secure environment with anti-cheat measures and fair play policies.",
    },
    {
      icon: Award,
      title: "Achievements",
      description:
        "Unlock badges, titles, and rewards as you climb the competitive ladder.",
    },
  ];

  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [totalTeams, setTotalTeams] = useState<number>(0);

  useEffect(() => {
    const fetchUsers = async () => {
      const users = await axios(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-total-number-of-users/`
      );
      const teams = await axios(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`
      );
      setTotalUsers(users?.data?.total_users);
      setTotalTeams(teams?.data?.teams.length);
    };

    fetchUsers();
  }, []);

  const stats = [
    {
      label: "Active Players",
      value: `${formatMoneyInput(totalUsers)}+`,
      icon: Users,
    },
    { label: "Tournaments Held", value: "1,200+", icon: Trophy },
    { label: "Prize Pool Distributed", value: "$500K+", icon: Crown },
    {
      label: "Teams Registered",
      value: `${formatMoneyInput(totalTeams)}+`,
      icon: Shield,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-gold/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 py-24 relative z-10">
          <div
            className={`text-center transition-all duration-1000 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            }`}
          >
            <Badge className="mb-6 bg-primary/20 text-primary border-primary/30 hover:bg-primary/30">
              <Flame className="w-4 h-4 mr-2" />
              Season 2025 Now Live
            </Badge>

            <h1 className="text-5xl md:text-7xl font-bold mb-4">
              <span className="bg-gradient-to-r from-primary via-gold to-primary bg-clip-text text-transparent">
                Dominate
              </span>
              <br />
              <span className="text-foreground">the Arena</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join the ultimate Free Fire competitive platform. Compete in
              tournaments, climb rankings, and prove you're the best player in
              the AFC community.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {/* <Link href="/create-account">
                <Button

                  className="bg-gradient-to-r from-primary to-[var(--gold)] hover:from-primary/90 hover:to-[hsl(var(--gold))]/90 text-primary-foreground px-8 py-6 text-lg"
                >
                  <GamepadIcon className="w-5 h-5 mr-2" />
                  Start Competing
                </Button>
              </Link>
              <Link href="/tournaments">
                <Button

                  variant="outline"
                  className="border-primary/30 text-primary hover:bg-primary/10 px-8 py-6 text-lg bg-transparent"
                >
                  <Trophy className="w-5 h-5 mr-2" />
                  View Tournaments
                </Button>
              </Link> */}
              <Link href="/create-account">
                <Button variant="gradient">
                  <Star />
                  Create Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gradient-to-r from-background via-primary/5 to-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/20 text-gold mb-4">
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="text-3xl font-bold text-gold mb-2">
                  {stat.value}
                </div>
                <div className="text-muted-foreground text-sm">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-primary">Why Choose</span> AFC Esports?
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience the most comprehensive Free Fire competitive platform
              with features designed for serious players.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="bg-background/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
              >
                <CardContent>
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/20 text-gold mb-4 transition-transform hover:scale-110">
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-primary">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary/10 via-background to-gold/10">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to <span className="text-primary">Level Up</span> Your Game?
            </h2>
            <p className="text-base md:text-lg text-muted-foreground mb-4">
              Join thousands of players competing for glory, prizes, and the
              ultimate bragging rights in Free Fire.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/create-account">
                <Button variant="gradient" className="w-full">
                  <Star className="w-5 h-5 mr-2" />
                  Create Account
                </Button>
              </Link>
              <Link href="/about">
                <Button variant="outline" className="w-full">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default page;
