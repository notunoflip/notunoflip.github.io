import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Session, User } from "@supabase/supabase-js";

interface AuthProps {
  onLogin: (session: Session) => void;
  setStatus: (msg: string) => void;
}

export default function Auth({ onLogin, setStatus }: AuthProps) {
  const [userEmail, setUserEmail] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [needNickname, setNeedNickname] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const handleMagicLinkLogin = async () => {
    if (!userEmail) return setStatus("Please enter your email.");
    const { error } = await supabase.auth.signInWithOtp({
      email: userEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setStatus(`Login error: ${error.message}`);
    else setStatus(`Magic link sent to ${userEmail}.`);
  };

  const handleCodeLogin = async () => {
    if (!userEmail || !loginCode) return setStatus("Enter email and code.");
    const { data, error } = await supabase.auth.verifyOtp({
      email: userEmail,
      token: loginCode,
      type: "magiclink",
    });
    if (error) {
      setStatus(`Code login error: ${error.message}`);
    } else {
      setStatus(`Logged in as ${data?.user?.email}`);
      if (data.session && data.user) {
        await ensurePlayerExists(data.user);
        onLogin(data.session);
      }

    }
  };

  const ensurePlayerExists = async (user: User) => {
    setCurrentUser(user);

    // check if player exists
    const { data: players, error } = await supabase
      .from("players")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error && error.code === "PGRST116") {
      // player doesn't exist -> create
      const { error: insertError } = await supabase
        .from("players")
        .insert([{ id: user.id, email: user.email }]);
      if (insertError) {
        setStatus("Error creating player: " + insertError.message);
        return;
      }
      setNeedNickname(true); // force nickname prompt after first creation
    } else if (players && !players.nickname) {
      setNeedNickname(true);
    }
  };

  const handleSaveNickname = async () => {
    if (!nickname || !currentUser) return;
    const { error } = await supabase
      .from("players")
      .update({ nickname })
      .eq("id", currentUser.id);

    if (error) setStatus("Error saving nickname: " + error.message);
    else {
      setNeedNickname(false);
      setStatus("Nickname saved!");
    }
  };

  return (
    <div className="space-y-2">
      {!needNickname ? (
        <>
          <input
            type="email"
            placeholder="Enter your email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            className="px-2 py-1 border rounded dark:bg-gray-800 dark:text-white"
          />
          <button
            onClick={handleMagicLinkLogin}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
          >
            Send Magic Link
          </button>

          <input
            type="text"
            placeholder="Or enter code from email"
            value={loginCode}
            onChange={(e) => setLoginCode(e.target.value)}
            className="px-2 py-1 border rounded dark:bg-gray-800 dark:text-white"
          />
          <button
            onClick={handleCodeLogin}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Login with Code
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Choose a nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="px-2 py-1 border rounded dark:bg-gray-800 dark:text-white"
          />
          <button
            onClick={handleSaveNickname}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Save Nickname
          </button>
        </div>
      )}
    </div>
  );
}
