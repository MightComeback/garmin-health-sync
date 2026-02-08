const https = require('https');

const commitUrl = "https://github.com/MightComeback/fathom-extract/commit/8dee2ad63ea43cb79e9c29e082f6fe60e88f2e8c";
const body = "Documented the `--version` flag in the CLI help output.\n\n" + commitUrl;
const query = `mutation {
  commentCreate(input: {
    issueId: "MIG-14",
    body: "${body}"
  }) {
    success
    comment {
      id
      url
    }
  }
}`;

const req = https.request('https://api.linear.app/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': process.env.LINEAR_API_KEY
  }
}, (res) => {
  res.pipe(process.stdout);
});

req.write(JSON.stringify({ query }));
req.end();
