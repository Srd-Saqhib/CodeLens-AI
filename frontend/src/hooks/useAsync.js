import { useEffect, useState } from "react";
// Runs an async function when deps change and tracks loading / error / data.
export function useAsync(fn, deps) {
  const [s, setS] = useState({ data: null, error: "", loading: true });
  useEffect(() => {
    let live = true;
    setS({ data: null, error: "", loading: true });
    fn().then((data) => live && setS({ data, error: "", loading: false }))
        .catch((e) => live && setS({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
  }, deps); // eslint-disable-line
  return s;
}
