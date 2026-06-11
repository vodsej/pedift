# How pedift compares

**pedift** is a free, MIT-licensed PDF editor that ships as **one self-contained
HTML file**. You download it, double-click it, and edit PDFs fully offline — from
`file://`, with networking disabled, no install, no account, no uploads. Your
files never leave your device.

That positioning is unusual, so this document compares pedift against seven
well-known PDF editors across the categories that matter most: **price**,
**features**, and **online vs. offline / privacy**. It's meant both to show where
pedift is the right tool and to be honest about where it isn't.

> **Pricing note:** All competitor prices are US public list pricing checked in
> **June 2026**. Promotions, regional pricing, enterprise deals, and free-tier
> limits change frequently — treat these as point-in-time figures and verify via
> the linked sources before relying on them.

---

## At-a-glance matrix

| Product | Price | Distribution | Works offline | Files leave device? | Install required? | Open source | OCR | AI |
|---|---|---|---|---|---|---|---|---|
| **pedift** | **Free** | Single HTML file | **Yes (from `file://`)** | **Never** | **No** | **Yes (MIT)** | No | No |
| Adobe Acrobat | $14.99–24.99/mo | Desktop app + cloud | Partial (cloud features online) | Often (Adobe cloud sync) | Yes | No | Yes | Yes (paid add-on) |
| Smallpdf | Free / $15/mo | Cloud (browser) | No | Yes (server-side) | No | No | Yes | Yes |
| iLovePDF | Free / from $9/mo | Cloud + apps | No | Yes (server-side) | No (web) | No | Yes | Yes |
| Sejda | Free / $7.50/mo | Web + desktop | Yes (desktop app) | No on desktop; yes on web | Yes (for offline) | No | Yes | Partial |
| PDF24 Creator | Free | Desktop (Windows only) | **Yes (fully local)** | No (local) | Yes | No | Yes | No |
| PDFgear | Free | Desktop + mobile | Editing yes; AI no | Local edits; AI sends to cloud | Yes | No | Yes | Yes (Copilot, online) |
| Stirling PDF | Free (OSS) / paid enterprise | Self-hosted / Docker / desktop | **Yes (after setup)** | No (your own server) | Yes (Docker/server/app) | **Yes** | Yes | No |

---

## Feature comparison

✓ = supported · ✗ = not supported · ~ = partial/limited. "Edit existing text"
means glyph-level editing of the original text already in the PDF.

| Capability | pedift | Acrobat | Smallpdf | iLovePDF | Sejda | PDF24 | PDFgear | Stirling |
|---|---|---|---|---|---|---|---|---|
| Merge / split / extract | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Page ops (reorder, rotate, delete, crop, insert) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Annotate (text, shapes, highlight, pen, stamps) | ✓ | ✓ | ✓ | ~ | ✓ | ✓ | ✓ | ~ |
| Edit **existing** text (glyph-level) | ✗ (cover & retype) | ✓ | ~ (Pro) | ✗ | ✓ | ~ | ✓ | ✗ |
| Fill form fields | ✓ | ✓ | ✓ | ~ | ✓ | ✓ | ✓ | ✓ |
| Flatten | ✓ | ✓ | ~ | ✗ | ✓ | ~ | ~ | ✓ |
| Watermark / page numbers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Compress | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Metadata editing | ✓ | ✓ | ~ | ✗ | ✓ | ✓ | ~ | ✓ |
| Redaction | ~ (whiteout/flatten) | ✓ | ~ | ✗ | ✓ | ✓ | ~ | ✓ |
| Password protect / unlock | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Signature | ~ (visual only) | ✓ (cryptographic) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Images → PDF / export as image | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| OCR (scanned → text) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Batch / automation API | ✗ | ✓ | ~ | ✓ | ~ | ~ | ✗ | ✓ |
| Cloud sync / collaboration | ✗ | ✓ | ✓ | ✓ | ~ | ✗ | ~ | ~ |
| Undo / redo | ✓ (200 steps) | ✓ | ~ | ✗ | ✓ | ~ | ✓ | ✓ (v2) |

> Competitor cells reflect typical capabilities reported in June 2026; some
> features (e.g. Smallpdf text editing) are gated behind paid tiers. See the
> per-product profiles and sources below.

---

## The competitors

