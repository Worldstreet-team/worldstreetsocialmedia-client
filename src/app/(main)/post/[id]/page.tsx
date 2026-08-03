import PostPageScreen from "./PostPageScreen";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Post" };

const PostPage = () => {
	return (
		<PostPageScreen />
	)
}

export default PostPage