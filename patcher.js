const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('./db');

const ROOT = __dirname;

// Matches an absolute path into this project (server-side stack traces) or a
// same-origin URL served by this app (client-side error reports) inside a stack
// trace or error context, so we know which source file to hand to the model.
// Derived from the actual folder/port rather than hardcoded, so this still matches
// correctly if the app is ever renamed, moved, or run on a different port (e.g. the
// chat-app-dev sandbox copy on 3005).
const PROJECT_DIR_NAME = path.basename(ROOT);
const SERVER_PATH_RE = new RegExp(`/${PROJECT_DIR_NAME}/((?:server|db|patcher)\\.js|public/[\\w./-]+)`);
// Was hardcoded to `localhost:\d+` — real user traffic reaches this app through a reverse
// proxy/cloudflared tunnel (see the trust-proxy comment in server.js), so location.href (and
// therefore every client-side error report's stack/URL) from that traffic never contains
// "localhost", silently making self-healing a no-op for exactly the users it's meant to help.
// Matches any origin's path instead of a specific host: "://" + host(:port), then the path.
const CLIENT_URL_RE = /:\/\/[^/]+\/([\w./-]+\.js)/;

function resolveSourceFile(errorReport) {
  const stack = errorReport.stack || '';
  const context = errorReport.context || {};
  const haystack = `${stack}\n${context.url || ''}\n${context.filename || ''}`;

  const serverMatch = haystack.match(SERVER_PATH_RE);
  if (serverMatch) return serverMatch[1];

  const clientMatch = haystack.match(CLIENT_URL_RE);
  if (clientMatch) return `public/${clientMatch[1]}`;

  return null;
}

// The regexes above allow '.'/'/' in the matched path, which admits '../' sequences —
// context.url on an error report is attacker-controlled (POST /errors/report is public and
// unauthenticated), so without this check a crafted url like ".../public/../../.ssh/id_rsa"
// would resolve outside the project directory, letting generateProposal read arbitrary files
// off disk (and, if later approved, applyProposal write to them). Canonicalizes and requires
// the result to stay strictly inside ROOT regardless of what the regex above matched.
function resolveSafePath(targetFile) {
  const absPath = path.resolve(ROOT, targetFile);
  if (absPath !== ROOT && !absPath.startsWith(ROOT + path.sep)) {
    throw new Error(`Refusing to touch a path outside the project: ${targetFile}`);
  }
  return absPath;
}

const PATCH_SCHEMA = {
  type: 'object',
  properties: {
    explanation: { type: 'string', description: 'One or two sentences on the root cause and the fix' },
    oldString: { type: 'string', description: 'Exact, unique substring of the target file to replace' },
    newString: { type: 'string', description: 'The replacement text' },
  },
  required: ['explanation', 'oldString', 'newString'],
  additionalProperties: false,
};

async function generateProposal(errorReport) {
  const targetFile = resolveSourceFile(errorReport);
  if (!targetFile) {
    console.log(`[patcher] Could not identify a source file for error ${errorReport.id}, skipping`);
    return;
  }

  let absPath;
  try {
    absPath = resolveSafePath(targetFile);
  } catch (err) {
    console.log(`[patcher] ${err.message}`);
    return;
  }
  let fileContent;
  try {
    fileContent = fs.readFileSync(absPath, 'utf8');
  } catch {
    console.log(`[patcher] Target file ${targetFile} not readable, skipping`);
    return;
  }

  let client;
  try {
    client = new Anthropic();
  } catch {
    console.log('[patcher] No Anthropic API credentials configured, skipping patch generation');
    return;
  }

  const context = errorReport.context || {};
  const userPrompt = `An error occurred in this app. Propose a minimal fix.

Error message: ${errorReport.message}
Stack trace:
${errorReport.stack || '(none)'}
Context: ${JSON.stringify(context)}

Target file: ${targetFile}
--- File contents ---
${fileContent}
--- End file contents ---

Return a minimal fix as an exact string replacement: oldString must be an exact, unique substring of the file above, and newString is what it should become. Keep the change as small as possible — fix only the reported error, don't refactor unrelated code.`;

  let response;
  try {
    const stream = client.messages.stream({
      model: 'claude-opus-5',
      max_tokens: 16000,
      system: 'You are a careful software engineer fixing a specific bug in an existing codebase. Propose the smallest correct change that fixes the reported error.',
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { format: { type: 'json_schema', schema: PATCH_SCHEMA } },
    });
    response = await stream.finalMessage();
  } catch (err) {
    console.error('[patcher] Claude API call failed:', err.message);
    return;
  }

  if (response.stop_reason === 'refusal') {
    console.log(`[patcher] Model declined to propose a fix for error ${errorReport.id}`);
    return;
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) return;

  let patch;
  try {
    patch = JSON.parse(textBlock.text);
  } catch {
    console.error('[patcher] Could not parse model response as JSON');
    return;
  }

  const occurrences = fileContent.split(patch.oldString).length - 1;
  if (occurrences !== 1) {
    console.log(`[patcher] Proposed oldString for ${targetFile} is not unique (${occurrences} matches), discarding`);
    return;
  }

  db.insertPatchProposal({
    id: crypto.randomUUID(),
    errorReportId: errorReport.id,
    targetFile,
    oldString: patch.oldString,
    newString: patch.newString,
    explanation: patch.explanation,
  });
  console.log(`[patcher] Proposed a fix for error ${errorReport.id} in ${targetFile}`);
}

// Applies an approved proposal: backs up the current file, writes the patched
// content, and — for server-side files — restarts the systemd service so the
// change actually takes effect (server.js/db.js are only read at process start).
function applyProposal(id) {
  const proposal = db.getPatchProposal(id);
  if (!proposal || proposal.status !== 'pending') {
    throw new Error('Proposal not found or already decided');
  }

  const absPath = resolveSafePath(proposal.target_file);
  const fileContent = fs.readFileSync(absPath, 'utf8');
  const occurrences = fileContent.split(proposal.old_string).length - 1;
  if (occurrences !== 1) {
    db.setPatchProposalStatus(id, 'failed');
    throw new Error('oldString no longer matches the file exactly once — it may be stale');
  }

  const backupDir = path.join(ROOT, 'patch_backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `${proposal.target_file.replace(/\//g, '_')}.${Date.now()}.bak`);
  fs.writeFileSync(backupPath, fileContent);

  const patched = fileContent.replace(proposal.old_string, proposal.new_string);
  fs.writeFileSync(absPath, patched);
  db.setPatchProposalStatus(id, 'applied');

  const isServerFile = proposal.target_file === 'server.js' || proposal.target_file === 'db.js' || proposal.target_file === 'patcher.js';
  return { restarted: isServerFile, backupPath };
}

module.exports = { generateProposal, applyProposal, resolveSourceFile };
