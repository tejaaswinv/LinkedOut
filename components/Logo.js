export default function Logo({ compact = false }) {
  return (
    <div className={`logo ${compact ? 'compact' : ''}`} aria-label="LinkedOut">
      <span>Linked</span><span className="outmark">out<span className="door">↗</span></span>
    </div>
  );
}
