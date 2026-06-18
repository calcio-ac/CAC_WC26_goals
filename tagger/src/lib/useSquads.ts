import { useEffect, useState } from "react";
import { Squad, SquadData } from "./types";

let cache: SquadData | null = null;

/** Loads the World Cup squad lists extracted from the official PDF. */
export function useSquads() {
  const [data, setData] = useState<SquadData | null>(cache);

  useEffect(() => {
    if (cache) return;
    fetch("/assets/squads.json")
      .then((r) => r.json())
      .then((d: SquadData) => {
        cache = d;
        setData(d);
      })
      .catch(() => setData({ tournament: "FIFA World Cup 2026", teams: [] }));
  }, []);

  const teams = data?.teams ?? [];
  const byCode = (code: string): Squad | undefined => teams.find((t) => t.code === code);

  return { teams, byCode, loaded: !!data };
}
