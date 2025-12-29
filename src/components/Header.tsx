import { User, LogOut, Settings, DoorOpen } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useState, useRef, useEffect } from "react";
import { useNickname } from "../hooks/useNickname"; // adjust path if needed
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

const LOCAL_EDGE_URL = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";

interface HeaderProps {
  session: Session | null;
  onLogout: () => void;
  onSettings: () => void; // callback for opening settings
}

const Header: React.FC<HeaderProps> = ({ session, onLogout, onSettings }) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { nickname, loading } = useNickname();
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { roomCode } = useParams<{ roomCode: string }>();
  const isInRoom = !!roomCode;


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLeaveRoom = async () => {
    if (!session) return;
    if (!roomCode) {
      toast.error("No active room found.");
      return;
    }

    try {
      toast.info("Leaving room...");

      const res = await fetch(`${LOCAL_EDGE_URL}/leave-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ roomCode }), 
      });



      if (!res.ok) throw new Error(await res.text());
      localStorage.removeItem("pendingRoomRedirect");


      // cleanup local state
      toast.success("You left the room.");
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      navigate("/", { replace: true });
    }
  };

  return (
    <header className="absolute top-0 left-0 w-full z-50 bg-gray-200 dark:bg-gray-800 shadow h-16 flex items-center justify-between px-4 z-100">
      {/* Logo + Title */}
      <div className="flex items-center space-x-1">
        <img src="/logo_flip.png" alt="NotUnoFlip" className="h-8 w-8 rounded" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">UnoFlip.site</h1>
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-4 relative">

        {/* User info + dropdown */}
        {session ? (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen(o => !o)}
              className="flex items-center space-x-2 px-2 py-1 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition"
            >
              <User className="w-6 h-6 text-gray-900 dark:text-white" />
              {!loading && (
                <span className="text-gray-900 dark:text-white text-sm">
                  {nickname || "User"}
                </span>
              )}
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={() => {
                    onSettings();
                    setUserMenuOpen(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  <Settings size={16} className="mr-2" />
                  Settings
                </button>
                {isInRoom ? (
                  <button
                    onClick={() => {
                      handleLeaveRoom();
                      setUserMenuOpen(false);
                    }}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <DoorOpen size={16} className="mr-2" />
                    Leave Room
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onLogout();
                      setUserMenuOpen(false);
                    }}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <LogOut size={16} className="mr-2" />
                    Logout
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <span className="text-gray-900 dark:text-white text-sm">Not logged in</span>
        )}
      </div>
    </header>
  );
};

export default Header;
