import { auth } from "@/src/auth/auth";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    return await auth.handler(request);
  } catch (err: any) {
    console.error("Auth GET error handler:", err);
    if (request.url.includes("get-session")) {
      return Response.json(null, {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie":
            "better-auth.session_data=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax",
        },
      });
    }
    return Response.json({ error: err?.message || "Authentication error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    return await auth.handler(request);
  } catch (err: any) {
    console.error("Auth POST error handler:", err);
    return Response.json({ error: err?.message || "Authentication error" }, { status: 500 });
  }
}
