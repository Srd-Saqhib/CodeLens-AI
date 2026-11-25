export default function Status({ s }) {
  if (s.loading) return <div className="skel" />;
  if (s.error) return <p className="err">{s.error}</p>;
  return null;
}
