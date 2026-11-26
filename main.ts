// Dusk Rescue — Kestrel Valley: the entrypoint hands the game in to make.fun.
//
// What it does, in order: read where to write (MAKEFUN_OUTPUT_DIR outside the grader,
// /output inside it), copy the playable game and the screenshots the maker took of it,
// then write dossier.json with the vendored make.fun library, which is the summary the
// judge reads. Nothing here is computed or fetched: the same repository always hands in
// the same bytes, so the grader's two runs agree.
//
// Run it from the repository root:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// and serve the game locally with `node serve.ts` (http://localhost:8080).
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps, as the kit's reference/gate.json states them: the text cap
// shapes the dossier's bytes, and the rest refuse an entry the scorer would refuse —
// more than 4 screenshots, one over 256 KiB, more than 993 files or 48 MiB under game/,
// a game/ path over 1000 bytes. game/ shares /output's 1000-entry cap with the rest.
const DOSSIER_OPTIONS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  cpSync(join(REPO_ROOT, 'game'), join(OUTPUT_DIR, 'game'), { recursive: true });
  const shotsInRepo = join(REPO_ROOT, 'screenshots');
  const shotsOut = join(OUTPUT_DIR, 'screenshots');
  mkdirSync(shotsOut, { recursive: true });
  if (existsSync(shotsInRepo)) cpSync(shotsInRepo, shotsOut, { recursive: true });
  const dossier = buildDossier(OUTPUT_DIR, DOSSIER_OPTIONS);
  writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossier);
}

handIn();
