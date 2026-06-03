// Fixed, app-wide animated gradient mesh. Three large blurred orbs drift on
// slow loops. Purely decorative — sits behind all content (z-index -1).
export default function MeshBackground() {
  return (
    <div className="mesh-bg" aria-hidden>
      <div className="mesh-orb mesh-orb-1" />
      <div className="mesh-orb mesh-orb-2" />
      <div className="mesh-orb mesh-orb-3" />
    </div>
  );
}
