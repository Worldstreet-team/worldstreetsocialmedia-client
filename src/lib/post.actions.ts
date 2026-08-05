"use server";

import { BACKEND_URL } from "@/const";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";

const API_URL = BACKEND_URL;

export async function createPostAction(formData: FormData) {
	const { getToken } = await auth();
	const accessToken = await getToken();

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

export async function likePostAction(postId: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	try {
		const res = await axios.post(
			`${API_URL}/api/posts/${postId}/like`,
			{},
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);
		return { success: true, likes: res.data.likes };
	} catch (error: any) {
		console.error("Like Post Error:", error.response?.data || error.message);
		return { success: false, message: "Failed to like post" };
	}
}

export async function unlikePostAction(postId: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.post(
			`${API_URL}/api/posts/${postId}/unlike`,
			{},
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);
		return { success: true, likes: res.data.likes };
	} catch (error: any) {
		console.error("Unlike Post Error:", error.response?.data || error.message);
		return { success: false, message: "Failed to unlike post" };
	}
}

export async function bookmarkPostAction(postId: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		await axios.post(
			`${API_URL}/api/posts/${postId}/bookmark`,
			{},
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);
		return { success: true };
	} catch (error: any) {
		console.error(
			"Bookmark Post Error:",
			error.response?.data || error.message,
		);
		return { success: false, message: "Failed to bookmark post" };
	}
}

export async function unbookmarkPostAction(postId: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		await axios.post(
			`${API_URL}/api/posts/${postId}/unbookmark`,
			{},
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);
		return { success: true };
	} catch (error: any) {
		console.error(
			"Unbookmark Post Error:",
			error.response?.data || error.message,
		);
		return { success: false, message: "Failed to unbookmark post" };
	}
}

export async function getBookmarksAction() {
	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.get(`${API_URL}/api/posts/bookmarks`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return { success: true, data: res.data };
	} catch (error: any) {
		console.error(
			"Get Bookmarks Error:",
			error.response?.data || error.message,
		);
		return { success: false, message: "Failed to fetch bookmarks" };
	}
}

export async function getPostByIdAction(postId: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.get(`${API_URL}/api/posts/${postId}`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return { success: true, data: res.data };
	} catch (error: any) {
		console.error(
			"Get Post By ID Error:",
			error.response?.data || error.message,
		);
		return { success: false, message: "Failed to fetch post" };
	}
}

export async function getPostCommentsAction(postId: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.get(`${API_URL}/api/posts/${postId}/comments`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return { success: true, data: res.data };
	} catch (error: any) {
		console.error(
			"Get Post Comments Error:",
			error.response?.data || error.message,
		);
		return { success: false, message: "Failed to fetch comments" };
	}
}

export async function replyToPostAction(postId: string, content: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.post(
			`${API_URL}/api/posts/${postId}/reply`,
			{ content },
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);
		return { success: true, data: res.data };
	} catch (error: any) {
		console.error("Reply Post Error:", error.response?.data || error.message);
		return { success: false, message: "Failed to reply to post" };
	}
}

export async function deletePostAction(postId: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.delete(`${API_URL}/api/posts/${postId}`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return { success: true, data: res.data };
	} catch (error: any) {
		console.error("Delete Post Error:", error.response?.data || error.message);
		return { success: false, message: "Failed to delete post" };
	}
}

export async function getExploreDataAction() {
	const { getToken } = await auth();
	const accessToken = await getToken();
	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.get(`${API_URL}/api/posts/explore`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return { success: true, data: res.data };
	} catch (error: any) {
		console.error(
			"Get Explore Data Error:",
			error.response?.data || error.message,
		);
		return { success: false, message: "Failed to fetch explore data" };
	}
}
export async function getLinkPreviewAction(url: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	// Public endpoint but might need auth if we want to rate limit or something.
	// Our util route is at /api/util/link-preview
	// Using auth just in case.

	try {
		const res = await axios.get(
			`${API_URL}/api/util/link-preview?url=${encodeURIComponent(url)}`,
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);
		return { success: true, data: res.data.data };
	} catch (error: any) {
		console.error(
			"Get Link Preview Error:",
			error.response?.data || error.message,
		);
		return { success: false, message: "Failed to fetch link preview" };
	}
}

export async function searchPostsAction(query: string) {
	const { getToken } = await auth();
	const accessToken = await getToken();

	if (!accessToken) return { success: false, message: "Unauthorized" };

	try {
		const res = await axios.get(`${API_URL}/api/posts/search`, {
			params: { q: query },
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		return { success: true, data: res.data.data };
	} catch (error: any) {
		console.error(
			"Search Posts Error:",
			error.response?.data || error.message,
		);
		return {
			success: false,
			message: error.response?.data?.message || "Failed to search posts",
		};
	}
}
