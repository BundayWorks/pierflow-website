# Insurance Distribution — Plain-English Plan

This is the one-page version of how Pierflow will let fintechs sell HMO plans
to their users, with the EMR vendor as the bridge to the HMOs.

If you're reading this and you don't write code, you're the audience. Nothing
in here uses jargon without explaining it first.

---

## The picture

Three groups of people who need to talk to each other:

- **HMOs** — Reliance, Avon, Hygeia, etc. They sell the health plans.
- **EMR vendor** — runs the software each HMO uses on their own servers to
  manage their members. He's deployed at multiple HMOs separately.
- **Fintechs** — banks, savings apps, payroll apps. They have users; they
  don't currently sell health insurance.

Pierflow sits in the middle. The fintech connects to Pierflow once. Pierflow
handles every HMO behind the scenes. The HMO stays the source of truth for
its own data. The EMR vendor is how Pierflow reaches the HMO.

---

## The freshness problem (and how we solve it)

The EMR vendor's software is installed separately on each HMO's own servers.
Data changes constantly — prices, hospital networks, plan availability. If
Pierflow shows a fintech user stale data, the user pays the wrong amount or
shows up at a hospital that no longer takes the plan.

**Our approach: cache the boring stuff, verify the dangerous stuff.**

| What | How we handle it | Why |
|---|---|---|
| Plan name, description, benefits, hospital list | Cached in Pierflow, refreshed regularly | Doesn't change minute to minute. Fast for fintechs to browse. |
| Price for a specific user right now | Live call to the HMO at quote time | Prices can change. Don't quote stale money. |
| Is this hospital still in-network right now? | Live at enrollment | Cost of getting this wrong is huge. |
| Is this person eligible? | Live every time | Same reason. |
| Enrollment itself | Live by definition | Can't cache an action. |

Three things make this work:

1. **Every cached plan carries a "last confirmed at" timestamp** — fintechs
   can see how fresh the data is.
2. **A verify step before any binding action** — Pierflow calls the HMO
   right before locking a quote or enrolling, asks "is this still true?"
   and trusts the answer.
3. **A "something changed" notification from the EMR vendor's software to
   Pierflow** — the moment a plan is created, updated, or withdrawn, his
   software pings us. We update our cache immediately. This is the part
   that depends on his cooperation.

---

## What we need from the EMR vendor

Three things he needs to add to his software, once. After that, every HMO he
serves gets Pierflow connectivity for free.

1. **Push a plan catalogue to Pierflow on a schedule** (e.g. daily).
2. **Send a "something changed" notification** whenever a plan is created,
   updated, or withdrawn — so our cache stays fresh between scheduled pushes.
3. **Respond to live verify / enroll calls from Pierflow** — when a fintech
   user actually buys, we call him back to confirm the plan is still valid
   and to enroll the member.

If he refuses item 2, we fall back to more frequent scheduled pushes (every
few hours instead of daily). It works, but loads his servers harder.

He does **not** need to know anything about how the money moves. Payment and
settlement are between Pierflow and the fintech. He just gets a "this person
is now your member" instruction and his commission share, the same way every
month.

---

## What we need from each HMO at onboarding

When Pierflow takes on a new HMO (whether through the EMR vendor or directly):

- **Settlement preference per fintech channel.** Either:
  - The HMO opens an account inside each fintech where their members will be
    enrolled (cleanest — money moves entirely inside the fintech's books), or
  - The HMO gives Pierflow a bank account number + bank, and the fintech
    sweeps to that account on a schedule (daily / weekly).
- **A signed commercial contract** — the configurable split structure
  described under "Commercial terms — configurable per HMO contract" below.
  Captured into the platform as a versioned contract record, not
  hard-coded.
- **The plan catalogue itself** — handled through the EMR vendor channel, but
  the HMO has to authorise their plans being distributed.

---

## The build, in four chapters

Each chapter is shippable on its own. We could stop after any one of them
and still have something to show.

### Chapter 1 — Stock the warehouse

Build the part that receives the EMR vendor's plan catalogue and stores it
in Pierflow's standard format. Add the AI helper that translates his
HMO-specific data into our standard format (saves days of manual mapping
per HMO).

**End of chapter:** every plan from every HMO he serves is visible on
Pierflow's internal dashboard.

### Chapter 2 — Let fintechs browse and match

Build the part fintechs use to ask "what plans fit this user?" with
personalised ranking. The user's profile (age, budget, location, dependents,
conditions they care about) goes in; the top 3-5 plans come out, with
reasons attached.

