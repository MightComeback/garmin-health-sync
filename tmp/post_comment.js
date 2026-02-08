const https = require('https');

const commitUrl = process.argv[2];
const summary = process.argv[3];
const issueId = "34f059f0-32c9-4abc-998a-63034604cbcf";

if (!commitUrl || !summary) {
  console.error("Usage: node post_comment.js <url> <summary>");
  process.exit(1);
}

const bodyStr = `${summary}\n\n${commitUrl}`;

const query = JSON.stringify({
  query: `mutation {
    commentCreate(input: {
      issueId: "${issueId}",
      body: ${JSON.stringify(bodyStr)}
    }) {
      success
      comment {
        url
      }
    }
  }`
});

const options = {
  hostname: 'api.linear.app',
  path: '/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': process.env.LINEAR_API_KEY
  }
};

const req = https.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(body);
      if (json.errors) {
        console.error("Linear Error:", JSON.stringify(json.errors));
        process.exit(1);
      } else {
        console.log("Comment posted:", json.data?.commentCreate?.comment?.url);
      }
    } catch (e) {
      console.error("Parse Error:", e);
      process.exit(1);
    }
  });
});

req.on('error', error => {
  console.error("Request Error:", error);
  process.exit(1);
});

req.write(query);
req.end();
