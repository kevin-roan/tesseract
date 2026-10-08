export const MARKDOWN_SAMPLE = `# Android on a Mac host
## What changes
I compared both options in a **comparison table**. The most important finding: installing an \`.app\` from the sandbox runs native code on the Mac as the user.
So iOS support is off by default.

1. **Draft types and API:** draft \`/v1/ios/*\` endpoints and types.
2. **Plan:** it starts with a ½–1 day spike on a Mac.
   It can only run without isolation.

- [x] Read \`00-blueprint.md\`
- [ ] Ask for _review_ before ~~merging~~ committing
  - nested item with a link to [the status page](https://status.claude.com)

> Quotes render in the secondary color,
> and keep their line breaks.

| Host | Accel | Images |
|---|---|---|
| Linux | KVM | x86_64 |
| macOS | HVF | arm64-v8a |
| Windows | WHPX |

---

\`\`\`bash
docker compose -p tesseract-test-sandbox up -d
curl -fsS http://127.0.0.1:7700/v1/health
\`\`\`

Plain URLs like https://docs.expo.dev/versions/v55.0.0/ are linked; javascript:alert(1) is not.`;