**End of chapter:** a fintech can integrate Pierflow in a day and show their
users a personalised list of HMO plans.

### Chapter 3 — Let users actually buy and enroll

Build identity verification (NIN / BVN), live verification with the HMO
right before enrollment, and the enrollment itself.

The fintech handles the user's money. Pierflow tells the fintech what to
debit and where to settle; the fintech executes inside their own ledger.
See "How the money moves" below.

**End of chapter:** real people are real members of real HMOs because they
clicked Buy in a fintech app, and the first premium has been settled across
all four parties.

### Chapter 4 — Make the money side bulletproof

Build Pierflow's own ledger (so we have an independent record of every
naira to reconcile against the fintech's report), the daily reconciliation
job, the claims tracking, and the hospital network lookup.

**End of chapter:** Pierflow is a real financial business that an accountant
or a regulator can audit.

---

## How the money moves

The fintech already owns the user's money — the user has a wallet or account
inside the fintech's app. So **the fintech runs the collection**. Pierflow's
job is to instruct the splits and keep an independent record for reconciliation.

For every premium collected (first one at enrollment, then monthly), book
entries happen inside the fintech's ledger. The exact entries — who receives
and how much — come from the **HMO contract** (see below). A typical
arrangement looks like this:

| Movement | Direction | Typical recipient |
|---|---|---|
| User wallet | Debit | (the user pays) |
| HMO account | Credit | The HMO — either an account they hold at the fintech, or swept to their external bank on a schedule |
| Pierflow settlement account | Credit | Our platform fee |
| EMR vendor account | Credit | His connector commission |
| Fintech commission account | Credit | The fintech's distribution share |

This is the typical case. The actual list is whatever the HMO contract says —
some contracts add a broker, some skip the EMR vendor, some include a
regulator levy. Engine reads the contract, executes the splits.

A few consequences worth being explicit about:

- **No card processor in the loop for fintech channels.** No Paystack, no
  Flutterwave. The user already trusted the fintech with their money; that
  trust is the entire payment rail.
- **Pierflow is the settlement instructor, not the collector.** Each due
  date, Pierflow tells the fintech: "for these N active policies, debit
  these wallets, and split as follows." The fintech executes.
- **If a user's wallet is empty,** that's the fintech's problem first —
  they already have wallet-low-balance flows. They tell us "collection
  failed"; we trigger our grace-period / lapse logic on the policy.
- **Pierflow keeps an independent ledger of what we *instructed*** so we
  can reconcile against what the fintech reports they *executed*. Daily.

---

## Commercial terms — configurable per HMO contract

Every HMO negotiation is different. Hard-coding splits in software is a
mistake — every renegotiation would need engineering. Instead, the commercial
terms live in our database as a **contract**, and the split engine reads them
at the moment of any payment.

### What a contract specifies

Every HMO contract has four configurable axes:

1. **Who shares in the money.** A list of parties. Each party has a role tag
   (HMO, Pierflow, EMR vendor, fintech, broker, regulator-levy, referrer,
   etc.) and a settlement destination (account to credit). The list is
   variable in length — most contracts have 4 parties, some have more.

2. **What each one earns.** Either a **flat amount** (e.g. ₦300) or a
   **percentage** (e.g. 8% of the premium). Different parties on the same
   contract can mix — one flat, another percentage.

3. **When they earn it.** Three options per party:
   - **Enrollment-only** — earned once when the user signs up.
   - **Renewal-only** — earned every billing cycle on collected premium.
   - **Both** — earned on signup *and* every renewal. Most common.

4. **Caps and floors per party.** Optional bounds:
   - A **minimum** — e.g. "at least ₦100 per month no matter what."
   - A **maximum** — e.g. "no more than ₦1,000 per month, even if 8% would
     exceed that."

### Example contract — Reliance

