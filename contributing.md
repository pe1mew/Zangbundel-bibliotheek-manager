# Contributing Guidelines

Thank you for considering contributing to the Zangbundel bibliotheek-manager. The project is in its design phase: the functional design specification under `design/` is the product until the manager exists, and most contributions right now are reviews and improvements of that document.

## What to contribute, and where

| You want to | Do this |
|---|---|
| Question or improve a requirement or validation rule | Open an issue or a pull request against `design/FDS.md`. Quote the ID (`EDT-32`, `SNG-06`, `M-51`, …). |
| Answer one of the open items (FDS section 11) | Open an issue with your reasoning or, better, examples from real libraries. |
| Change how the Zangbundel app imports a library (FDS section 8) | Open the issue here, since the rules are shared, and mention it in the [Zangbundel repository](https://github.com/pe1mew/Zangbundel). The app's code lives there. |
| Contribute a test library (FDS O-04) | Open an issue first: the shared test set is not yet defined. Test libraries contain only songs that are public domain or written for the test. |
| Contribute songs or lyrics | **Not here.** This repository contains no lyrics and does not accept any. Songs go in a library, such as [Zangbundel-bibliotheek](https://github.com/pe1mew/Zangbundel-bibliotheek). |
| Start on the implementation | Open an issue before code lands: the implementation technology (web app or native app) is not chosen yet (FDS 1.4, D-01). |

Discussion in English or Dutch is welcome; the documents themselves are in English, with Dutch UI terms in parentheses.

## Getting started

1. **Fork the repository**: click "Fork" on the repository's page.
2. **Clone your fork**:
   ```sh
   git clone https://github.com/<your-user>/Zangbundel-bibliotheek-manager.git
   ```
   The upstream repository is `https://github.com/pe1mew/Zangbundel-bibliotheek-manager.git`.
3. **Create a branch** with a descriptive name:
   ```sh
   git checkout -b design/your-topic
   ```

## Making changes to the design documents

- IDs (`PF-nn`, `MF-nn`, `SG-nn`, `EDT-nn`, `APP-nn`, rule codes such as `PKG-nn`, messages `M-nn`, open items `O-nn`, decisions `D-nn`) are never reused or renumbered. Withdraw a requirement by marking it *Withdrawn*; do not delete it.
- A change to the FDS bumps its status (`Draft 0.2`, …) and date in the header table.
- Keep **must** / **should** / **may** as in RFC 2119.
- A new or changed validation rule names its severity and its message, and the message is added to section 9.
- Add a line under `[Unreleased]` in `changelog.md`.

## Commit messages

Imperative subject, under 72 characters, naming the document and its new version when a specification changes, for example `FDS draft 0.2: display order of sets and songs (O-03)`. Keep commits focused.

## Submitting a pull request

1. **Push to your fork**:
   ```sh
   git push origin design/your-topic
   ```
2. **Open a pull request** against `main` with a clear description: which requirements, rules or sections change, and why.

## Review process

- Pull requests are reviewed by the maintainer.
- Be open to feedback and make the requested changes.
- Keep your branch up to date with `main` before merging.

## Reporting issues

- Check whether the issue has already been reported.
- For design issues, quote the document, version and section or ID.
- For a contradiction within the FDS, or between the FDS and the Zangbundel app's documents, quote both sentences.

## Working with AI coding agents

`CLAUDE.md` in the repository root is the orientation file for AI coding agents and follows the [agent-ready-projects](https://github.com/ducroq/agent-ready-projects) layout. Agents log problems in `memory/gotcha-log.md` and keep `memory/MEMORY.md` as an index. These files are committed and shared; review changes to them like any other.

## Community standards

- Follow the [Code of Conduct](code_of_conduct.md).
- Be respectful and collaborative.
