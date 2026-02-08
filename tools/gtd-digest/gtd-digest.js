#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function printHelp() {
  const text = `gtd-digest

Usage:
  gtd-digest <path-to-Updates.md>
  gtd-digest --help

Description:
  Extracts Trello links and the Next checklist section from a GTD Updates.md file
  and prints a compact digest.
`;
  process.stdout.write(text);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return { help: true };
  }
  if (args.length !== 1) {
    return { error: "Expected exactly one file path." };
  }
  return { filePath: args[0] };
}

function extractTrelloLinks(text) {
  const regex = /https?:\/\/(?:www\.)?trello\.com\/[^\s)]+/g;
  const found = text.match(regex) || [];
  const seen = new Set();
  const uniq = [];
  for (const link of found) {
    if (!seen.has(link)) {
      seen.add(link);
      uniq.push(link);
    }
  }
  return uniq;
}

function getSectionLines(text, sectionName) {
  const lines = text.split(/\r?\n/);
  const normalizedTarget = sectionName.trim().toLowerCase();
  let inSection = false;
  const sectionLines = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#+)\s+(.+?)\s*$/);
    if (headingMatch) {
      const headingText = headingMatch[2].trim().toLowerCase();
      if (headingText === normalizedTarget) {
        inSection = true;
        continue;
      }
      if (inSection) {
        break;
      }
    }
    if (inSection) {
      sectionLines.push(line);
    }
  }

  return sectionLines;
}

function extractChecklist(lines) {
  const items = [];
  for (const line of lines) {
    const match = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)\s*$/);
    if (match) {
      const checked = match[1].toLowerCase() === "x";
      const text = match[2].trim();
      items.push({ checked, text, raw: line.trim() });
    }
  }
  return items;
}

function buildDigest({ filePath, trelloLinks, checklistItems }) {
  const relPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  const lines = [];
  lines.push("GTD Digest");
  lines.push(`File: ${relPath}`);
  lines.push("");

  lines.push(`Trello links (${trelloLinks.length})`);
  if (trelloLinks.length === 0) {
    lines.push("- none");
  } else {
    for (const link of trelloLinks) {
      lines.push(`- ${link}`);
    }
  }

  lines.push("");
  lines.push(`Next checklist (${checklistItems.length})`);
  if (checklistItems.length === 0) {
    lines.push("- none");
  } else {
    for (const item of checklistItems) {
      const box = item.checked ? "[x]" : "[ ]";
      lines.push(`- ${box} ${item.text}`);
    }
  }

  lines.push("");
  lines.push("Digest summary");
  lines.push(`- Trello links: ${trelloLinks.length}`);
  lines.push(`- Next checklist items: ${checklistItems.length}`);

  return lines.join("\n") + "\n";
}

function main() {
  const parsed = parseArgs(process.argv);
  if (parsed.help) {
    printHelp();
    return;
  }
  if (parsed.error) {
    process.stderr.write(`${parsed.error}\n`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  const filePath = parsed.filePath;
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    process.stderr.write(`Failed to read file: ${filePath}\n`);
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
    return;
  }

  const trelloLinks = extractTrelloLinks(text);
  const nextSectionLines = getSectionLines(text, "Next");
  const checklistItems = extractChecklist(nextSectionLines);

  const digest = buildDigest({
    filePath,
    trelloLinks,
    checklistItems,
  });

  process.stdout.write(digest);
}

main();
