/* Phase 1 scaffold check.
   Phase 5 replaces this with the screen registry that reads `screen` from
   context. Until then this renders enough of the design system to confirm the
   fonts, the palette, and the two surfaces (dark chrome / light paper). */

export default function App() {
  return (
    <div className="shell">
      <div className="screen">
        <div>
          <p className="eyebrow eyebrow-amber">Scaffold check · phase 1</p>
          <h1>TruthChain</h1>
          <p className="lede">
            A media and information literacy game about how true information
            quietly stops being true.
          </p>
        </div>

        <div className="card">
          <p className="eyebrow">Dark chrome — the game speaking</p>
          <div className="wire">
            <span className="wire-node is-done" />
            <span className="wire-link is-done" />
            <span className="wire-node is-done" />
            <span className="wire-link is-broken" />
            <span className="wire-node is-spark" />
            <span className="wire-link" />
            <span className="wire-node is-ai" />
            <span className="wire-link" />
            <span className="wire-node is-current" />
          </div>
          <p className="muted">
            Wire and spark. The node that sparks is where an atom stopped being
            true.
          </p>
        </div>

        <div className="paper paper-original">
          <p className="eyebrow">Light paper — the claim itself</p>
          <p className="paper-text">
            A preliminary study of 240 students at one campus found that later
            class start times were associated with a 12% rise in attendance.
          </p>
        </div>

        <div className="row">
          <span className="atom-chip is-alive">SOURCE</span>
          <span className="atom-chip is-alive">NUMBER</span>
          <span className="atom-chip is-lost">HEDGE</span>
          <span className="atom-chip is-lost">SCOPE</span>
          <span className="atom-chip">CAUSE</span>
        </div>

        <div className="constraint">
          <span className="constraint-name">90 characters</span>
          <span className="constraint-note">
            Fit it in a message. Nobody is told what to leave out.
          </span>
        </div>

        <div className="row">
          <button className="btn btn-primary">Primary</button>
          <button className="btn">Default</button>
          <button className="btn btn-ghost">Ghost</button>
          <span className="ai-tag">AI participant</span>
        </div>
      </div>
    </div>
  );
}
