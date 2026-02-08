# gtd-digest

Small CLI to extract a GTD digest from an `Updates.md` file.

## What it does

- Collects all Trello links in the file.
- Extracts the checklist items inside the `Next` section.
- Prints a compact digest to stdout.

## Usage

```sh
./gtd-digest --help
./gtd-digest /path/to/Updates.md
```

## Output format

```
GTD Digest
File: /absolute/path/to/Updates.md

Trello links (2)
- https://trello.com/c/abc123
- https://trello.com/c/def456

Next checklist (3)
- [ ] Do the thing
- [x] Already done
- [ ] Another task

Digest summary
- Trello links: 2
- Next checklist items: 3
```

## Notes

- The `Next` section is matched by a markdown heading like `# Next` or `## Next`.
- Checklist items are matched as `- [ ]` or `- [x]` lines.