### Adobe Acrobat
The industry standard and the most complete editor in this list — true text
editing, OCR, redaction, cryptographic e-signatures, forms, and an AI Assistant
(separate paid add-on). It's a desktop app paired with Adobe's cloud, so files
can sync to Adobe servers unless you're careful. Pricing runs **$14.99/mo
(Standard) to $24.99/mo (Studio)**, billed annually, plus **$4.99–12/seat/mo**
for AI. The trade-off vs. pedift: vastly more power, but a subscription, an
install, an account, and your documents potentially leaving your machine.
Sources: [Adobe pricing](https://www.adobe.com/acrobat/pricing.html),
[Xodo: Acrobat pricing explained](https://xodo.com/blog/adobe-acrobat-pricing-explained).

### Smallpdf
A polished cloud suite — you upload a file in the browser and it's processed
server-side. The free tier allows only a couple of tasks per day, and editing the
*existing* text in a document requires **Pro ($15/mo; Teams $12/user/mo)**. Great
for quick, occasional jobs if you're comfortable uploading. The trade-off vs.
pedift: convenience and OCR, but your files go to Smallpdf's servers and real use
needs a subscription. Source: [Smallpdf pricing](https://smallpdf.com/pricing).

### iLovePDF
Another well-known cloud suite with a generous toolset, strong batch processing,
and a public API. The free web tier shows ads and caps file size (~25 MB);
**Premium starts around $9/mo**. It also offers mobile and desktop apps. The
trade-off vs. pedift: best-in-class batch/API and broad tooling, but server-side
processing and a paid tier for serious use.
Sources: [iLovePDF vs Smallpdf comparison](https://www.pdftechno.com/blogs/ilovepdf-vs-smallpdf-vs-pdftechno-which-one-makes-the-most-sense),
[Capterra compare](https://www.capterra.com/compare/172606-173963/Smallpdf-vs-iLovePDF).

### Sejda
Notable for offering genuine **text editing** and a **desktop app** that runs
locally (Windows/Mac/Linux) so files needn't leave your computer. The catch is
the free tier's hard throttle — roughly **3 tasks/hour, 50 MB, 200 pages**, with
watermarks on some tools; **Pro is $7.50/mo or $63/yr**. The trade-off vs.
pedift: real text editing and OCR, but to use it offline you install an app and
either pay or live within tight free limits.
Sources: [Sejda Desktop](https://www.sejda.com/desktop),
[Sejda upgrade/pricing](https://www.sejda.com/upgrade),
[Hamsterstack: Sejda pricing](https://hamsterstack.com/pricing/sejda/).

### PDF24 Creator
pedift's closest "free + offline + private" cousin. A genuinely free desktop
toolbox (free for personal *and* commercial use) that processes files locally —
no uploads — and bundles a wide range of tools including OCR, a virtual PDF
printer, redaction, and document compare. Its one big limitation: **Windows
only** (no Mac/Linux install). The trade-off vs. pedift: more tools (incl. OCR),
but tied to Windows and distributed as installed software rather than a single
portable file. Sources: [PDF24 Creator](https://tools.pdf24.org/en/creator),
[PDF24.org](https://www.pdf24.org/en/).

### PDFgear
A fully free desktop + mobile editor (Windows/Mac/iOS/Android) with a standout
GPT-powered **AI Copilot** for summarizing and command-driven editing. Core
editing runs locally, but the AI Copilot requires an internet connection and
sends content to the cloud. The trade-off vs. pedift: free with AI and real text
editing, but "free" with closed-source software plus a cloud-dependent AI feature
means a weaker privacy guarantee than pedift's verifiable offline model.
Sources: [PDFgear](https://www.pdfgear.com/),
[PDFgear AI editor](https://www.pdfgear.com/ai-pdf-editor/).

### Stirling PDF
The other strong open-source option — 50+ tools (OCR, convert, redact, sign,
automation/API), a no-code workflow builder, 40+ UI languages, and (in v2) undo/
redo and native desktop apps. It's **self-hosted**: run the Docker image or app
and nothing leaves your server. **Free and open source**, with paid enterprise
tiers (SSO, auditing). The trade-off vs. pedift: far more power and automation,
but you have to stand up Docker/a server (or install the desktop app) rather than
just opening one file. Sources: [Stirling PDF](https://stirling.com/),
[GitHub](https://github.com/Stirling-Tools/Stirling-PDF),
[Docs](https://docs.stirlingpdf.com/).

---

## Where pedift wins

- **Zero-trust privacy, provable.** pedift runs from `file://` with no network
  calls — the build even fails CI if any external URL sneaks in. Your files
  *cannot* leave your device because the app never talks to a server. Cloud tools
  (Smallpdf, iLovePDF, Acrobat cloud) upload by design; PDFgear's AI and Sejda's
  web mode also send data out. Only PDF24 and self-hosted Stirling match the
  "stays local" promise — and pedift goes further by needing no install at all.
- **No install, no account, no subscription.** It's one ~2.3 MB HTML file. No
  admin rights, no app store, no Docker, no sign-up. Compare PDF24 (Windows
  installer), Stirling (Docker/server), or any of the SaaS tools (account
  required).
- **Truly cross-platform.** Anything with a modern browser runs it — Windows,
  Mac, Linux, ChromeOS, even an air-gapped machine on a USB stick. PDF24 is
  Windows-only; Stirling needs a host you can run containers on.
- **Genuinely free, no asterisks.** No task-per-day caps, no file-size ceilings,
  no watermarks, no paywalled core features. Sejda (3 tasks/hr), Smallpdf
  (~2 tasks/day), and iLovePDF (size limits + ads) all throttle their free tiers;
  editing existing text in Smallpdf needs Pro.
- **Portable and auditable.** Being a single open-source file makes it easy to
  archive, vet, and keep working years from now with no service to shut down.

## Where pedift falls short

- **No OCR.** It can't turn scanned/image PDFs into searchable, editable text.
  Acrobat, PDF24, Sejda, Stirling, Smallpdf, iLovePDF, and PDFgear all do.
- **No glyph-level editing of existing text.** pedift works by covering original
  text and retyping over it (whiteout + new text box), not by editing the
  document's actual text runs. Acrobat, Sejda, and PDFgear edit real text.
- **Signatures are visual only.** You can draw/type/save a signature image, but
  it is **not** a cryptographic digital signature. Acrobat and others offer
  legally-oriented e-signature workflows.
- **No cloud, collaboration, AI, or batch automation/API.** There's no multi-user
  editing, no sync, no AI assistant, and no headless API for processing files in
  bulk. Stirling and Acrobat are the picks if you need those.
- **English-only UI** (localization infrastructure exists but isn't populated);
  Stirling ships 40+ languages.
- **Single-file ceiling.** Everything runs in one browser tab in memory, so very
  large or image-heavy documents are more constrained than a native desktop app.

---

## Pick by need

- **Air-gapped, zero-trust, or "this file must never leave my laptop"** →
  **pedift**. Nothing else is this provably offline with zero setup.
- **Quick, occasional edit and you don't mind uploading** → **iLovePDF** or
  **Smallpdf** (free tiers, nothing to install).
- **Scanned documents that need OCR** → **PDF24** (free, Windows) or **Adobe
  Acrobat** (paid, any platform).
- **Heavy, glyph-level text editing of existing PDFs** → **Adobe Acrobat**,
  **Sejda**, or **PDFgear**.
- **Free + private + lots of tools, and you're on Windows** → **PDF24 Creator**.
- **Team automation, self-hosted, API/workflow pipelines** → **Stirling PDF** (or
  **Acrobat** for an all-in-one commercial suite).
- **AI-assisted editing for free** → **PDFgear** (accept that the AI uses the
  cloud).

---

## Sources

- Adobe Acrobat — [pricing](https://www.adobe.com/acrobat/pricing.html),
  [Xodo pricing explainer](https://xodo.com/blog/adobe-acrobat-pricing-explained)
- Smallpdf — [pricing](https://smallpdf.com/pricing)
- Smallpdf vs iLovePDF —
  [PDF Techno comparison](https://www.pdftechno.com/blogs/ilovepdf-vs-smallpdf-vs-pdftechno-which-one-makes-the-most-sense),
  [Capterra compare](https://www.capterra.com/compare/172606-173963/Smallpdf-vs-iLovePDF)
- Sejda — [Desktop](https://www.sejda.com/desktop),
  [pricing](https://www.sejda.com/upgrade),
  [Hamsterstack pricing](https://hamsterstack.com/pricing/sejda/)
- PDF24 — [Creator](https://tools.pdf24.org/en/creator),
  [pdf24.org](https://www.pdf24.org/en/)
- PDFgear — [home](https://www.pdfgear.com/),
  [AI editor](https://www.pdfgear.com/ai-pdf-editor/)
- Stirling PDF — [site](https://stirling.com/),
  [GitHub](https://github.com/Stirling-Tools/Stirling-PDF),
  [docs](https://docs.stirlingpdf.com/)

_Last updated: June 2026. Competitor pricing and features are point-in-time and
change frequently; verify via the sources above._
