import { useEffect, useState } from "react";
import axios from "axios";

export default function Social() {
  const [users, setUsers] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const [usersRes, followersRes, followingRes] = await Promise.all([
        axios.get("/api/social/users"),
        axios.get("/api/social/followers"),
        axios.get("/api/social/following")
      ]);

      setUsers(usersRes.data);
      setFollowers(followersRes.data);
      setFollowing(followingRes.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to load social data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFollow = async (userId) => {
    try {
      await axios.post(`/api/social/follow/${userId}`);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to follow user");
    }
  };

  const handleUnfollow = async (userId) => {
    try {
      await axios.delete(`/api/social/follow/${userId}`);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to unfollow user");
    }
  };

  if (loading) {
    return <div className="p-6">Loading social data...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Social</h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-5">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">
            Following ({following.length})
          </h2>

          {following.length === 0 ? (
            <p className="text-gray-500">You are not following anyone.</p>
          ) : (
            <div className="space-y-3">
              {following.map((user) => (
                <div
                  key={user.USERID}
                  className="border rounded-lg p-3"
                >
                  <p className="font-semibold">
                    {user.FIRSTNAME} {user.LASTNAME}
                  </p>
                  <p className="text-sm text-gray-500">
                    {user.EMAIL}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">
            Followers ({followers.length})
          </h2>

          {followers.length === 0 ? (
            <p className="text-gray-500">You have no followers.</p>
          ) : (
            <div className="space-y-3">
              {followers.map((user) => (
                <div
                  key={user.USERID}
                  className="border rounded-lg p-3"
                >
                  <p className="font-semibold">
                    {user.FIRSTNAME} {user.LASTNAME}
                  </p>
                  <p className="text-sm text-gray-500">
                    {user.EMAIL}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold mb-5">Find People</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {users.map((user) => (
            <div
              key={user.USERID}
              className="border rounded-xl p-5 shadow-sm"
            >
              <div className="text-4xl mb-3">👤</div>

              <h3 className="text-xl font-bold">
                {user.FIRSTNAME} {user.LASTNAME}
              </h3>

              <p className="text-gray-500 mb-4">
                {user.EMAIL}
              </p>

              {user.ISFOLLOWING === 1 ? (
                <button
                  onClick={() => handleUnfollow(user.USERID)}
                  className="bg-gray-600 text-white px-5 py-2 rounded-lg font-semibold"
                >
                  Unfollow
                </button>
              ) : (
                <button
                  onClick={() => handleFollow(user.USERID)}
                  className="bg-garmin-blue text-white px-5 py-2 rounded-lg font-semibold"
                >
                  Follow
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}