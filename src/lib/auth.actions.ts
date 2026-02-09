'use server'

import { cookies } from "next/headers";

export async function updateSession(accessToken: string, refreshToken: string) {
    const cookieStore = await cookies();
    cookieStore.set("accessToken", accessToken, { httpOnly: true, secure: true, path: "/" });
    cookieStore.set("refreshToken", refreshToken, { httpOnly: true, secure: true, path: "/" });
}

export async function clearSession() {
    const cookieStore = await cookies();
    cookieStore.delete("accessToken");
    cookieStore.delete("refreshToken");
}