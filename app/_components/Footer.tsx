import { Logo } from "@/components/Logo";
import Link from "next/link";
import React from "react";

export const Footer = () => {
  return (
    <footer className="border-t border-border/40 bg-background/50 backdrop-blur-sm mt-12">
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Logo size="small" />
              <span className="text-lg font-bold text-primary">AFC</span>
            </div>
            <p className="text-muted-foreground text-sm">
              The premier Free Fire competitive platform for serious players.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-primary">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/tournaments"
                  className="hover:text-primary transition-colors"
                >
                  Tournaments
                </Link>
              </li>
              {/* <li>
                  <Link
                    href="/rankings"
                    className="hover:text-primary transition-colors"
                  >
                    Rankings
                  </Link>
                </li> */}
              <li>
                <Link
                  href="/teams"
                  className="hover:text-primary transition-colors"
                >
                  Teams
                </Link>
              </li>
              <li>
                <Link
                  href="/awards"
                  className="hover:text-primary transition-colors"
                >
                  Awards
                </Link>
              </li>
              {/* <li>
                  <Link
                    href="/players"
                    className="hover:text-primary transition-colors"
                  >
                    Players
                  </Link>
                </li> */}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-primary">Community</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/about"
                  className="hover:text-primary transition-colors"
                >
                  About us
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-primary transition-colors"
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  href="/news"
                  className="hover:text-primary transition-colors"
                >
                  News
                </Link>
              </li>
              <li>
                <Link
                  href="/teams"
                  className="hover:text-primary transition-colors"
                >
                  Teams
                </Link>
              </li>
              <li>
                <Link
                  href="/rules"
                  className="hover:text-primary transition-colors"
                >
                  Rules
                </Link>
              </li>
              {/* <li>
                  <Link
                    href="/shop"
                    className="hover:text-primary transition-colors"
                  >
                    Shop
                  </Link>
                </li> */}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-primary">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/terms-of-service"
                  className="hover:text-primary transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy-policy"
                  className="hover:text-primary transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t text-sm border-border/40 mt-8 pt-6 flex flex-col md:flex-row justify-between text-muted-foreground font-medium items-center">
          <p>© 2025 African Freefire Community. All rights reserved.</p>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <span>Powered by AFC Gaming</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
