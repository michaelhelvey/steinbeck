## Toolchains

- Use Vite+ (`vp`) for linting, formatting, and type checks. Configure it in `vite.config.ts`.
- Use bun for package management and runtime code, including unit tests (https://bun.sh/llms.txt)

## General Rules

- Always validate your work via all relevant checks (`bun run validate`) before declaring your work
  done.
- Keep relevant documentation up-to-date when you change code. This does _not_ mean you must _add_
  documentation for every change, it just means that if there is existing documentation affected by
  your change, then you should update it.

## Typescript Rules

- All documentation and code comments should use ASD-STE100 Simplified Technical English.
- Add doc comments to all public exports from a module. Avoid non-doc comments within code unless
  overwhelmingly necessary to explain an otherwise odd decision that would strike the reader as
  wrong at first glance (e.g. a lint ignore).
- Always use `zod` to parse unknown types, rather than casting.

## Solid 2.0

The frontend uses Solid 2.0 (`solid-js` 2.x with `@solidjs/web`), not 1.x. Read
`node_modules/solid-js/skills/solid-2.0/SKILL.md` before you write Solid code, and check unfamiliar
names against `node_modules/solid-js/CHEATSHEET.md`.

- Read props as `props.name`. Do not destructure props.
- `createEffect(compute, apply)` takes two functions.
- Write stores through the draft: `setStore((s) => { s.name = "x"; })`.
- `render` comes from `@solidjs/web`. Stores come from `solid-js`.
- A console warning with a bracketed code (e.g. `[STRICT_READ_UNTRACKED]`) is a defect. Fix it with
  `node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md`.

## Testing Rules

- Do not write tautological tests. Tests must assert something meaningful about the system that they
  test which cannot be trivially derived from the literal tokens in the code.
- Do not write code that requires module mocks in order to test -- use proper dependency injection.
  Creating `mock` functions from `bun:test` in order to assert how they are called is allowed.
