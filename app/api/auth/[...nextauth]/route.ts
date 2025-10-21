import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "admin" },
        password: { label: "Password", type: "password", placeholder: "password" },
      },
      async authorize(credentials, req) {
        // **Placeholder authentication logic - replace with your actual implementation**
        if (credentials?.username === "admin" && credentials?.password === "password") {
          // Any object returned will be saved in `user` property of the JWT
          return Promise.resolve({ id: "1", name: "Admin User", email: "admin@example.com" })
        }

        // If no error and we return null, the next-auth user will be undefined.
        return Promise.resolve(null)
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET, // Replace with your actual secret
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.user = user
      }
      return token
    },
    async session({ session, token }) {
      session.user = token.user
      return session
    },
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
