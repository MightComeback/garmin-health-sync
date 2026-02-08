(async()=>{
  const { getIssueByIdentifier } = require('/Users/might/clawd/repos/hakky-tools/hakky/lib/linear');
  const apiKey = process.env.LINEAR_API_KEY;
  const issue = await getIssueByIdentifier(apiKey, 'MIG-15');
  require('fs').writeFileSync(
    '/Users/might/clawd/tmp/mig15_state.json',
    JSON.stringify({
      stateType: issue?.state?.type || null,
      title: issue?.title || null,
      url: issue?.url || null,
    }, null, 2)
  );
})().catch(e=>{
  require('fs').writeFileSync('/Users/might/clawd/tmp/mig15_state.json', JSON.stringify({ error: String(e?.stack || e) }, null, 2));
  process.exit(0);
});
