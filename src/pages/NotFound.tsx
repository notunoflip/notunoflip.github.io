import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

export default function RedirectToLobby() {
  useEffect(() => {
    toast.error("Page not found");
  }, []);

  return <Navigate to="/" replace />;
}