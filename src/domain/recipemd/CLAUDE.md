# Recipe import notes

- `recipes_vault_copy/` is a git-ignored local copy of the Obsidian vault. `src/domain/recipemd/vault.test.ts` parses every recipe in it, and is skipped when the folder isn't there.
- The vault drifts from strict RecipeMD: YAML frontmatter, no `# Title` (the filename is the title), `#hashtag` tags, plain-text yields, ingredient groups as indented plain lines, units outside `*…*`, unicode fractions and NBSPs, and gram hints like `butter (115g)`. `parse.ts` handles all of these, and `serialize.ts` writes strict RecipeMD back out.
- `Ribs.md` has template text pasted into an ingredient, and `Breakfast Sandwich.md` is the unfilled template. The importer flags both.
