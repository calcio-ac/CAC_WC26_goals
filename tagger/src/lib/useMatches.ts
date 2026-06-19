import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export interface ScheduledMatch {
  id: string;
  match_date: string | null;
  home_code: string;
  home_team: string;
  away_code: string;
  away_team: string;
  video_url: string | null;
  video_id: string | null;
  tagger: string | null;
}

/** Hard-coded group stage schedule as a fallback when Supabase is not connected. */
const FALLBACK: ScheduledMatch[] = [
  // ── Matchday 1 ─────────────────────────────────────────────────────────────
  { id: "1",  match_date: "2026-06-11", home_code: "MEX", home_team: "Mexico",               away_code: "RSA", away_team: "South Africa",          video_url: null, video_id: null, tagger: null },
  { id: "2",  match_date: "2026-06-12", home_code: "KOR", home_team: "Korea Republic",       away_code: "CZE", away_team: "Czechia",                video_url: null, video_id: null, tagger: null },
  { id: "3",  match_date: "2026-06-12", home_code: "CAN", home_team: "Canada",               away_code: "BIH", away_team: "Bosnia And Herzegovina",  video_url: null, video_id: null, tagger: null },
  { id: "4",  match_date: "2026-06-13", home_code: "USA", home_team: "USA",                  away_code: "PAR", away_team: "Paraguay",                video_url: null, video_id: null, tagger: null },
  { id: "5",  match_date: "2026-06-13", home_code: "QAT", home_team: "Qatar",                away_code: "SUI", away_team: "Switzerland",             video_url: null, video_id: null, tagger: null },
  { id: "6",  match_date: "2026-06-13", home_code: "BRA", home_team: "Brazil",               away_code: "MAR", away_team: "Morocco",                 video_url: null, video_id: null, tagger: null },
  { id: "7",  match_date: "2026-06-14", home_code: "HAI", home_team: "Haiti",                away_code: "SCO", away_team: "Scotland",                video_url: null, video_id: null, tagger: null },
  { id: "8",  match_date: "2026-06-14", home_code: "AUS", home_team: "Australia",            away_code: "TUR", away_team: "Türkiye",                 video_url: null, video_id: null, tagger: null },
  { id: "9",  match_date: "2026-06-14", home_code: "GER", home_team: "Germany",              away_code: "CUW", away_team: "Curaçao",                 video_url: null, video_id: null, tagger: null },
  { id: "10", match_date: "2026-06-14", home_code: "NED", home_team: "Netherlands",          away_code: "JPN", away_team: "Japan",                   video_url: null, video_id: null, tagger: null },
  { id: "11", match_date: "2026-06-14", home_code: "CIV", home_team: "Côte D'Ivoire",        away_code: "ECU", away_team: "Ecuador",                 video_url: null, video_id: null, tagger: null },
  { id: "12", match_date: "2026-06-15", home_code: "SWE", home_team: "Sweden",               away_code: "TUN", away_team: "Tunisia",                 video_url: null, video_id: null, tagger: null },
  { id: "13", match_date: "2026-06-15", home_code: "ESP", home_team: "Spain",                away_code: "CPV", away_team: "Cabo Verde",              video_url: null, video_id: null, tagger: null },
  { id: "14", match_date: "2026-06-15", home_code: "BEL", home_team: "Belgium",              away_code: "EGY", away_team: "Egypt",                   video_url: null, video_id: null, tagger: null },
  { id: "15", match_date: "2026-06-15", home_code: "KSA", home_team: "Saudi Arabia",         away_code: "URU", away_team: "Uruguay",                 video_url: null, video_id: null, tagger: null },
  { id: "16", match_date: "2026-06-16", home_code: "IRN", home_team: "IR Iran",              away_code: "NZL", away_team: "New Zealand",             video_url: null, video_id: null, tagger: null },
  { id: "17", match_date: "2026-06-16", home_code: "FRA", home_team: "France",               away_code: "SEN", away_team: "Senegal",                 video_url: null, video_id: null, tagger: null },
  { id: "18", match_date: "2026-06-16", home_code: "IRQ", home_team: "Iraq",                 away_code: "NOR", away_team: "Norway",                  video_url: null, video_id: null, tagger: null },
  { id: "19", match_date: "2026-06-17", home_code: "ARG", home_team: "Argentina",            away_code: "ALG", away_team: "Algeria",                 video_url: null, video_id: null, tagger: null },
  { id: "20", match_date: "2026-06-17", home_code: "AUT", home_team: "Austria",              away_code: "JOR", away_team: "Jordan",                  video_url: null, video_id: null, tagger: null },
  { id: "21", match_date: "2026-06-17", home_code: "POR", home_team: "Portugal",             away_code: "COD", away_team: "Congo DR",                video_url: null, video_id: null, tagger: null },
  { id: "22", match_date: "2026-06-17", home_code: "ENG", home_team: "England",              away_code: "CRO", away_team: "Croatia",                 video_url: null, video_id: null, tagger: null },
  { id: "23", match_date: "2026-06-17", home_code: "GHA", home_team: "Ghana",                away_code: "PAN", away_team: "Panama",                  video_url: null, video_id: null, tagger: null },
  // ── Matchday 2 ─────────────────────────────────────────────────────────────
  { id: "24", match_date: "2026-06-18", home_code: "UZB", home_team: "Uzbekistan",           away_code: "COL", away_team: "Colombia",                video_url: null, video_id: null, tagger: null },
  { id: "25", match_date: "2026-06-18", home_code: "CZE", home_team: "Czechia",              away_code: "RSA", away_team: "South Africa",            video_url: null, video_id: null, tagger: null },
  { id: "26", match_date: "2026-06-18", home_code: "SUI", home_team: "Switzerland",          away_code: "BIH", away_team: "Bosnia And Herzegovina",  video_url: null, video_id: null, tagger: null },
  { id: "27", match_date: "2026-06-18", home_code: "CAN", home_team: "Canada",               away_code: "QAT", away_team: "Qatar",                   video_url: null, video_id: null, tagger: null },
  { id: "28", match_date: "2026-06-19", home_code: "MEX", home_team: "Mexico",               away_code: "KOR", away_team: "Korea Republic",          video_url: null, video_id: null, tagger: null },
  { id: "29", match_date: "2026-06-19", home_code: "USA", home_team: "USA",                  away_code: "AUS", away_team: "Australia",               video_url: null, video_id: null, tagger: null },
  { id: "30", match_date: "2026-06-19", home_code: "SCO", home_team: "Scotland",             away_code: "MAR", away_team: "Morocco",                 video_url: null, video_id: null, tagger: null },
  { id: "31", match_date: "2026-06-20", home_code: "BRA", home_team: "Brazil",               away_code: "HAI", away_team: "Haiti",                   video_url: null, video_id: null, tagger: null },
  { id: "32", match_date: "2026-06-20", home_code: "TUR", home_team: "Türkiye",              away_code: "PAR", away_team: "Paraguay",                video_url: null, video_id: null, tagger: null },
  { id: "33", match_date: "2026-06-20", home_code: "NED", home_team: "Netherlands",          away_code: "SWE", away_team: "Sweden",                  video_url: null, video_id: null, tagger: null },
  { id: "34", match_date: "2026-06-20", home_code: "GER", home_team: "Germany",              away_code: "CIV", away_team: "Côte D'Ivoire",            video_url: null, video_id: null, tagger: null },
  { id: "35", match_date: "2026-06-21", home_code: "ECU", home_team: "Ecuador",              away_code: "CUW", away_team: "Curaçao",                 video_url: null, video_id: null, tagger: null },
  { id: "36", match_date: "2026-06-21", home_code: "TUN", home_team: "Tunisia",              away_code: "JPN", away_team: "Japan",                   video_url: null, video_id: null, tagger: null },
  { id: "37", match_date: "2026-06-21", home_code: "ESP", home_team: "Spain",                away_code: "KSA", away_team: "Saudi Arabia",            video_url: null, video_id: null, tagger: null },
  { id: "38", match_date: "2026-06-21", home_code: "BEL", home_team: "Belgium",              away_code: "IRN", away_team: "IR Iran",                 video_url: null, video_id: null, tagger: null },
  { id: "39", match_date: "2026-06-21", home_code: "URU", home_team: "Uruguay",              away_code: "CPV", away_team: "Cabo Verde",              video_url: null, video_id: null, tagger: null },
  { id: "40", match_date: "2026-06-22", home_code: "NOR", home_team: "Norway",               away_code: "SEN", away_team: "Senegal",                 video_url: null, video_id: null, tagger: null },
  { id: "41", match_date: "2026-06-22", home_code: "FRA", home_team: "France",               away_code: "IRQ", away_team: "Iraq",                    video_url: null, video_id: null, tagger: null },
  { id: "42", match_date: "2026-06-22", home_code: "ARG", home_team: "Argentina",            away_code: "AUT", away_team: "Austria",                 video_url: null, video_id: null, tagger: null },
  { id: "43", match_date: "2026-06-22", home_code: "JOR", home_team: "Jordan",               away_code: "ALG", away_team: "Algeria",                 video_url: null, video_id: null, tagger: null },
  { id: "44", match_date: "2026-06-23", home_code: "ENG", home_team: "England",              away_code: "GHA", away_team: "Ghana",                   video_url: null, video_id: null, tagger: null },
  { id: "45", match_date: "2026-06-23", home_code: "PAN", home_team: "Panama",               away_code: "CRO", away_team: "Croatia",                 video_url: null, video_id: null, tagger: null },
  { id: "46", match_date: "2026-06-23", home_code: "POR", home_team: "Portugal",             away_code: "UZB", away_team: "Uzbekistan",              video_url: null, video_id: null, tagger: null },
  { id: "47", match_date: "2026-06-23", home_code: "COL", home_team: "Colombia",             away_code: "COD", away_team: "Congo DR",                video_url: null, video_id: null, tagger: null },
  // ── Matchday 3 ─────────────────────────────────────────────────────────────
  { id: "48", match_date: "2026-06-24", home_code: "SCO", home_team: "Scotland",             away_code: "BRA", away_team: "Brazil",                  video_url: null, video_id: null, tagger: null },
  { id: "49", match_date: "2026-06-24", home_code: "MAR", home_team: "Morocco",              away_code: "HAI", away_team: "Haiti",                   video_url: null, video_id: null, tagger: null },
  { id: "50", match_date: "2026-06-24", home_code: "SUI", home_team: "Switzerland",          away_code: "CAN", away_team: "Canada",                  video_url: null, video_id: null, tagger: null },
  { id: "51", match_date: "2026-06-24", home_code: "BIH", home_team: "Bosnia And Herzegovina", away_code: "QAT", away_team: "Qatar",                video_url: null, video_id: null, tagger: null },
  { id: "52", match_date: "2026-06-24", home_code: "CZE", home_team: "Czechia",              away_code: "MEX", away_team: "Mexico",                  video_url: null, video_id: null, tagger: null },
  { id: "53", match_date: "2026-06-24", home_code: "RSA", home_team: "South Africa",         away_code: "KOR", away_team: "Korea Republic",          video_url: null, video_id: null, tagger: null },
  { id: "54", match_date: "2026-06-25", home_code: "CUW", home_team: "Curaçao",              away_code: "CIV", away_team: "Côte D'Ivoire",            video_url: null, video_id: null, tagger: null },
  { id: "55", match_date: "2026-06-25", home_code: "ECU", home_team: "Ecuador",              away_code: "GER", away_team: "Germany",                 video_url: null, video_id: null, tagger: null },
  { id: "56", match_date: "2026-06-25", home_code: "JPN", home_team: "Japan",                away_code: "SWE", away_team: "Sweden",                  video_url: null, video_id: null, tagger: null },
  { id: "57", match_date: "2026-06-25", home_code: "TUN", home_team: "Tunisia",              away_code: "NED", away_team: "Netherlands",             video_url: null, video_id: null, tagger: null },
  { id: "58", match_date: "2026-06-25", home_code: "TUR", home_team: "Türkiye",              away_code: "USA", away_team: "USA",                     video_url: null, video_id: null, tagger: null },
  { id: "59", match_date: "2026-06-25", home_code: "PAR", home_team: "Paraguay",             away_code: "AUS", away_team: "Australia",               video_url: null, video_id: null, tagger: null },
  { id: "60", match_date: "2026-06-26", home_code: "NOR", home_team: "Norway",               away_code: "FRA", away_team: "France",                  video_url: null, video_id: null, tagger: null },
  { id: "61", match_date: "2026-06-26", home_code: "SEN", home_team: "Senegal",              away_code: "IRQ", away_team: "Iraq",                    video_url: null, video_id: null, tagger: null },
  { id: "62", match_date: "2026-06-26", home_code: "CPV", home_team: "Cabo Verde",           away_code: "KSA", away_team: "Saudi Arabia",            video_url: null, video_id: null, tagger: null },
  { id: "63", match_date: "2026-06-26", home_code: "URU", home_team: "Uruguay",              away_code: "ESP", away_team: "Spain",                   video_url: null, video_id: null, tagger: null },
  { id: "64", match_date: "2026-06-26", home_code: "NZL", home_team: "New Zealand",          away_code: "BEL", away_team: "Belgium",                 video_url: null, video_id: null, tagger: null },
  { id: "65", match_date: "2026-06-26", home_code: "EGY", home_team: "Egypt",                away_code: "IRN", away_team: "IR Iran",                 video_url: null, video_id: null, tagger: null },
  { id: "66", match_date: "2026-06-27", home_code: "CRO", home_team: "Croatia",              away_code: "GHA", away_team: "Ghana",                   video_url: null, video_id: null, tagger: null },
  { id: "67", match_date: "2026-06-27", home_code: "PAN", home_team: "Panama",               away_code: "ENG", away_team: "England",                 video_url: null, video_id: null, tagger: null },
  { id: "68", match_date: "2026-06-27", home_code: "COL", home_team: "Colombia",             away_code: "POR", away_team: "Portugal",                video_url: null, video_id: null, tagger: null },
  { id: "69", match_date: "2026-06-27", home_code: "COD", home_team: "Congo DR",             away_code: "UZB", away_team: "Uzbekistan",              video_url: null, video_id: null, tagger: null },
  { id: "70", match_date: "2026-06-27", home_code: "ALG", home_team: "Algeria",              away_code: "AUT", away_team: "Austria",                 video_url: null, video_id: null, tagger: null },
  { id: "71", match_date: "2026-06-27", home_code: "JOR", home_team: "Jordan",               away_code: "ARG", away_team: "Argentina",               video_url: null, video_id: null, tagger: null },
];


let cachedMatches: ScheduledMatch[] | null = null;

/**
 * Loads the list of group-stage matches.
 * If Supabase is configured, fetches from the DB (only rows with no video_id yet,
 * i.e. not yet tagged — but still shows all of them for selection).
 * Falls back to the hardcoded schedule when offline or not configured.
 */
export function useMatches() {
  const [matches, setMatches] = useState<ScheduledMatch[]>(cachedMatches ?? []);
  const [loading, setLoading] = useState(!cachedMatches);

  useEffect(() => {
    if (cachedMatches) return;
    if (!supabase) {
      cachedMatches = FALLBACK;
      setMatches(FALLBACK);
      setLoading(false);
      return;
    }
    supabase
      .from("matches")
      .select("id, match_date, home_code, home_team, away_code, away_team, video_url, video_id, tagger")
      .order("match_date", { ascending: true })
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          cachedMatches = FALLBACK;
          setMatches(FALLBACK);
        } else {
          cachedMatches = data as ScheduledMatch[];
          setMatches(cachedMatches);
        }
        setLoading(false);
      });
  }, []);

  return { matches, loading };
}
