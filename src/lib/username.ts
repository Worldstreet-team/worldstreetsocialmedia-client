/**
 * One definition of a legal handle, shared by the onboarding field and the
 * gateway's own check — so the field cannot promise a username the submit
 * will then reject.
 *
 * Deliberately NOT in `user.actions.ts`: that file is `"use server"`, and a
 * server-action module may only export async functions. Exporting this
 * constant from there compiled fine and then 500'd the whole app at runtime.
 *
 * 3-20 keeps a handle addressable: a 1-character one cannot be searched for,
 * and an unbounded one breaks every truncating row in the app.
 */
export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
