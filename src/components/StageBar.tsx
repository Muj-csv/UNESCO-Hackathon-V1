import { useGameState } from '../state/GameContext';

/** The thin line at the top of every screen saying where the room is. */
export default function StageBar({ label, note }: { label: string; note?: string }) {
  const { session } = useGameState();
  return (
    <div className="stage-bar">
      <span className="eyebrow eyebrow-amber">{label}</span>
      <span className="eyebrow">{note ?? `Round ${session.roundNumber}`}</span>
    </div>
  );
}
