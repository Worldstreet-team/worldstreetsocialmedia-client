import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = { title: "Admin" };

/**
 * Its own hub, like the Studio: outside the (main) group, so none of the
 * social rails come with it.
 *
 * There is no client-side permission check here on purpose. The gateway
 * answers every /api/admin call with a 404 for anyone who is not staff, so a
 * non-staff visitor reaches an empty console rather than data. A guard here
 * would be a nicety; it would not be the security boundary, and writing one
 * as though it were is how people end up trusting it.
 */
export default function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <AdminShell>{children}</AdminShell>;
}
