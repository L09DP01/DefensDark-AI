import { redirect } from "next/navigation";

export async function GET(request: Request) {
  // NextAuth v5 provides signin/signup in the same default UI or we can handle it custom
  redirect("/api/auth/signin");
}
