import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";

interface AuthProps {
  onLogin: (session: Session) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [userEmail, setUserEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === "code") inputRefs.current[0]?.focus();
  }, [step]);

  // Request magic link
  const handleMagicLinkLogin = async () => {
    if (!userEmail) return toast.error("Please enter your email.");
    
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: userEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);

    if (error) {
      toast.error(`Login error: ${error.message}`);
    } else {
      toast.success(`Magic link sent to ${userEmail}.`);
      setStep("code");
    }
  };

  // Verify OTP
  const handleCodeLogin = async (code: string) => {
    if (!userEmail || !code) return toast.error("Enter email and code.");
    
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: userEmail,
      token: code,
      type: "magiclink",
    });
    setLoading(false);

    if (error) {
      toast.error(`Code login error: ${error.message}`);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      return;
    }

    const session = data.session;
    if (!session) return toast.error("Missing session data.");
    
    toast.success(`Logged in as ${userEmail}`);
    onLogin(session);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d) && index === 5) handleCodeLogin(newOtp.join(""));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = [...otp];
    
    for (let i = 0; i < paste.length; i++) newOtp[i] = paste[i];
    setOtp(newOtp);
    
    if (paste.length === 6) handleCodeLogin(paste);
    else inputRefs.current[Math.min(paste.length, 5)]?.focus();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mx-auto">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-semibold">
          {step === "email" ? "Sign in" : "Check your email"}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {step === "email" 
            ? "We'll send you a magic link" 
            : `Enter the code sent to ${userEmail}`}
        </p>
      </div>

      {/* Email Step */}
      {step === "email" && (
        <div className="space-y-3">
          <input
            type="email"
            placeholder="Enter your email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleMagicLinkLogin()}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            disabled={loading}
          />
          <button
            onClick={handleMagicLinkLogin}
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Magic Link"
            )}
          </button>
        </div>
      )}

      {/* Code Step */}
      {step === "code" && (
        <div className="space-y-4">
          <button
            onClick={() => {
              setStep("email");
              setOtp(["", "", "", "", "", ""]);
            }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Change email
          </button>

          <div className="flex gap-2" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading}
                className="w-full h-12 text-center text-xl font-semibold border-2 rounded-lg focus:border-green-500 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
              />
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying...
            </div>
          )}

          <button
            onClick={handleMagicLinkLogin}
            disabled={loading}
            className="w-full text-sm text-green-700 hover:text-green-600 disabled:opacity-50"
          >
            Resend code
          </button>
        </div>
      )}
    </div>
  );
}