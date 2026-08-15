/* T5. Shown in place of the lobby when sessionStorage holds a round still in
   progress. Never restores silently — the previous group may have left the
   device to someone else. */

interface ResumePromptProps {
  onContinue: () => void;
  onStartFresh: () => void;
}

export default function ResumePrompt({ onContinue, onStartFresh }: ResumePromptProps) {
  return (
    <div className="shell">
      <div className="screen">
        <div className="card">
          <p className="eyebrow">Welcome back</p>
          <h2>You have a round in progress.</h2>
          <p className="muted">Continue where you left off?</p>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={onContinue}>
          Continue
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onStartFresh}>
          Start fresh
        </button>
      </div>
    </div>
  );
}
