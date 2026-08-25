"use server";

import { auth } from "@clerk/nextjs/server";
import axios from "axios";
import { BACKEND_URL } from "@/const";

const API_URL = BACKEND_URL;

/* Shapes mirror the gateway's getStoriesRail response
   (worldstreetsocialmedia-gateway story.controller.ts). */

export interface StoryAuthor {
  _id: string;
  userId: string;
  username: string;
  avatar?: string;
  isVerified?: boolean;
  firstName?: string;
  lastName?: string;
}

export interface StoryItem {
  id: string;
  media: { url: string; type: "image" | "video" };
  caption?: string;
  origin: "upload" | "live";
  streamRef?: string;
  createdAt: string;
  seen: boolean;
}

export interface StoryRailEntry {
  author: StoryAuthor;
  stories: StoryItem[];
  hasUnseen: boolean;
  isLive: boolean;
  isSelf: boolean;
}

export async function getStoriesAction() {
  const { getToken } = await auth();
  const accessToken = await getToken();

  if (!accessToken) {
    return { success: false as const, message: "Unauthorized" };
  }

  try {
    const res = await axios.get(`${API_URL}/api/stories`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return {
      success: true as const,
      data: (res.data?.rail ?? []) as StoryRailEntry[],
    };
  } catch (error: any) {
    console.error(
      "Stories Rail Error:",
      error.response?.data?.message || error.message,
    );
    return { success: false as const, message: "Failed to load stories" };
  }
}

/** formData: `media` (file) + optional `caption`. */
export async function createStoryAction(formData: FormData) {
  const { getToken } = await auth();
  const accessToken = await getToken();

  if (!accessToken) {
    return { success: false as const, message: "Unauthorized" };
  }

  try {
    const res = await axios.post(`${API_URL}/api/stories`, formData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // No Content-Type: axios sets the multipart boundary itself.
      },
    });
    return { success: true as const, data: res.data };
  } catch (error: any) {
    console.error(
      "Create Story Error:",
      error.response?.data?.message || error.message,
    );
    return {
      success: false as const,
      message: error.response?.data?.message || "Failed to post story",
    };
  }
}

export async function viewStoryAction(storyId: string) {
  const { getToken } = await auth();
  const accessToken = await getToken();

  if (!accessToken) {
    return { success: false as const, message: "Unauthorized" };
  }

  try {
    await axios.post(
      `${API_URL}/api/stories/${storyId}/view`,
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return { success: true as const };
  } catch (error: any) {
    console.error(
      "View Story Error:",
      error.response?.data?.message || error.message,
    );
    return { success: false as const, message: "Failed to record view" };
  }
}
