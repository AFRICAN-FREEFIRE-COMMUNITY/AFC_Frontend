import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ContactForm } from "./_components/ContactForm";

export default function ContactPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Contact Us</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ContactForm />

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">Email</h3>
                  <p>support@afcdatabase.com</p>
                </div>
                <div>
                  <h3 className="font-semibold">Discord</h3>
                  <p>
                    Join our Discord server:{" "}
                    <a
                      href="https://discord.gg/afcdatabase"
                      className="text-primary hover:underline"
                    >
                      AFC Database
                    </a>
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold">Social Media</h3>
                  <ul className="list-disc pl-5">
                    <li>
                      <a
                        href="https://twitter.com/afcdatabase"
                        className="text-primary hover:underline"
                      >
                        Twitter
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://facebook.com/afcdatabase"
                        className="text-primary hover:underline"
                      >
                        Facebook
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://instagram.com/afcdatabase"
                        className="text-primary hover:underline"
                      >
                        Instagram
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
