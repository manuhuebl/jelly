"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_COOKIE = "jelly_planner_auth";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/");
  const expectedPassword = process.env.PLANNER_PASSWORD;

  if (!expectedPassword || password !== expectedPassword) {
    redirect(`/login?error=1&next=${encodeURIComponent(nextPath)}`);
  }

  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE, `jelly:${expectedPassword}`, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  redirect(nextPath.startsWith("/") ? nextPath : "/");
}
