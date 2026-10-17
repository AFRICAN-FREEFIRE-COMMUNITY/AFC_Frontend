#!/usr/bin/env node
// VENDORED from ~/.claude/skills/versioning/scripts/release.mjs (rule R89), so the tag workflow can check a
// version tag without anything from the machine that pushed it. Change the original, then copy it here
// whole; the two differ only by these three lines.
// release.mjs - the version rule R89 as a tool: what the next version is, and whether a tag is right.
//
// The rule (full text: ~/.claude/OWNER-RULES.md R89). Versions are vMAJOR.MINOR.PATCH, three
// numbers, and the kind of a release is read from its CHANGELOG.md section headings:
//   ### Breaking                       -> major  (v7.4.2 -> v8.0.0)
//   ### Added   ### Changed            -> minor  (v7.4.2 -> v7.5.0)
//   ### Fixed   ### Security   ### Internal  -> patch (v7.4.2 -> v7.4.3)
// The highest heading in the section wins. A release is exactly one step after the highest version
// the product already has, in this repo OR in any repo named in release.json "shareVersionWith"
// (AFC: the website and the server carry one product number).
//
//   node release.mjs next [--repo DIR] [--kind patch|minor|major]   the next version and why
//   node release.mjs verify vX.Y.Z [--repo DIR]                     exit 1 with the reason if wrong
//        --published        the tag is already on the remote (CI on the tag's own run)
//        --shared-optional  a sibling repo that cannot be read (private, no token in CI) is skipped
//                           with a note instead of failing; the local push hook stays strict
//   node release.mjs --self-test                                    prove both ways in throwaway repos
//
// CALLED BY: scripts/hook.mjs (blocks a wrong tag push), the versioning skill's release steps, and a
// project's own CI when it vendors the verify step. Standard library only.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TAG_RE = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const KIND_OF = { breaking: 'major', added: 'minor', changed: 'minor', fixed: 'patch', security: 'patch', internal: 'patch' };
const RANK = { patch: 1, minor: 2, major: 3 };
const HEADINGS = 'Breaking, Added, Changed, Fixed, Security or Internal';

