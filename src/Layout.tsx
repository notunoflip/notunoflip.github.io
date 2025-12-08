// frontend/src/Layout.tsx
import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Header from "./components/Header";
import { supabase } from "./lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { Toaster as Sonner, toast } from "sonner";

export default function Layout() {
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    // Listen to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        toast.success(`Logged in as ${session.user.email}`);

        // Check for pending redirect
        const pending = localStorage.getItem("pendingRoomRedirect");
        if (pending) {
          localStorage.removeItem("pendingRoomRedirect");
          navigate(pending);
          return;
        }
      }
      else {
        toast.info("You have been logged out");
        navigate("/");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    // Save current URL if it is a room URL
    const currentPath = window.location.pathname;

    // Only store if user is actually in a room
    if (currentPath.startsWith("/room/")) {
      localStorage.setItem("pendingRoomRedirect", currentPath);
    }

    await supabase.auth.signOut();
    setSession(null);
    toast.success("Successfully logged out");
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Global toast container */}
      <Sonner richColors position="bottom-right" />

      {/* Header is always on top */}
      <Header session={session} onLogout={handleLogout} onSettings={function (): void {
        throw new Error("Function not implemented.");
      }} />

      {/* Main content of the page */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-700 via-green-800 to-green-900 dark:from-gray-700 dark:via-gray-800 dark:to-gray-900">
        <Outlet context={{ session }} />
      </div>
    </div>
  );
}
