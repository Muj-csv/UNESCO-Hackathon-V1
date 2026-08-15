/* ============================================================================
   The thin line at the top of a screen naming what this beat is.

   PHASE 2 CHANGE: this used to end with "Round N". The shell's status bar now
   states the mode and round continuously, and the top bar carries the stage,
   so printing the round here as well put the same number on screen twice.

   The label survives because it is FINER than the stage: the rail says
   "What happened", this says whether you are looking at the reveal, the black
   box, or the machine. `note` survives because some screens put something
   genuinely local there — Round.tsx names whose turn it is.
   ========================================================================== */

export default function StageBar({ label, note }: { label: string; note?: string }) {
  return (
    <div className="stage-bar">
      <span className="eyebrow eyebrow-amber">{label}</span>
      {note ? <span className="eyebrow">{note}</span> : null}
    </div>
  );
}
