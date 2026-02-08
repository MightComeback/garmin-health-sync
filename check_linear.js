const https = require('https');

const query = `query {
  issue(id: "MIG-14") {
    state {
      type
      name
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
        // Fallback: search by filter if ID lookup fails
        console.log(JSON.stringify({ error: json.errors }));
      } else {
        console.log(JSON.stringify(json.data.issue));
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
