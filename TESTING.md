# OccuVision Testing

## Prerequisites

- Windows PowerShell 5.1 or later.
- Node.js and npm available on `PATH`.
- Python available for setting up the YOLO virtual environment.
- The repository's frontend and backend npm dependencies installed.
- The YOLO virtual environment at `YOLO\venv` with its requirements installed.

The test runner does not install dependencies, start a backend/database, or
modify application or SRS files. It reports a missing command, dependency
directory, or Python virtual environment as a failed suite and continues to
the remaining suites.

## Setting up dependencies

Run these commands from the repository root in PowerShell:

```powershell
Push-Location .\frontend
npm ci
Pop-Location

Push-Location .\backend
npm ci
Pop-Location
```

For a new YOLO environment:

```powershell
py -m venv .\YOLO\venv
.\YOLO\venv\Scripts\python.exe -m pip install -r .\YOLO\requirements.txt
.\YOLO\venv\Scripts\python.exe -m pip install -r .\YOLO\requirements-test.txt
```

If PowerShell script execution is restricted, run this script in the current
process without changing the machine-wide execution policy:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-tests.ps1
```

## Run each suite independently

Frontend (Vitest), from `frontend`:

```powershell
Push-Location .\frontend
npm test -- --reporter=dot
Pop-Location
```

Backend (Node.js built-in `node:test`), from `backend`:

```powershell
Push-Location .\backend
npm test
Pop-Location
```

Python (pytest using the existing Windows virtual environment), from `YOLO`:

```powershell
Push-Location .\YOLO
.\venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
Pop-Location
```

## Run all automated suites

From the repository root:

```powershell
.\run-tests.ps1
```

The script runs frontend, backend, and Python tests in sequence. It prints a
heading before each suite, records each command's actual exit code, and
continues after a failed suite. The final summary shows `PASS` only for suites
whose command exited with code 0; otherwise it shows `FAIL` and the exit code.
The runner itself exits 0 only when all three suites pass, and nonzero if any
suite fails or cannot be run.

## Optional frontend production build

The production build is separate from the test runner. Run it from
`frontend`:

```powershell
Push-Location .\frontend
npm run build
Pop-Location
```

## Test locations and scope

- Frontend tests: `frontend\tests\feature-*.test.js` (Vitest, Vue Test Utils,
  jsdom), organized by OccuVision feature.
- Backend tests: `backend\test\feature-*.test.js` (Node.js `node:test`),
  organized by feature.
- Python tests: `YOLO\tests\feature_05_occupancy_detection\` (pytest).
- Feature/SRS mappings and recorded executions:
  `docs\automated-test-traceability.md`.

These are isolated unit tests. Frontend and backend tests mock API/database
boundaries; Python tests mock detector outputs, camera capture, or HTTP
responses where applicable. Passing tests do not establish MySQL persistence,
real API integration, end-to-end behavior, live camera operation, or real YOLO
inference/accuracy. Refer to the traceability document for feature-specific
coverage and limitations.

## Troubleshooting

- **`npm` or `node` not found:** Install Node.js (which includes npm), reopen
  PowerShell, and check `node --version` and `npm --version`.
- **Frontend Vitest missing:** From `frontend`, run `npm ci`; confirm
  `frontend\node_modules\.bin\vitest.cmd` exists.
- **Backend dependencies missing:** From `backend`, run `npm ci`.
- **Python virtual environment missing:** Create it with
  `py -m venv .\YOLO\venv`, then install both YOLO requirements files as shown
  above.
- **`No module named pytest`:** Use the YOLO virtual-environment interpreter
  to install `YOLO\requirements-test.txt`; do not rely on a global pytest.
- **Any suite fails:** Read that suite's output and use its independent command
  to reproduce the failure. The runner continues to later suites so the
  summary includes every result.
- **PowerShell blocks the script:** Use the process-scoped
  `-ExecutionPolicy Bypass` command above, subject to your organization's
  security policy.

## Dependency audit follow-up

The frontend production dependency audit was inspected with:

```powershell
Push-Location .\frontend
npm audit --omit=dev
Pop-Location
```

At the time of this check, npm reported five high-severity advisory entries
across the following installed production dependency tree:

| Affected package | Dependency path / advisory | Relevance |
|---|---|---|
| `vue` / `@vue/server-renderer` | Vue `3.5.38` includes server renderer `<3.5.42`; GHSA-g2v6-rqmx-r4w6 describes XSS through malformed attribute names. | Vue is a direct production dependency. The app currently uses client-side routing, but any server-side rendering or use of the renderer with attacker-controlled content warrants prompt review. |
| `nanoid` | Vue compiler/PostCSS dependency; installed `3.3.15`. GHSA-28wg-ghj8-5hjv and GHSA-2v37-7h3g-55p8 describe non-terminating loops for invalid generator sizes. | Transitive production dependency. Review whether affected generator paths can receive untrusted sizes in the deployed application/tooling. |
| `postcss` | Vue compiler-SFC dependency; installed `8.5.17`. GHSA-fxqj-rqcc-2cmp and GHSA-r28c-9q8g-f849 cover source-map path disclosure/path traversal conditions. | Transitive production dependency in npm's tree; relevance depends on whether the package processes untrusted CSS/source maps in a reachable deployed context. |
| `source-map-js` | Vue compiler dependency; installed `1.2.1`. GHSA-68fv-2mgg-jv7q describes event-loop denial of service from malformed indexed source maps. | Transitive production dependency; review exposure to untrusted source-map data. |

This table summarizes npm's advisory output, not a local exploitability
assessment. The audit listed fixes as available. No audit fix or package
version change was made by the test-runner task; owners should review the
lockfile and application exposure, then schedule a separate dependency update
and re-run tests/build/audit. To recheck current advisories, run the audit
command above.
