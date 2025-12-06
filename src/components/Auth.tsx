import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";

interface AuthProps {
  onLogin: (session: Session) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [userEmail, setUserEmail] = useState("");
  const [loginCode, setLoginCode] = useState("");

  // ────────────────────────────────────────────────
  // Request magic link
  const handleMagicLinkLogin = async () => {
    if (!userEmail) return toast.error("Please enter your email.");

    const { error } = await supabase.auth.signInWithOtp({
      email: userEmail,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) toast.error(`Login error: ${error.message}`);
    else toast.success(`Magic link sent to ${userEmail}.`);
  };

  // ────────────────────────────────────────────────
  // Verify OTP
  const handleCodeLogin = async () => {
    if (!userEmail || !loginCode) return toast.error("Enter email and code.");

    const { data, error } = await supabase.auth.verifyOtp({
      email: userEmail,
      token: loginCode,
      type: "magiclink",
    });

    if (error) return toast.error(`Code login error: ${error.message}`);

    const session = data.session;
    if (!session) return toast.error("Missing session data.");

    toast.success(`Logged in as ${userEmail}`);
    onLogin(session);
  };

  // ────────────────────────────────────────────────
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