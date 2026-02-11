import UserProfilePage from "./Profile";

const UserProfile = (props: { params: Promise<{ username: string }> }) => {
	return <UserProfilePage params={props.params} />;
};

export default UserProfile;
