/**
 * AuthShell — the sign-in / first-run screen shell, mirroring the NOD STUDIO
 * admin login: a void-black brand column (wordmark, headline, principles)
 * beside a raised form card. Static presentation only; the form lives in
 * `children` and keeps its own submit logic.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="auth-screen">
      <aside className="auth-brand">
        <div className="auth-wordmark">
          <span className="brand-mark" style={{ width: 26, height: 26 }} />
          <span className="nd-wordmark">
            NOD<em>Control Center</em>
          </span>
        </div>
        <div>
          <h1>The control plane of the house.</h1>
          <p>
            Processes, logs, traces and secrets — one quiet console for the
            services that run NOD Makeup, built on a void-black plane.
          </p>
          <div className="auth-principle">
            <div>
              <span>Control</span>
              <p>Start, stop and tune every service without a terminal.</p>
            </div>
            <div>
              <span>Trace</span>
              <p>Follow log lines and request spans back to the error.</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="auth-form">{children}</div>
    </section>
  );
}