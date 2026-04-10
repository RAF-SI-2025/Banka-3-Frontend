import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { beginTotpSetup, confirmTotpSetup } from "../services/AuthService";
import useFailedAttempts, { BLOCKED_MESSAGE } from "../utils/useFailedAttempts";
import Sidebar from "../components/Sidebar.jsx";
import "./TotpSetupPage.css";

export default function TotpSetupPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("init");
  const [qrUrl, setQrUrl] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { isBlocked, increment, reset } = useFailedAttempts("totp-setup");

  const userRole = sessionStorage.getItem("userRole");
  const returnPath = userRole === "client" ? "/dashboard" : "/employees";

  async function handleBeginSetup() {
    try {
      setLoading(true);
      setError("");
      const data = await beginTotpSetup();
      setQrUrl(data.qr_url || data.qrUrl || data.url || "");
      setPhase("qr");
    } catch (err) {
      setError(
          err.response?.data?.message ||
          err.response?.data?.error ||
          "Greška pri pokretanju TOTP podešavanja."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e) {
    e.preventDefault();
    if (code.length !== 6) return;
    if (isBlocked) {
      setError(BLOCKED_MESSAGE);
      return;
    }

    try {
      setLoading(true);
      setError("");
      await confirmTotpSetup(code);
      reset();
      setPhase("done");
    } catch (err) {
      increment();
      setError(
          err.response?.data?.message ||
          err.response?.data?.error ||
          "Neispravan kod. Pokušajte ponovo."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
      <div className="totp-setup-shell">
        <Sidebar />
        <div className="totp-setup-content">
          <div className="totp-setup-card">
            <div className="totp-setup-header">
              <button className="totp-setup-back" onClick={() => navigate(returnPath)}>
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <div>
                <p className="totp-setup-eyebrow">BEZBEDNOST</p>
                <h1 className="totp-setup-title">Dvostepena verifikacija</h1>
              </div>
            </div>

            {phase === "init" && (
                <div className="totp-setup-body">
                  <p className="totp-setup-desc">
                    Zaštitite svoj nalog aktiviranjem dvostepene verifikacije (TOTP).
                    Biće vam potrebna autentifikator aplikacija (Google Authenticator, Authy, ili slična).
                  </p>
                  {error && <p className="totp-setup-error">{error}</p>}
                  <button
                      className="totp-setup-btn-primary"
                      onClick={handleBeginSetup}
                      disabled={loading}
                  >
                    {loading ? "Učitavanje..." : "Započni podešavanje"}
                  </button>
                </div>
            )}

            {phase === "qr" && (
                <div className="totp-setup-body">
                  <p className="totp-setup-desc">
                    Skenirajte QR kod pomoću autentifikator aplikacije, zatim kliknite "Nastavi".
                  </p>
                  <div className="totp-setup-qr-wrapper">
                    {qrUrl ? (
                        <QRCodeSVG
                            value={qrUrl}
                            size={200}
                            bgColor="#ffffff"
                            fgColor="#000000"
                            className="totp-setup-qr"
                        />
                    ) : (
                        <p className="totp-setup-error">QR kod nije dostupan.</p>
                    )}
                  </div>
                  {error && <p className="totp-setup-error">{error}</p>}
                  <button className="totp-setup-btn-primary" onClick={() => setPhase("confirm")}>
                    Nastavi
                  </button>
                </div>
            )}

            {phase === "confirm" && (
                <div className="totp-setup-body">
                  <p className="totp-setup-desc">
                    Unesite 6-cifreni kod iz autentifikator aplikacije da potvrdite podešavanje.
                  </p>
                  <form onSubmit={handleConfirm}>
                    <input
                        className={`totp-setup-code-input ${error ? "totp-setup-code-input--error" : ""}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        autoComplete="one-time-code"
                        autoFocus
                    />
                    {(error || isBlocked) && (
                        <p className="totp-setup-error">{isBlocked ? BLOCKED_MESSAGE : error}</p>
                    )}
                    <div className="totp-setup-actions">
                      <button
                          type="button"
                          className="totp-setup-btn-secondary"
                          onClick={() => {
                            setPhase("qr");
                            setError("");
                          }}
                      >
                        Nazad
                      </button>
                      <button
                          type="submit"
                          className="totp-setup-btn-primary"
                          disabled={code.length < 6 || loading || isBlocked}
                      >
                        {loading ? "Provera..." : "Potvrdi"}
                      </button>
                    </div>
                  </form>
                </div>
            )}

            {phase === "done" && (
                <div className="totp-setup-body">
                  <div className="totp-setup-success">
                    Dvostepena verifikacija je uspešno aktivirana!
                  </div>
                  <button className="totp-setup-btn-primary" onClick={() => navigate(returnPath)}>
                    Nazad na početnu
                  </button>
                </div>
            )}
          </div>
        </div>
      </div>
  );
}