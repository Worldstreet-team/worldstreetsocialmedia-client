"use server";

import { BACKEND_URL } from "@/const";
import axios from "axios";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || BACKEND_URL;

export async function createPostAction(formData: FormData) {
	const cookieStore = await cookies();
	const accessToken = cookieStore.get("accessToken")?.value;

	if (!accessToken) {
		return { success: false, message: "Unauthorized: No access token found" };
	}

	try {
		const response = await axios.post(`${API_URL}/api/posts`, formData, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				// Note: Don't set 'Content-Type'; Axios sets the boundary for FormData automatically
			},
		});

		// Axios automatically parses JSON and puts it in .data
		return { success: true, data: response.data };
	} catch (error) {
		console.log("ERROR: ", error);
		// Axios catches all non-2xx responses here
		if (axios.isAxiosError(error)) {
			const serverMessage = error.response?.data?.message;
			console.error("API Error:", serverMessage || error.message);

			return {
				success: false,
				message: serverMessage || "Failed to create post",
			};
		}

		console.error("Unexpected Error:", error);
		return { success: false, message: "Something went wrong" };
	}
}
