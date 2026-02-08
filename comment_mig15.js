const https = require('https');

const commitUrl = process.argv[2];
if (!commitUrl) {
  console.error("No commit URL provided");
  process.exit(1);
}

const body = `Synced default idleDelayMs in plugin code to match schema/docs (800ms).\n\n${commitUrl}`;

const query = `mutation {
  commentCreate(input: {
    issueId: "MIG-15",
    body: ${JSON.stringify(body)}
  }) {
    success
    comment {
      id
      url
    }
  }
}`;

const data = JSON.stringify({ query });

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
        console.error(JSON.stringify(json.errors));
        process.exit(1);
      } else {
        console.log("Comment created successfully");
      }
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
});

req.on('error', error => {
  console.error(error);
  process.exit(1);
});

req.write(data);
req.end();
