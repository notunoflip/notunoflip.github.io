import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

interface AuthProps {
  onLogin: (session: Session) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [userEmail, setUserEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);

  const captchaRef = useRef<HCaptcha>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (step === "code") inputRefs.current[0]?.focus();
  }, [step]);

  // -----------------------------------
  // Utilities
  // -----------------------------------
  const runCaptcha = async (): Promise<string | null> => {
    console.log("[Captcha] executing...");
    try {
      const token = await captchaRef.current?.execute();
      console.log("[Captcha] token received:", token);
      return token ?? null;
    } catch (err) {
      console.error("[Captcha] execution error:", err);
      return null;
    }
  };

  const resetCaptcha = () => {
    console.log("[Captcha] resetting");
    captchaRef.current?.resetCaptcha();
  };

  const generateGuestName = () => {
    const animals = [
      "tiger", "zebra", "panda", "koala", "otter",
      "eagle", "shark", "whale", "hippo", "lemur",
    ];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    const digits = Math.floor(1000 + Math.random() * 9000);
    return `${animal}${digits}`;
  };

  // -----------------------------------
  // Guest Login
  // -----------------------------------
  const handleGuestLogin = async () => {
    const token = await runCaptcha();
    if (!token) {
      toast.error("Captcha verification failed.");
      return;
    }

    console.log("[Guest Login] captchaToken:", token);
    setLoading(true);

    let guestName = "";
    let success = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      guestName = generateGuestName();

      const { error } = await supabase
        .from("players")
        .upsert(
          { id: "guest-" + crypto.randomUUID(), nickname: guestName, is_guest: true },
          { onConflict: "nickname" }
        )
        .select()
        .single();

      if (!error) {
        success = true;
        break;
      }
    }

    if (!success) {
      setLoading(false);
      resetCaptcha();
      toast.error("Could not create guest. Try again.");
      return;
    }

    const { data, error } = await supabase.auth.signInAnonymously({
      options: { captchaToken: token, data: { username: guestName, is_guest: true } },
    });

    setLoading(false);
    resetCaptcha();

    console.log("[Guest Login] Supabase response:", { data, error });

    if (error || !data?.session) {
      toast.error(error?.message ?? "Guest login failed.");
      return;
    }

    toast.success(`Logged in as ${guestName}`);
    onLogin(data.session);
  };

  // -----------------------------------
  // Magic Link Login
  // -----------------------------------
  const handleMagicLinkLogin = async () => {
    if (!userEmail) {
      toast.error("Please enter your email.");
      return;
    }

    const token = await runCaptcha();
    if (!token) {
      toast.error("Captcha verification failed.");
      return;
    }

    console.log("[Magic Link] captchaToken:", token);
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: userEmail,
      options: { captchaToken: token, emailRedirectTo: window.location.origin },
    });

    setLoading(false);
    resetCaptcha();

    console.log("[Magic Link] Supabase response:", { error });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Magic link sent to ${userEmail}`);
      setStep("code");
    }
  };

  // -----------------------------------
  // OTP Verify
  // -----------------------------------
  const handleCodeLogin = async (code: string) => {
    if (!userEmail || !code) {
      toast.error("Enter email and code.");
      return;
    }

    const token = await runCaptcha();
    if (!token) {
      toast.error("Captcha verification failed.");
      return;
    }

    console.log("[OTP Login] captchaToken:", token);
    setLoading(true);

    const { data, error } = await supabase.auth.verifyOtp({
      email: userEmail,
      token: code,
      type: "magiclink",
      options: { captchaToken: token },
    });

    setLoading(false);
    resetCaptcha();

    console.log("[OTP Login] Supabase response:", { data, error });

    if (error || !data?.session) {
      toast.error(error?.message ?? "Invalid code.");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      return;
    }

    toast.success(`Logged in as ${userEmail}`);
    onLogin(data.session);
  };

  // -----------------------------------
  // OTP Input Handling
  // -----------------------------------
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (newOtp.every(Boolean) && index === 5) handleCodeLogin(newOtp.join(""));
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
      <HCaptcha
        sitekey="d97cddc0-2708-4c8e-aebc-331a7f40b972"
        size="invisible"
        ref={captchaRef}
      />

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mx-auto">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-semibold">
          {step === "email" ? "Sign in" : "Check your email"}
        </h2>
      </div>

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
            className="w-full bg-green-600 text-white py-2 rounded-lg flex justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : "Send Magic Link"}
          </button>

          <div className="flex items-center gap-3 py-2">
            <div className="flex-grow border-t" />
            <span className="text-xs text-gray-400">OR</span>
            <div className="flex-grow border-t" />
          </div>

          <button
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full border py-2 rounded-lg"
          >
            Continue as Guest
          </button>
        </div>
      )}

      {step === "code" && (
        <div className="space-y-4">
          <button
            onClick={() => {
              setStep("email");
              setOtp(["", "", "", "", "", ""]);
            }}
            className="flex items-center gap-1 text-sm text-gray-500"
          >
            <ArrowLeft className="w-4 h-4" />
            Change email
          </button>

          <div className="flex gap-2" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {inputRefs.current[i] = el;}}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-full h-12 text-center text-xl border rounded-lg"
              />
            ))}
          </div>

          {loading && (
            <div className="flex justify-center">
              <Loader2 className="animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
