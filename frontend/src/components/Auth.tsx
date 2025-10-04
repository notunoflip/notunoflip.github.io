import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

interface AuthProps {
  onLogin: (session: Session) => void;
  setStatus: (msg: string) => void;
}

export default function Auth({ onLogin, setStatus }: AuthProps) {
  const [userEmail, setUserEmail] = useState("");
  const [loginCode, setLoginCode] = useState("");

  const handleMagicLinkLogin = async () => {
    if (!userEmail) return setStatus("Please enter your email.");
    const { error } = await supabase.auth.signInWithOtp({
      email: userEmail,
      options: { 
        emailRedirectTo: window.location.origin // emailRedirectTo: "http://localhost:5173/",
    },
    });
    if (error) setStatus(`Login error: ${error.message}`);
    else setStatus(`Magic link sent to ${userEmail}. Check Mailpit at http://127.0.0.1:54324`);
  };


  const handleCodeLogin = async () => {
    if (!userEmail || !loginCode) return setStatus("Enter email and code.");
    const { data, error } = await supabase.auth.verifyOtp({
      email: userEmail,
      token: loginCode,
      type: "magiclink",
    });
    if (error) setStatus(`Code login error: ${error.message}`);
    else {
      setStatus(`Logged in as ${data?.user?.email}`);
      if (data.session) onLogin(data.session);
    }
  };

  return (
    <div className="space-y-2">
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
    </div>
  );
}