> **HMO:** Reliance
> **Effective:** 2026-06-01
> **Version:** v1
>
> **Enrollment fee** (taken once at signup):
> - Pierflow: ₦200 flat — enrollment-only
> - EMR vendor: ₦300 flat — enrollment-only
> - Fintech: ₦500 flat — enrollment-only
> - HMO: remainder
>
> **Premium splits** (every billing cycle):
> - HMO: 82%
> - Pierflow: 6% (min ₦100, max ₦1,000 per cycle)
> - EMR vendor: 3%
> - Fintech: 9%
>
> _Sum across recurring lines = 100% ✓_

For a ₦9,000 monthly premium under this contract:
- HMO receives ₦7,380
- Pierflow receives ₦540 (within the ₦100–₦1,000 cap, so 6% applies)
- EMR vendor receives ₦270
- Fintech receives ₦810

For a hypothetical ₦25,000 monthly premium under the same contract:
- 6% would be ₦1,500, but Pierflow's cap is ₦1,000 — so Pierflow takes ₦1,000
- The ₦500 shortfall is added back to the HMO's share (or to whichever party
  the contract designates as the "remainder bearer")

### Versioning

Contracts are **versioned with an effective-from date**. If we renegotiate
the Reliance contract in 2027, that becomes v2. A user who enrolled under v1
keeps paying under v1 terms — their splits don't silently change.

A new contract version can only apply to policies enrolled *after* its
effective date. This is standard insurance practice and avoids retroactive
surprises for everyone.

### Two events that trigger split calculation

| Event | When | What happens |
|---|---|---|
| Enrollment | User clicks Buy in fintech app | Engine reads contract version active on enrollment date. Computes splits for enrollment fee (if any) + first premium. Sends settlement instruction to fintech. Records expected entries in Pierflow's ledger. |
| Premium collection | Each billing cycle | Engine reads the contract version this policy is locked to. Computes splits for the recurring premium. Sends settlement instruction. Records expected entries. |

### Validation rule

The system refuses to save a contract whose percentage shares don't add up to
100%. Same check applies to flat-amount enrollment fees when the user-facing
enrollment fee is itself a fixed amount. The engine should never silently
distribute less than was collected.

### Why this matters

- **Every HMO negotiation lands directly in the platform** with no
  engineering. Sales signs a contract Friday; it's live Monday.
- **Future products fit the same engine** — when Pierflow distributes
  telemedicine subscriptions or diagnostics packages, the contract shape is
  identical; only the product changes.
- **The contract becomes the audit artifact.** Every settlement points back
  to a versioned contract row. Disputes have a single source of truth.

### What about non-fintech channels?

Pierflow may eventually distribute through channels that don't own the user's
money — a direct consumer app, an HR platform without wallet infrastructure,
a marketplace. Those will need a card processor (Paystack or Flutterwave) on
the collection side. **Out of scope for MVP.** When we get there, we slot
Paystack in as a payment adapter; the rest of the platform doesn't change.

---

## What success looks like

| Milestone | When we know we hit it |
|---|---|
| End of Chapter 1 | We can show the EMR vendor a dashboard with every plan from his HMOs, normalised to Pierflow's format. |
| End of Chapter 2 | A pilot fintech can call our API with a user profile and get back ranked plans with rationale. |
| End of Chapter 3 | One real user, in one real fintech app, is enrolled in one real HMO plan and paying monthly. |
| End of Chapter 4 | Every naira collected over a month reconciles cleanly across the HMO, fintech, and Pierflow ledgers. |

---

## What this depends on

External, not under our control:

- EMR vendor's willingness to build the three integration points above.
- HMO's willingness to be listed on the platform (the EMR vendor likely
  has these relationships; we may need to co-sign), plus their settlement
  preference (in-fintech account or external bank sweep).
- Fintech's willingness to execute splits inside their own ledger on
  Pierflow's instruction, and to report back on what they collected.
- NIMC access for production NIN / BVN verification (stub in sandbox).
- Paystack / Flutterwave only relevant for non-fintech distribution
  channels later — not on the MVP critical path.

Internal:

- Production Vercel environment variables (already-known list).
- Credential rotation before launch (already-known list).
