import { getServerSession } from "next-auth/next"
import { authOptions } from "../pages/api/auth/[...nextauth]"

export async function getAuthSession() {
  return await getServerSession(authOptions)
}