const parse = (tag) => {
  const m = TAG_RE.exec(tag);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const show = (v) => `v${v.join('.')}`;
export function bump(v, kind) {
  if (kind === 'major') return [v[0] + 1, 0, 0];
  if (kind === 'minor') return [v[0], v[1] + 1, 0];
  return [v[0], v[1], v[2] + 1];
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function tryGit(cwd, args) {
  try {
    return git(cwd, args);
  } catch {
    return null;
  }
}

/** release.json at the repo root, or the defaults (no shared repos, CHANGELOG.md). */
export function config(repo) {
  const file = path.join(repo, 'release.json');
  const base = { shareVersionWith: [], changelog: 'CHANGELOG.md' };
  if (!fs.existsSync(file)) return base;
  return { ...base, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
}

const tagsIn = (text) =>
  (text || '')
    .split('\n')
    .map((l) => l.trim().split(/\s+/).pop() || '')
    .map((ref) => ref.replace(/^refs\/tags\//, '').replace(/\^\{\}$/, ''))
    .filter((t) => TAG_RE.test(t));

/** Every vX.Y.Z the product has: local tags, origin's, and each repo it shares the number with.
 *  `except` is left out of the LOCAL list only (a tag just created here and not pushed yet). A repo
 *  that cannot be read is an error: guessing low would let a wrong number through. */
export function versions(repo, { except, published, sharedOptional, notes } = {}) {
  const found = new Set(tagsIn(git(repo, ['tag', '-l'])).filter((t) => t !== except));
  // --published (CI on the tag's own run): the tag is already on the remote; judge it as if it
  // were not there yet, against everything else.
  const keep = (t) => !(published && t === except);
  const remotes = [];
  if (tryGit(repo, ['remote', 'get-url', 'origin'])) remotes.push('origin');
  remotes.push(...config(repo).shareVersionWith);
  for (const r of remotes) {
    let out;
    try {
      out = git(repo, ['ls-remote', '--tags', r]);
    } catch (e) {
      const why = String(e.stderr || e.message).trim().split('\n')[0];
      // --shared-optional (CI of a repo whose sibling is private): count without it and say so. The
      // push hook on the owner's machine, which can read private repos, stays strict.
      if (sharedOptional && r !== 'origin') {
        notes?.push(`${r} could not be read (${why}); counted without its tags`);
        continue;
      }
      throw new Error(`cannot read the tags of ${r} (${why}); the next version cannot be known without them`);
    }
    for (const t of tagsIn(out)) {
      // One product number across repos: the SAME number already in a sibling repo is the same
      // release (the server tagged first, then the website), not a clash. It is left out of the
      // count so the bump is judged from the release before it. In this repo or its origin it is.
      if (r !== 'origin' && t === except) {
        notes?.push(`${t} is already on ${r}: the same release, tagged there first`);
        continue;
      }
      if (keep(t)) found.add(t);
    }
  }
  return [...found].map(parse).sort(cmp);
}

/** { title: { kind, headings[] } } for every "## " section of a changelog text. */
export function sections(text) {
  const out = {};
  let title = null;
  let heading = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2 && !line.startsWith('###')) {
      title = h2[1].trim().split(/\s+/)[0];
      if (/^unreleased$/i.test(title)) title = 'Unreleased';
      out[title] = { kind: null, headings: [], unknown: [] };
      heading = null;
      continue;
    }
    if (!title) continue;
    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3) {
      heading = h3[1].trim();
      if (!KIND_OF[heading.toLowerCase()]) out[title].unknown.push(heading);
      continue;
    }
    if (heading && /^\s*[-*]\s+\S/.test(line)) {
      const kind = KIND_OF[heading.toLowerCase()];
      if (!kind) continue;
      if (!out[title].headings.includes(heading)) out[title].headings.push(heading);
      if (!out[title].kind || RANK[kind] > RANK[out[title].kind]) out[title].kind = kind;
    }
  }
  return out;
}

function changelogAt(repo, ref, file) {
  if (ref) {
    const text = tryGit(repo, ['show', `${ref}:${file}`]);
    if (text === null) throw new Error(`no ${file} in the tagged commit (${ref})`);
    return text;
  }
  const p = path.join(repo, file);
  if (!fs.existsSync(p)) throw new Error(`no ${file} in ${repo}`);
  return fs.readFileSync(p, 'utf8');
}

/** null when `tag` is the right next release, else the reason, in plain words. */
export function verify(repo, tag, { published = false, sharedOptional = false, notes } = {}) {
  if (!TAG_RE.test(tag)) return `${tag} is not vMAJOR.MINOR.PATCH (three whole numbers, a lower-case v, no leading zeros)`;
  const v = parse(tag);
  let all;
  try {
    all = versions(repo, { except: tag, published, sharedOptional, notes });
  } catch (e) {
    return e.message;
  }
  if (all.some((x) => cmp(x, v) === 0)) return `${tag} already exists; a published tag is never moved or reused`;
  const { changelog } = config(repo);
  const ref = tryGit(repo, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`]) ? tag : null;
  let text;
  try {
    text = changelogAt(repo, ref, changelog);
  } catch (e) {
    return `${e.message}: every release has a section "## ${tag}" whose headings say what kind it is`;
  }
  const sec = sections(text)[tag];
  if (!sec) return `${changelog} has no "## ${tag}" section${ref ? ` in the tagged commit` : ''}: write what the release does under ${HEADINGS}`;
  if (sec.unknown.length) return `${changelog} "## ${tag}" uses ${sec.unknown.join(', ')}; the headings are ${HEADINGS}`;
  if (!sec.kind) return `${changelog} "## ${tag}" lists nothing under ${HEADINGS}`;
  const prev = all.length ? all[all.length - 1] : null;
  if (!prev) return null; // the product's first version: any well-formed number may start the line
  const want = bump(prev, sec.kind);
  if (cmp(want, v) !== 0) {
    return `after ${show(prev)}, a ${sec.kind} release (its section has ${sec.headings.join(', ')}) is ${show(want)}, not ${tag}`;
  }
  return null;
}

/** { version, kind, why } for the Unreleased section (or a forced kind). */
export function next(repo, forced) {
  const all = versions(repo);
  const prev = all.length ? all[all.length - 1] : [0, 0, 0];
  let kind = forced;
  let why = forced ? `--kind ${forced}` : '';
  if (!kind) {
    const { changelog } = config(repo);
    const sec = sections(changelogAt(repo, null, changelog)).Unreleased;
    if (!sec || !sec.kind) throw new Error(`${changelog} has no "## Unreleased" entries under ${HEADINGS}; write them first, or pass --kind`);
    if (sec.unknown.length) throw new Error(`"## Unreleased" uses ${sec.unknown.join(', ')}; the headings are ${HEADINGS}`);
    kind = sec.kind;
    why = `Unreleased has ${sec.headings.join(', ')}`;
  }
  return { version: show(bump(prev, kind)), previous: all.length ? show(prev) : null, kind, why };
}

// ── self-test: throwaway repos, every refusal must fire and every right tag must pass ───────────
function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-selftest-'));
  const g = (cwd, ...a) => git(cwd, a);
  const mk = (name) => {
    const d = path.join(root, name);
    fs.mkdirSync(d);
    g(d, 'init', '-q');
    g(d, 'config', 'user.email', 'selftest@example.test');
    g(d, 'config', 'user.name', 'selftest');
    g(d, 'config', 'commit.gpgsign', 'false');
    g(d, 'config', 'tag.gpgsign', 'false');
    return d;
  };
  const commit = (d, files) => {
    for (const [f, t] of Object.entries(files)) fs.writeFileSync(path.join(d, f), t);
    g(d, 'add', '-A');
    g(d, 'commit', '-q', '-m', 'step');
  };
  const site = mk('site');
  const server = mk('server');
  commit(server, { 'a.txt': '1' });
  g(server, 'tag', 'v1.1.0');
  commit(site, { 'release.json': JSON.stringify({ shareVersionWith: [server] }), 'CHANGELOG.md': '# Changelog\n' });
  g(site, 'tag', 'v1.0.0');

  const results = [];
  const expect = (label, got, ok) => results.push([label, ok(got), got]);
  const log = (body) => commit(site, { 'CHANGELOG.md': `# Changelog\n\n${body}\n` });

  log('## v1.1.1\n### Fixed\n- a fix');
  expect('patch after the SHARED highest (v1.1.0 on the server) passes', verify(site, 'v1.1.1'), (r) => r === null);
  log('## v1.0.1\n### Fixed\n- a fix');
  expect('patch counted from this repo only is refused', verify(site, 'v1.0.1'), (r) => /is v1\.1\.1, not v1\.0\.1/.test(r || ''));
  log('## v1.1.1\n### Added\n- a page\n### Fixed\n- a fix');
  expect('a patch number on a section with Added is refused', verify(site, 'v1.1.1'), (r) => /minor release .* is v1\.2\.0, not v1\.1\.1/.test(r || ''));
  log('## v1.2.0\n### Added\n- a page');
  expect('minor after v1.1.0 passes', verify(site, 'v1.2.0'), (r) => r === null);
  log('## v2.0.0\n### Breaking\n- partner API field removed\n### Fixed\n- x');
  expect('major passes', verify(site, 'v2.0.0'), (r) => r === null);
  expect('a release with no section of its own is refused', verify(site, 'v1.2.0'), (r) => /no "## v1\.2\.0" section/.test(r || ''));
  log('## v1.2.0\n### Breaking\n- x');
  expect('a minor number on a Breaking section is refused', verify(site, 'v1.2.0'), (r) => /major release .* is v2\.0\.0, not v1\.2\.0/.test(r || ''));
  expect('two numbers refused', verify(site, 'v1.2'), (r) => /not vMAJOR\.MINOR\.PATCH/.test(r || ''));
  expect('four numbers refused', verify(site, 'v1.2.0.1'), (r) => /not vMAJOR\.MINOR\.PATCH/.test(r || ''));
  expect('leading zero refused', verify(site, 'v1.02.0'), (r) => /not vMAJOR\.MINOR\.PATCH/.test(r || ''));
  // One product number: the server already has v1.1.0; the website tagging the SAME release passes,
  // judged from the release before it (v1.0.0), and says so.
  const sibNotes = [];
  log('## v1.1.0\n### Added\n- a page');
  expect('the same number already on a sibling repo is the same release and passes', verify(site, 'v1.1.0', { notes: sibNotes }), (r) => r === null);
  expect('and it says the sibling tagged it first', sibNotes.join(' '), (n) => /already on .*same release/.test(n));
  log('## v1.1.1\n### Tweaked\n- x');
  expect('an unknown heading is refused', verify(site, 'v1.1.1'), (r) => /uses Tweaked/.test(r || ''));
  log('## v1.1.1\n### Fixed\n');
  expect('an empty section is refused', verify(site, 'v1.1.1'), (r) => /lists nothing/.test(r || ''));
  log('## v1.1.1\n### Fixed\n- x');
  g(site, 'tag', 'v1.1.1');
  expect('a tag created here but not pushed is judged on its own commit', verify(site, 'v1.1.1'), (r) => r === null);
  // CI runs on the tag after it was pushed: refused as "already exists" plainly, judged with --published.
  const origin = `${root}-origin.git`;
  execFileSync('git', ['init', '-q', '--bare', origin], { stdio: 'ignore' });
  g(site, 'remote', 'add', 'origin', origin);
  g(site, 'push', '-q', 'origin', 'v1.0.0', 'v1.1.1');
  expect('a pushed tag is "already exists" when judged before a push', verify(site, 'v1.1.1'), (r) => /already exists/.test(r || ''));
  expect('an older tag of this repo (on its origin) is refused as existing', verify(site, 'v1.0.0'), (r) => /already exists/.test(r || ''));
  expect('the same pushed tag passes with --published (CI on its own run)', verify(site, 'v1.1.1', { published: true }), (r) => r === null);
  g(site, 'tag', '-d', 'v1.1.1');
  g(site, 'push', '-q', 'origin', ':refs/tags/v1.1.1');
  log('## Unreleased\n### Fixed\n- x');
  expect('next: Unreleased with Fixed is the patch after the shared highest', next(site).version, (v) => v === 'v1.1.1');
  log('## Unreleased\n### Changed\n- x\n### Fixed\n- y');
  expect('next: Changed makes it a minor', next(site).version, (v) => v === 'v1.2.0');
  expect('next: --kind major', next(site, 'major').version, (v) => v === 'v2.0.0');
  fs.writeFileSync(path.join(site, 'release.json'), JSON.stringify({ shareVersionWith: [path.join(root, 'missing')] }));
  expect('a shared repo that cannot be read refuses rather than guess', verify(site, 'v1.1.1'), (r) => /cannot read the tags/.test(r || ''));
  log('## v1.0.1\n### Fixed\n- x');
  const notes = [];
  expect('--shared-optional counts without an unreadable sibling and passes', verify(site, 'v1.0.1', { sharedOptional: true, notes }), (r) => r === null);
  expect('--shared-optional says which repo it could not read', notes.join(' '), (n) => /could not be read/.test(n));

  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(origin, { recursive: true, force: true });
  let failed = 0;
  for (const [label, ok, got] of results) {
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  (got: ${JSON.stringify(got)})`}`);
  }
  console.log(failed ? `self-test: ${failed} of ${results.length} FAILED` : `self-test: all passed (${results.length})`);
  return failed ? 1 : 0;
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest();
  const opt = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const repo = path.resolve(opt('--repo') || process.cwd());
  const top = tryGit(repo, ['rev-parse', '--show-toplevel']);
  if (!top) {
    console.error(`not a git repository: ${repo}`);
    return 2;
  }
  const dir = top.trim();
  const [cmd, arg] = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
  if (cmd === 'next') {
    const kind = opt('--kind');
    if (kind && !RANK[kind]) {
      console.error('--kind is patch, minor or major');
      return 2;
    }
    try {
      const n = next(dir, kind);
      console.log(`${n.version}  (${n.kind}; ${n.why}; after ${n.previous ?? 'nothing yet'})`);
      return 0;
    } catch (e) {
      console.error(e.message);
      return 1;
    }
  }
  if (cmd === 'verify' && arg) {
    const notes = [];
    const why = verify(dir, arg, { published: argv.includes('--published'), sharedOptional: argv.includes('--shared-optional'), notes });
    for (const n of notes) console.log(`note: ${n}`);
    if (why) {
      console.error(`version rule R89: ${why}`);
      return 1;
    }
    console.log(`${arg}: right (version rule R89)`);
    return 0;
  }
  console.error('usage: release.mjs next [--repo DIR] [--kind patch|minor|major] | verify vX.Y.Z [--repo DIR] | --self-test');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
