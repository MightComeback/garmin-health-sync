const https = require('https');

const commitUrl = process.argv[2];
const summary = process.argv[3];

if (!commitUrl || !summary) {
  console.error("Usage: node post_comment.js <url> <summary>");
  process.exit(1);
}

const body = `${summary}\n\n${commitUrl}`;

// We need the issue ID. The instruction said "MIG-15".
// However, the mutation usually requires a UUID (issueId).
// But the script I saw used "MIG-15" as issueId?
// Wait, `commentCreate` input `issueId` usually expects the UUID, not the key (MIG-15).
// BUT, sometimes the API accepts keys in some contexts or maybe the script I saw was simplified/wrong or relying on a specific Linear behavior?
// Let's check `issue_id.json` in the file list earlier?
// "issue_id.json" exists. Let's read it to be safe.
// Also `linear_status_mig15.json` might have the ID.

const query = `mutation CommentCreate($issueId: String!, $body: String!) {
  commentCreate(input: {
    issueId: $issueId,
    body: $body
  }) {
    success
    comment {
      id
      url
    }
  }
}`;

// I will try to read the ID first. If not found, fail?
// Let's rely on the user environment.
