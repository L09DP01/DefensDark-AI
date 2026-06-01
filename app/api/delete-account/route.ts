import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const POST = async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // MOCK: Replace with Supabase account deletion logic
    // Example: await supabase.auth.admin.deleteUser(session.user.id)

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }
};
