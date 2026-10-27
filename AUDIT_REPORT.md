# SecurePay Crypto: Website Project Audit and SLA Report

**Audit basis:** Current working tree inspected on 22 October 2026  
**Project name:** SecurePay Crypto / Secure Digital Payment System  
**Repository:** [Shubham46-glitch/SecurePay_Crypto](https://github.com/Shubham46-glitch/SecurePay_Crypto)  
**Local application URL used for browser inspection:** `http://localhost:3000`  
**Live website URL:** Unverified. Candidate GitHub Pages URLs tested during the audit returned HTTP 404.  
**Technology verified:** React 18, React Router, Webpack, CSS, Axios, Express, Node.js, native Node cryptography  
**Hosting configuration verified:** GitHub Pages workflow for the frontend and Vercel configuration for the backend  

## Audit scope and evidence policy

This report is based on the accessible source tree, package manifests, deployment configuration, generated build output, automated tests that were already run during the audit, and local browser inspection. It does not claim a feature merely because it is mentioned in interface text. Browser observations are separated from source-code observations. No destructive testing, private-resource access, or secret disclosure was performed.

The repository had uncommitted changes when inspected. The audit therefore describes the current working tree, not necessarily the last committed revision. A root `README.md` was absent in the current tree, while the Git remote was verified as `https://github.com/Shubham46-glitch/SecurePay_Crypto.git`.

## 1. Introduction

SecurePay Crypto is an academic educational simulator for secure digital payments. It presents a payment workflow and explains how SHA-256 integrity hashing, HMAC-SHA-256 authentication, RSA-2048 signatures, nonce/timestamp freshness checks, and attack simulations can protect a transaction.

The project is broader than a static HTML assignment. It consists of a single-page React frontend, a Node/Express backend, cryptographic helper modules, in-memory demo data, security-event logging, automated backend tests, and deployment automation. The principal educational value is the visible connection between a payment action and the cryptographic checks performed by the API.

## 2. Problem Statement

Digital payment messages can be altered, replayed, forged, or falsely confirmed if integrity, authenticity, freshness, and sender identity are not checked. SecurePay Crypto addresses this educational problem by allowing a learner to create a simulated transaction, inspect its cryptographic values, verify it, and launch controlled tampering, replay, forgery, and fake-confirmation scenarios.

This purpose is evidenced by the project overview in [`src/pages/LandingPage.jsx`](./src/pages/LandingPage.jsx), the transaction APIs in [`backend/src/controllers/paymentController.js`](./backend/src/controllers/paymentController.js), and the attack routes in [`backend/src/routes/simulationRoutes.js`](./backend/src/routes/simulationRoutes.js).

## 3. Objectives

The implemented objectives are:

1. Demonstrate deterministic SHA-256 hashing of a canonical transaction payload.
2. Demonstrate HMAC-SHA-256 authentication using a server-side secret.
3. Demonstrate RSA-2048/RSA-SHA256 signing and verification.
4. Demonstrate nonce uniqueness and a timestamp freshness window to resist replay.
5. Provide an interactive payment simulator with demo identities and simulated balances.
6. Provide transaction history, transaction verification, and a security dashboard.
7. Provide attack simulations for tampering, replay, forgery, and fake confirmation.
8. Record security events and expose them through dashboard APIs.
9. Publish the frontend through a GitHub Pages workflow and support a separately deployed backend.

The objectives above are verified by source files and tests. The system is educational; it is not a production payment processor.

## 4. Repository and Technology Inventory

### 4.1 Structure inspected

| Area | Important files | Purpose |
|---|---|---|
| Frontend entry | [`src/index.jsx`](./src/index.jsx), [`src/App.jsx`](./src/App.jsx) | React bootstrap, global CSS, routes, provider composition |
| Shared UI | [`src/components/`](./src/components/) | Layout, navigation, modals, crypto displays, timelines, indicators |
| Pages | [`src/pages/`](./src/pages/) | Dashboard, overview, payments, history, verification, attack simulation, security dashboard |
| Frontend state/API | [`src/context/DemoContext.jsx`](./src/context/DemoContext.jsx), [`src/services/api.js`](./src/services/api.js) | Demo accounts, refresh state, Axios service methods |
| Styling | [`src/styles/theme.css`](./src/styles/theme.css) | Design tokens, components, layout, responsive rules |
| HTML shell | [`public/index.html`](./public/index.html) | Root element, metadata, favicon, Google Fonts |
| Backend entry | [`backend/src/server.js`](./backend/src/server.js) | Express app, CORS, middleware, route registration, health endpoint |
| Backend routes/controllers | [`backend/src/routes/`](./backend/src/routes/), [`backend/src/controllers/`](./backend/src/controllers/) | Auth, payment, verification, simulation, security APIs |
| Cryptography | [`backend/src/crypto/`](./backend/src/crypto/) | AES, HMAC, RSA, SHA-256, nonce helpers |
| Data model/storage | [`backend/src/models/`](./backend/src/models/), [`backend/src/store/`](./backend/src/store/) | Mongoose schemas retained in the tree and in-memory fallback/demo state |
| Tests | [`backend/`](./backend/) test files | API, cryptography, replay, dashboard, security-fix, and academic-flow tests |
| Build/deployment | [`webpack.config.js`](./webpack.config.js), [`babel.config.json`](./babel.config.json), [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml), [`backend/vercel.json`](./backend/vercel.json) | Frontend bundling, transpilation, Pages deployment, Vercel backend routing |

### 4.2 Assets and media

The accessible non-dependency asset inventory contains [`public/favicon.png`](./public/favicon.png) and the generated [`dist/favicon.png`](./dist/favicon.png). No application image gallery, audio files, video files, or media players were found. Visual icons are rendered through `lucide-react`, and Google Fonts are loaded externally from `fonts.googleapis.com`.

### 4.3 Application connections

[`src/App.jsx`](./src/App.jsx) uses `HashRouter` and defines routes for `/`, `/overview`, `/payment`, `/history`, `/verify`, `/simulation`, and `/security`. The frontend calls backend endpoints through [`src/services/api.js`](./src/services/api.js). In development, `/api` is proxied to `http://localhost:5000` by [`webpack.config.js`](./webpack.config.js). In production, `REACT_APP_API_URL` is injected during the GitHub Actions build.

## 5. Website Design and Implementation Audit

### 5.1 HTML and semantic structure

**Confirmed strengths**

- The HTML shell declares `<!DOCTYPE html>`, `lang="en"`, UTF-8 encoding, and a responsive viewport in [`public/index.html`](./public/index.html).
- The application uses semantic landmarks including `header`, `nav`, `main`, `aside`, `section`, `form`, `table`, `thead`, `tbody`, and `footer-like simulator content`.
- React pages generally use an `h1` page title followed by `h2` card headings.
- The payment form connects labels to controls using `htmlFor` and matching IDs.
- Navigation links are implemented using React Router `Link`, `NavLink`, and `Navigate`.
- Tables in the history and security dashboard include header rows and data rows.

**Issues and limitations**

- Accessibility is not fully validated against a formal WCAG tool. Several decorative icons are represented as images in the browser accessibility snapshot without a complete audit of their hidden/alternative behavior.
- Modal focus trapping, Escape-key closing, and focus restoration were not proven by source inspection or browser testing.
- The UI contains many inline styles, which makes global maintenance and consistent responsive behavior harder.
- [`src/pages/LandingPage.jsx`](./src/pages/LandingPage.jsx) contains a link to `/dashboard`, but [`src/App.jsx`](./src/App.jsx) defines the dashboard at `/`. The wildcard route redirects unknown paths to `/`, so the link is recoverable but incorrect and should be changed to `/`.

### 5.2 Forms and tables

The payment form in [`src/pages/MakePaymentPage.jsx`](./src/pages/MakePaymentPage.jsx) includes sender and receiver selection, custom identity inputs, amount, currency, required amount validation, quick amount buttons, and submit behavior. Client-side checks reject missing identities, identical identities, invalid amounts, and non-positive amounts. The form then opens the transaction lifecycle modal and ultimately calls the server.

The transaction search/filter form and tables are implemented in [`src/pages/TransactionHistoryPage.jsx`](./src/pages/TransactionHistoryPage.jsx). Security-event and live-ledger tables are implemented in [`src/pages/SecurityDashboardPage.jsx`](./src/pages/SecurityDashboardPage.jsx). These are real data views backed by API calls, not merely static demonstrations.

The project does not implement a contact form. Registration/login routes remain in the backend, but the current demo frontend intentionally redirects `/login` and `/register` to the dashboard and presents shared demo identities instead of a user-authenticated workflow.

### 5.3 CSS and responsive design

[`src/styles/theme.css`](./src/styles/theme.css) defines design tokens for colors, typography, spacing, radii, borders, and shadows. It uses Flexbox for application layout and navigation, CSS Grid for metric/card layouts, responsive media queries at 1024px, 900px, 768px, and 640px, and container queries for the lifecycle stepper. Tables are wrapped in `.table-responsive` with horizontal scrolling.

Positive implementation details include:

- A fixed/sticky desktop sidebar with a mobile transform-based drawer.
- A mobile navigation toggle and backdrop.
- Responsive cards and tables.
- Visible form focus treatment through `.form-control:focus`.
- A `prefers-reduced-motion: reduce` rule near the end of the stylesheet.
- Responsive vertical conversion of the transaction lifecycle stepper.

The local browser inspection found no horizontal overflow at 1440 × 900, but it found horizontal overflow at 375 × 812 on the dashboard and payment pages (`document.body.scrollWidth` exceeded the viewport width). The likely contributors include fixed minimum widths such as `minmax(400px, 1fr)` in page-level inline grids and wide content blocks. This is a confirmed mobile-layout issue that should be fixed before claiming full mobile responsiveness.

### 5.4 JavaScript and interaction

The frontend implements:

- Route navigation and active navigation states.
- Demo-account loading and refresh through [`src/context/DemoContext.jsx`](./src/context/DemoContext.jsx).
- Payment submission and client-side validation.
- Transaction lifecycle animation and modal actions.
- Transaction verification with optional tamper simulation.
- Transaction history search, status filtering, row verification, and detail modals.
- Attack simulation controls for multiple attack classes.
- Security dashboard filtering and live data refresh.
- Copy-to-clipboard behavior for cryptographic values.

The backend implements real cryptographic operations using Node's `crypto` module. [`backend/src/crypto/hmac.js`](./backend/src/crypto/hmac.js) uses HMAC-SHA-256 and timing-safe comparison. [`backend/src/crypto/rsa.js`](./backend/src/crypto/rsa.js) generates RSA-2048 keys and signs/verifies RSA-SHA256 payloads. [`backend/src/crypto/nonce.js`](./backend/src/crypto/nonce.js) uses `crypto.randomBytes`, timestamp freshness, and a consumed-nonce store.

### 5.5 Media embedding

No audio or video feature is present. The only raster asset found is the favicon. Therefore, media controls, captions, video responsiveness, and audio fallback behavior are not applicable. The report does not claim media embedding.

## 6. Code Snippets and Screenshot Recommendations

### 6.1 Real code snippets

**Frontend route composition — [`src/App.jsx`](./src/App.jsx)**

```jsx
<HashRouter>
  <Layout>
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/payment" element={<MakePaymentPage />} />
      <Route path="/verify" element={<TransactionVerificationPage />} />
      <Route path="/simulation" element={<AttackSimulationPage />} />
    </Routes>
  </Layout>
</HashRouter>
```

This establishes the SPA route map. It is verified source behavior; it is not server-side page routing.

**Payment validation — [`src/pages/MakePaymentPage.jsx`](./src/pages/MakePaymentPage.jsx)**

```jsx
const parsedAmount = parseFloat(amount);
if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
  setError('Please enter a valid amount greater than 0.');
  return;
}
```

This is client-side validation only. The backend must continue to validate every request independently.

**Timing-safe HMAC verification — [`backend/src/crypto/hmac.js`](./backend/src/crypto/hmac.js)**

```js
if (computedBuffer.length !== providedBuffer.length) {
  return false;
}
return crypto.timingSafeEqual(computedBuffer, providedBuffer);
```

This prevents a simple timing comparison of unequal-length or mismatched signatures.

**CSPRNG nonce generation — [`backend/src/crypto/nonce.js`](./backend/src/crypto/nonce.js)**

```js
function generateNonce(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}
```

The implementation uses cryptographically secure random bytes rather than `Math.random()`.

### 6.2 Recommended screenshots

Capture these screenshots manually for the final SLA submission:

1. Dashboard at desktop width showing metrics and the application shell.
2. Project Overview page showing the five cryptographic pillars.
3. Payment page before submission, including labeled controls.
4. Transaction lifecycle modal after a successful simulated payment.
5. Transaction History table with a real transaction row.
6. Verify Security page showing successful SHA-256, HMAC, RSA, timestamp, and nonce results.
7. Attack Simulation page showing a blocked tampering or replay attempt.
8. Security Dashboard showing the security-event log and metrics.
9. Mobile payment page with the navigation drawer open.
10. GitHub Actions deployment run and the deployed page, only after a real successful deployment is available.

No screenshot is claimed as captured for this report.

## 7. Testing and Results

The following results are recorded from tests already executed during this audit. No additional testing is being requested or performed after the user's instruction.

| Test ID | Feature | Test procedure | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| T01 | Frontend build | Run `npm run build` after dependencies were installed | Production bundle completes | Webpack completed; 3 performance warnings | PASS |
| T02 | Page loading | Open local frontend at `http://localhost:3000` | App shell and dashboard render | Title, sidebar, navbar, and dashboard rendered | PASS |
| T03 | Navigation links | Inspect rendered route links | Links target implemented routes | Main routes rendered; `/dashboard` link was found as an incorrect legacy target | FAIL |
| T04 | Payment form | Inspect payment route and controls | Labels, controls, required amount, submit behavior | Form and labels rendered; amount is required; submit opens lifecycle flow | PASS |
| T05 | Backend health | Request `/api/health` | HTTP 200 with service status | HTTP 200; in-memory storage reported | PASS |
| T06 | End-to-end security audit | Run `backend/audit_test_suite.js` against local API | All security-flow assertions pass | 66/66 assertions passed | PASS |
| T07 | HMAC/RSA unit behavior | Run focused HMAC and RSA tests | Valid data passes; tampering fails | All reported cryptographic checks passed | PASS |
| T08 | Tables and content | Inspect history/security dashboard source and UI | Structured tables display API data | Tables with `thead`, `tbody`, filters, and rows implemented | PASS |
| T09 | Image/media loading | Inspect asset inventory and local page | Referenced assets load; media behavior is valid | Favicon exists; no audio/video features found | PASS |
| T10 | Desktop responsiveness | Browser check at 1440 × 900 | No viewport overflow; desktop sidebar visible | No horizontal overflow; 260px sidebar visible | PASS |
| T11 | Mobile responsiveness | Browser check at 375 × 812 | Layout fits viewport and adapts | Mobile drawer appears, but body width exceeded viewport | FAIL |
| T12 | Console/API behavior | Observe local browser console | No unexpected runtime errors | Dashboard requests logged 504 errors in one browser session while API state was being exercised; errors were surfaced rather than hidden | FAIL |
| T13 | Deployment availability | Probe candidate Pages/backend URLs | Live deployment responds | Candidate URLs returned HTTP 404; no verified live URL | BLOCKED |
| T14 | Dependency audit | Run `npm audit --omit=dev --json` | No production advisories | No production vulnerabilities reported; initial install reported four high findings in the full dependency tree, requiring follow-up review | PASS |

The local browser's 504 observations are environment/session evidence, not proof that the source always fails. Direct requests to the local health, dashboard, and logs endpoints returned HTTP 200. The discrepancy should be reproduced in a clean local session before release.

## 8. Responsiveness and Accessibility Review

### Viewport review

| Viewport | Evidence | Result |
|---|---|---|
| 375 × 812 | Browser inspection of dashboard and payment routes | Mobile navigation appears and sidebar is off-canvas, but horizontal overflow was measured |
| 768 × 1024 | CSS source inspection only | Media-query and stacked-layout rules are present; not independently browser-measured |
| 1440 × 900 | Browser inspection | Desktop sidebar and dashboard render without horizontal overflow |

### Accessibility findings

Confirmed positive practices include semantic headings and landmarks, explicit payment labels, keyboard-focus styling for form controls, button `type` attributes in the inspected forms, and accessible labels for the mobile navigation controls.

Recommended improvements:

1. Add a formal automated accessibility check such as axe or Lighthouse to the CI process.
2. Add focus trapping and Escape-key support to dialogs.
3. Ensure every dialog has robust accessible naming and focus restoration.
4. Verify contrast for muted text, status badges, and colored indicators.
5. Replace inline layout styles with reusable classes where possible.
6. Fix mobile overflow before claiming full mobile support.

## 9. Code Quality and Basic Security Review

### Strengths

- The code is separated into frontend pages/components, backend routes/controllers, and dedicated cryptographic helpers.
- Secrets are resolved through environment variables or ephemeral development secrets in [`backend/src/config/secrets.js`](./backend/src/config/secrets.js); fixed production secrets are not present in source.
- Passwords are hashed with `bcryptjs`.
- Private RSA keys are intentionally omitted from API responses in the authentication controller.
- HMAC verification uses `crypto.timingSafeEqual`.
- RSA key generation uses 2048-bit keys and native Node cryptography.
- Nonces use `crypto.randomBytes`, and replay/timestamp checks are explicitly implemented.
- The backend error handler removes stack traces when `NODE_ENV=production`.
- The focused security audit reported 66/66 passing assertions.

### Issues and security limitations

1. **CORS is effectively permissive.** In [`backend/src/server.js`](./backend/src/server.js), the CORS callback returns success for origins that do not match the configured client URL. This is acceptable for a classroom demo but should be restricted to an explicit allowlist in a deployed application.
2. **Demo endpoints intentionally require no authentication.** [`backend/src/routes/transactionRoutes.js`](./backend/src/routes/transactionRoutes.js) uses optional authentication, and demo accounts are shared. This must not be mistaken for production account isolation.
3. **The backend is currently in-memory only.** [`backend/src/config/db.js`](./backend/src/config/db.js) explicitly disables MongoDB. Balances, transactions, nonces, and logs can disappear on restart.
4. **Client-side validation is not a security boundary.** All amount, identity, authorization, ownership, replay, and cryptographic checks must remain enforced on the backend.
5. **External Google Fonts create a third-party request.** A production deployment should consider self-hosting fonts or documenting the privacy/performance implication.
6. **Bundle size is high.** The production build reported a 422 KiB JavaScript bundle and a 679 KiB favicon, above Webpack's recommended asset threshold. Route-level lazy loading and asset optimization are appropriate improvements.
7. **The source tree contains legacy authentication code while the current UI uses demo mode.** This is understandable for an academic evolution, but dead or inactive paths should be documented or removed to reduce maintenance ambiguity.
8. **Dependency hygiene needs clarification.** The install output reported four high findings across the full installed tree, while the production-only JSON audit reported zero vulnerabilities. The project should document the exact audit command and review dev dependency advisories before publication.

No hardcoded live credential was exposed in this report. The `.env` files were not reproduced.

## 10. Deployment Verification Report

### Verified configuration

- [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) runs on pushes to `main` and manual dispatch.
- It uses Node.js 22, `npm ci`, and `npm run build`.
- It sets `PUBLIC_URL` to `/${{ github.event.repository.name }}/`.
- It injects `REACT_APP_API_URL` from a GitHub Actions secret.
- It uploads `dist` through the GitHub Pages artifact action and deploys with `actions/deploy-pages`.
- [`backend/vercel.json`](./backend/vercel.json) maps `backend/src/server.js` to `@vercel/node`.

### Unverified or failed deployment evidence

The repository remote was verified, but no live URL was supplied in the project files. Probes of the candidate URLs `https://shubham46-glitch.github.io/SecurePay_Crypto/`, `https://vinay-ops.github.io/SecurePay_Crypto/`, and `https://securepay-crypto.vercel.app/api/health` returned HTTP 404. Consequently:

- GitHub Pages publication is configured but not confirmed as successful.
- The exact Pages project URL is unverified.
- The Vercel backend URL is unverified.
- Deployed/local parity cannot be established.
- A GitHub Actions run and Pages settings must be checked to determine the configured branch and publishing source.

### Reproduction steps

1. Configure GitHub Pages for GitHub Actions in the repository settings.
2. Add the production backend URL plus `/api` as the `REACT_APP_API_URL` Actions secret.
3. Push the frontend and workflow files to `main`, or run the workflow manually.
4. Confirm the Pages workflow completes and opens the generated repository Pages URL.
5. Deploy `backend/` to Vercel using [`backend/vercel.json`](./backend/vercel.json).
6. Set `NODE_ENV=production`, `HMAC_SECRET`, `JWT_SECRET`, `CLIENT_URL`, and any deployment-specific environment variables.
7. Request `/api/health`, then open the Pages site and confirm browser API calls reach the deployed backend.

## 11. Prioritized Issues and Improvements

| Priority | Issue | Evidence | Recommended action |
|---|---|---|---|
| P0 | Live deployment is not verified | Candidate URLs returned 404 | Confirm Pages settings, workflow run, final Pages URL, and Vercel URL |
| P0 | CORS allows arbitrary origins | [`backend/src/server.js`](./backend/src/server.js) | Enforce a strict production origin allowlist |
| P1 | Mobile horizontal overflow | Browser measurement at 375 × 812 | Remove/override fixed grid minimums and test all major routes |
| P1 | Incorrect `/dashboard` link | [`src/pages/LandingPage.jsx`](./src/pages/LandingPage.jsx) vs [`src/App.jsx`](./src/App.jsx) | Link to `/` or add an explicit `/dashboard` route |
| P1 | In-memory-only persistence | [`backend/src/config/db.js`](./backend/src/config/db.js) | Clearly label demo mode or implement tested persistent storage |
| P1 | Browser 504 observations | Local browser console; direct API later returned 200 | Reproduce with a clean session and improve loading/error retry UX |
| P2 | Large bundle and favicon | Webpack build warnings | Lazy-load routes, optimize favicon, and measure performance |
| P2 | Formal accessibility validation absent | No accessibility test tool in scripts | Add Lighthouse/axe checks and dialog keyboard tests |
| P2 | Legacy auth/demo ambiguity | Backend auth routes plus demo-only current UI | Document the active architecture and remove unused paths when stable |
| P3 | Documentation absent/outdated | No current root README found | Add setup, environment, architecture, deployment, and limitations documentation |

## 12. Limitations and Future Enhancements

### Current limitations

- The backend uses volatile process memory, so data resets after restart.
- Demo identities are shared and are not private accounts.
- No verified public deployment URL was available.
- Formal accessibility, cross-browser, and 768px browser measurements were not completed.
- Browser console observations included transient API 504 errors in the local session.
- The application is an educational simulator, not a regulated payment service.

### Practical future enhancements

- Use a persistent database with migrations, indexes, transaction ownership, and atomic balance updates.
- Enforce authentication and authorization consistently for non-demo routes.
- Restrict CORS and add rate limiting, security headers, request-size limits, and structured audit logging.
- Add automated unit, integration, accessibility, and end-to-end tests to CI.
- Implement route-level code splitting and optimize static assets.
- Add a clear deployment status page and environment validation endpoint that never returns secrets.
- Improve mobile layouts and add a tested modal focus-management pattern.
- Add a current README and an architecture diagram for academic reproducibility.

## 13. Conclusion

SecurePay Crypto is a substantial academic security simulator rather than a simple static website. The current working tree implements a React/Webpack frontend with multiple interactive pages and an Express backend with real SHA-256, HMAC-SHA-256, RSA-2048, nonce, timestamp, and attack-simulation logic. The focused backend audit passed all 66 recorded assertions, the production frontend build completed, and the local desktop application rendered successfully.

The principal confirmed weaknesses are deployment uncertainty, permissive CORS, volatile in-memory storage, a mobile overflow defect, one incorrect navigation target, large build assets, and incomplete formal accessibility evidence. These issues do not invalidate the educational demonstration, but they should be addressed or explicitly documented before academic submission as a production-ready system.

### Final audit summary

**Confirmed strengths**

- Clear separation of frontend, backend, routes, controllers, and cryptographic helpers.
- Real cryptographic verification paths rather than visual-only labels.
- Successful recorded 66/66 backend security audit.
- Working local React application and production build.
- Responsive navigation design and accessible form labels in inspected areas.

**Confirmed issues**

- Mobile horizontal overflow at 375 × 812.
- Incorrect `/dashboard` link target.
- Backend CORS policy is permissive.
- In-memory storage is volatile.
- Deployment URLs and deployment success are unverified.
- Build asset sizes exceed Webpack recommendations.

**Recommended next actions**

1. Verify and document the actual GitHub Pages and Vercel URLs.
2. Fix mobile overflow and the incorrect dashboard link.
3. Restrict CORS and clearly separate demo endpoints from authenticated production endpoints.
4. Add formal accessibility and clean-session browser validation.
5. Add or update the project README with reproducible setup and deployment steps.
