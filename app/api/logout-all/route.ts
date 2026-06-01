import { NextRequest, NextResponse } from "next/server";
import { getUserID } from "@/lib/auth/get-user-id";
import { createClient } from "@/lib/supabase/server";

export const POST = async (req: NextRequest) => {
  try {
    const userId = await getUserID(req);

    if (userId) {
      const supabase = await createClient();
      // To sign out globally:
      await supabase.auth.signOut({ scope: "global" });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An error occurred";
    console.error("Failed to logout all sessions:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
};
