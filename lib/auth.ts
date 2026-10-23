import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { role: { select: { id: true, name: true } } },
        })

        if (!user || !user.password) {
          return null
        }

        // A deactivated account cannot sign in. Checked before the password so a
        // deactivated person learns nothing about whether their password still works.
        if (!user.isActive) {
          return null
        }

        // Hash comparison only. A stored value that is not a bcrypt hash can never
        // authenticate — plaintext passwords are not a supported state.
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          image: user.avatar,
          roleId: user.role?.id?.toString() || null,
          role: user.role?.name ?? null,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id
        token.roleId = (user as any).roleId
        token.role = (user as any).role
        token.picture = (user as any).image ?? null
      }
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name
        if (session.image !== undefined) token.picture = session.image
        if (session.user?.name) token.name = session.user.name
        if (session.user?.image !== undefined) token.picture = session.user.image
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        ;(session.user as any).roleId = token.roleId as string | null
        ;(session.user as any).role = token.role as string
        if (token.name) session.user.name = token.name
        if (token.picture) session.user.image = token.picture as string
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Allow relative URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allow same-origin URLs
      try {
        const urlObj = new URL(url)
        if (urlObj.origin === baseUrl) return url
        // Allow the production domain to be redirected to (for email links)
        const allowedOrigins = [
          baseUrl,
          process.env.NEXT_PUBLIC_BASE_URL || "",
        ].filter(Boolean)
        if (allowedOrigins.some(origin => urlObj.origin === new URL(origin).origin)) {
          return url
        }
      } catch {}
      return `${baseUrl}/dashboard`
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  debug: process.env.NODE_ENV === "development",
}