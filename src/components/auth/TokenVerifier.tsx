import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import axios from "axios";
import { BACKEND_URL } from "@/const";

export const TokenVerifier = async () => {
    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;    

    if (!token) return null;

    const headerList = await headers();
    const pathname =
        headerList.get("x-pathname") ||
        headerList.get("referer") ||
        "";

    if (pathname.includes("/onboarding")) {
        return null;
    }

    try {
        const syncRes = await axios.get(`${BACKEND_URL}/api/users/sync`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        console.log("RES: ", syncRes.data)
        
        if (syncRes.data.status === "not_found") {
            redirect("/onboarding");
        }
    } catch (error: any) {
        if (error?.digest?.startsWith("NEXT_REDIRECT")) { 
            throw error;
        }
        console.error("Sync error:", error);
    }

    return null;
};