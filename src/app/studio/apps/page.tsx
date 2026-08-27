import { redirect } from "next/navigation";

/**
 * Apps was a page of nine links — a card's worth of content wearing a whole
 * route. The ecosystem strip now lives on the overview; old bookmarks land
 * there instead of 404ing.
 */
export default function StudioApps() {
	redirect("/studio");
}
