# EMR Vendor Demo — Step-by-step Guide

> **Audience**: mixed commercial + technical (CTO + commercial buyer in the same call)
> **Time**: 45–60 minutes
> **Setup pattern**: warmed-up demo partner (`HealthOS Demo`), referenced throughout

You are demonstrating to an EMR/HMS vendor — a company that sells clinical software to hospitals and is asking the same question every time: *"How do we get our hospital customers' existing paper records into our system without it taking 18 months and an army of typists?"*

Your demo answers that, then shows what their engineering team has to wire on their side to consume the data going forward.

---

## What you need before the demo starts

### 30 minutes before the call

- [ ] Open four browser tabs in **incognito or a clean profile** so your local Clerk cookies don't leak between roles. The four tabs you'll need:

  1. **Pierflow staff portal** at `/portal` — signed in as `pierflowllc@gmail.com`. You are Pierflow.
  2. **Partner portal** at `/portal` — signed in as the **HealthOS Demo** partner. You are the prospect's engineering team.
  3. **Mobile capture** at `/portal/capture` — phone or browser DevTools in mobile mode. You are a hospital records clerk.
  4. **Postman** with the Pierflow collection imported and `api_key` set to the HealthOS Demo key. You are the EMR's backend.

- [ ] Confirm the warmed-up state in the partner portal:
  - HealthOS Demo is in `SANDBOX` status
  - At least one customer organisation registered + approved (e.g. "Lagoon Memorial Hospital")
  - Their sandbox API key is on the keys page (you should already have copied it to Postman)
  - At least one webhook endpoint visible (use `webhook.site` or `requestbin.com` for a real-time receiver during the demo)

- [ ] Pre-stage **2–3 ScanBatches in the customer org** with completed chart folders so you can show "already digitised records" without waiting for extraction live. Run a couple of fresh ones too so you can demo the live extraction flow.

- [ ] Have the **Pierflow deck** at `/deck` open in a separate tab. You'll bounce there twice — once at the start, once at the end.

- [ ] **Test the call audio + screen share once.** The single most common demo-killer is a network glitch in the first 30 seconds.

### 5 minutes before the call

- [ ] Refresh every tab so nothing has cookies-expired.
- [ ] Open `webhook.site` (or your receiver) — copy the new URL and update the HealthOS Demo webhook endpoint to point at it. This means events fired during the call land in something you can show live.
- [ ] Close every notification app. Slack, Mail, Calendar, all of it.
- [ ] Glass of water. Three deep breaths. You know this product.

---

## The narrative arc

The demo is **four acts**, each one answering a specific buyer question:

| Act | Buyer question | What you show |
|----|----|----|
| 1 | "Who is this company and why are we talking?" | Pierflow deck — vision, problem, two-path story |
| 2 | "What does my customer's hospital actually have to do?" | Mobile capture → photograph a chart → done |
| 3 | "What does my engineering team have to wire?" | Partner portal + Postman: API key, register customer, ingest, webhook, FHIR |
| 4 | "What does my product manager need to know about going live?" | Production access checklist, security questionnaire, support story |

Don't rush act 2 → act 3 — that transition is where most EMR-vendor demos lose the room because the audience flips mentally from "buyer" to "implementer." Slow down and re-anchor.

---

## Act 1 — Position (5 minutes)

**Tab**: Pierflow deck at `/deck`.

This is fast. The point of the deck on a real demo isn't to *teach* — it's to give them a one-paragraph mental model so the rest of the call makes sense.

**Open with the room, not the slides.** Two minutes of "Tell me what you're seeing on the paper-records problem at your customers" before you touch the keyboard. Two reasons:
1. You learn whether they have a real burning project or are just window-shopping. This changes what you emphasise in act 4.
2. You can quote them back to themselves later: "you mentioned earlier that..."

**Then walk three deck slides at speed**:

- **Slide 2 — The problem.** "<5% insurance, 70%+ OOP, 220M+ Nigerians without digital records." 30 seconds. Don't dwell.
- **Slide 4 — The solution diagram.** "One connectivity layer between every player." 30 seconds.
- **Slide 5 — Four capabilities, but flag Records API.** "Today we're going deep on the Records API. The other three matter for your roadmap." 60 seconds.

**Bridge**: *"Let me show you what this actually looks like for one of your hospital customers. We'll start with the hospital side, then move to your engineering team's view."*

---

## Act 2 — The hospital story (10 minutes)

**Tab**: Mobile capture at `/portal/capture`. Use your phone if you can — the visual story is way better. If you're stuck on a laptop, switch Chrome DevTools to mobile mode.

**Frame the moment**: *"Imagine I'm a records clerk at Lagoon Memorial Hospital. I have a stack of 47 paper charts on my desk. Pierflow gave the hospital a tablet or phone. I open the capture app."*

### The walkthrough

1. **Pick the customer org** (already showing "Lagoon Memorial Hospital" — flagship of Pierflow scope work). Say out loud: *"Operators only see hospitals they're authorised for. This is enforced server-side."*

2. **Pick or create a batch.** Say *"A batch groups one sitting's work — e.g. 'Ward A — June'. It's the unit of accountability."*

3. **Start a new chart.** Type a fake patient name in the search ("Adaeze") — the demo data should surface "Adaeze Margaret Nwosu". Click them. *"The operator picked an existing patient. We just told the system 'every page I'm about to photograph belongs to this person.' We don't have to write the patient's name on each page."*

4. **Hold up actual paper.** If you can, hold up a real piece of paper printed with the sample outpatient card. Photograph it. The upload progress bar appears, the queue shows "Uploading → Registering → Uploaded."

5. **Photograph 2 more pages** of "the same chart" — even just printouts of the same image is fine. The page count on the green panel ticks up.

6. **Click Finish chart.** Say *"That tells Pierflow this chart is complete. Behind the scenes, we just kicked off identity resolution and extraction is running on every page."*

**The line that lands every time**: *"Notice how little training this requires. The operator never types a chart number. Never categorises a document. Never makes a clinical judgement. The model does the structuring; the operator just handles paper."*

7. **Refresh after ~15 seconds**. The chart row in "Previous charts" now reads `Resolved · declared by operator` — and shows the patient's name. Click into `/portal/review` to show the extracted record sitting in the queue.

8. **Open one extracted record** in the review queue. Show the side-by-side: original image on the left, extracted fields on the right with confidence colour coding. Say *"This is the human-review surface. Anything below our confidence threshold lands here. A clinical reviewer at Pierflow — not the hospital — corrects it before it ships to your EMR."*

**Bridge to act 3**: *"That's the hospital side of the story. Now let me switch hats — let me show you what your engineering team would do to consume this."*

---

## Act 3 — The engineering story (20–25 minutes)

This is the longest act. Slow down here.

**Tab**: Partner portal at `/portal` as HealthOS Demo.

### 3.1 The partner console (3 min)

Walk the overview page top to bottom:

- **Status banner** (sandbox active or production active)
- **Checklist**: sandbox approval, email, first API call, DPA, security questionnaire. Say *"This is the standard checklist your team works through to get to live access. It's the same shape as Stripe's or Plaid's."*
- **Resources strip** with the Postman download

Click into:

- **`/portal/organizations`** — show the registered customer (Lagoon Memorial). Say *"You register every customer hospital you want to ingest records for. Pierflow reviews and approves. This is what gives you the audit trail for compliance reviews."*
- **`/portal/keys`** — show the active key (with the last 4 only). Say *"Keys are SHA-256 hashed on our side. You issue them, rotate them, revoke them. You see usage timestamps."*
- **`/portal/webhooks`** — show the configured webhook endpoint pointing at your `webhook.site` page. Don't trigger anything yet — that's coming.

### 3.2 First API call — listing organisations (3 min)

**Tab**: Postman.

Open **"1 · Setup → List organizations I can act on"**. Hit Send. Show the response listing Lagoon Memorial.

Say *"This is the entry point. Your key gives you a list of orgs you're authorised for. Everything downstream — patients, packages, ingest — is scoped to one of these orgs."*

### 3.3 Programmatic ingest (5 min)

This is the *important* part for the technical buyer. Walk through what their batch ingest flow looks like.

Open **"2 · Create a scan batch"** and **"3 · Sign a Cloudinary upload"** in sequence, hit Send on each. Show the auto-populated variables in the collection.

Open **"4 · Upload to Cloudinary"** — *don't* run it live (Postman file-upload friction). Instead say:

> *"For a real implementation, your team uploads the image directly to Cloudinary using the signature we just got back. Image bytes never proxy through Pierflow — saves you egress costs and saves us infrastructure cost. Your customers' patient records never touch a Pierflow server, only a Pierflow database. That matters for compliance."*

Open **"5 · Register the ingest job"** — hit Send. Returns 202 with a job_id.

Then **"6 · Poll the job"** — hit Send a couple of times. Show the status moving from QUEUED to PROCESSING to AWAITING_REVIEW or VALIDATED.

**Drop the line they care about**: *"This single flow scales to thousands of records per day. The same partner key, the same endpoint, the same shape, whether you're ingesting 10 or 10,000 in a session."*

### 3.4 The webhook moment (3 min) — this is the wow

Switch to your `webhook.site` tab. Show that during the last few minutes, several events have already landed:

```json
{
  "event": "processing_job.completed",
  "emitted_at": "...",
  "partner_id": "ptn_healthos_demo",
  "data": {
    "job_id": "job_...",
    "organization_id": "org_lagoon",
    "completeness_score": 0.94,
    "avg_confidence": 0.91,
    "validation_status": "AUTO_APPROVED",
    "job_status": "VALIDATED"
  }
}
```

Say *"Each of these landed at your endpoint in real-time. HMAC signed. You verify the signature, then update your job queue or trigger your import worker. No polling."*

### 3.5 Pulling the merged FHIR Bundle (3 min)

Open **"7 · Patients → GET /v1/.../patients"** in Postman. Show the list — pick the patient we created in act 2.

Then **"GET /v1/.../patients/:patientId/fhir"**. Hit Send.

Slow down. Walk the structure:

- `resourceType: "Bundle"` — *"Standard FHIR R4. Same shape your EMR already speaks."*
- `entry[0]` is the Patient resource. Highlight the `identifier` array — point out the MRN under `https://lagoon-memorial.ng/mrn/` (the hospital's own MRN URI).
- `entry[1..N]` are Encounters, Observations (LOINC codes), Conditions (ICD-10), MedicationRequests (ATC codes).

Say *"Your import code is the same for every hospital customer. The hospital's MRN system URI namespaces patient identifiers per customer."*

### 3.6 The killer move — by-external-id FHIR (3 min)

This is the move that makes EMR CTOs say "wait, do that again."

Open **"10 · FHIR by external id → GET /v1/.../patients/by-external/:externalId/fhir"** in Postman.

Set the `external_id` variable to the EMR's internal id for the patient (use `emr_8821` or whatever you wired in setup). Hit Send.

Same FHIR Bundle comes back.

Now scroll to `entry[0].resource.identifier`:

```json
[
  { "system": "https://pierflow.com/patient", "value": "pat_b3f9c21a" },
  { "system": "https://lagoon-memorial.ng/mrn/", "value": "LH-00143-26" },
  { "system": "https://healthos.example.com/patients/",
    "value": "emr_8821", "use": "secondary" }
]
```

Say *"Three identifiers. Pierflow's id. The hospital's MRN. **Your EMR's id.** Once your EMR creates a patient and tells us 'this Pierflow patient is my customer's patient 8821', you can query Pierflow with your id forever. You don't maintain a mapping table on your side. We do."*

This is the moment that wins demos.

### 3.7 The import package + acknowledge (3 min)

Switch to **"8 · Import packages → GET /v1/.../import-packages"** in Postman. Show the list with a READY package.

Open **"GET .../:packageId/download"**. Show the signed Cloudinary URL response. Say *"Your nightly cron downloads the ZIP, ingests it, and acknowledges. The acknowledge call carries patient_id_mappings — same as the by-external flow but bulk."*

Open the acknowledge request and walk the body shape. Don't necessarily send it (you'd unwind the package state in your warmed-up demo). Just show the JSON.

### Bridge to act 4

*"That's the engineering side. Two things left to cover: what it takes to get to production, and what happens if something goes wrong."*

---

## Act 4 — Going live (10 minutes)

**Tab**: Partner portal at `/portal/overview`.

### 4.1 The production access checklist (3 min)

Walk the checklist one more time, slowly. Five items:
1. Sandbox approved (already done for HealthOS Demo)
2. Email verified
3. First sandbox API call (just done in act 3)
4. Sign the DPA
5. Complete the security questionnaire

Click **Sign DPA** (or expand if already signed). Show the click-to-sign UI. Say *"This is recorded with the signer's name, email, IP, user agent, and a hash of the DPA version. Audit-ready."*

Click **Complete the security questionnaire**. Show the form: data residency, retention days, encryption checkboxes, NDA flag, access controls. Say *"You fill this in once. Production approval gates on it."*

Then click **Request production access**. Say *"That fires an internal notification to Pierflow. Approval is typically same day. After that, you can issue `pf_live_sk_*` keys instead of `pf_test_sk_*`."*

### 4.2 What changes between sandbox and live (2 min)

Be concrete. List the differences out loud:
- Same endpoints. Same shapes. Same SDKs.
- Different key prefix (`pf_live_sk_*` vs `pf_test_sk_*`).
- Different rate limits (sandbox is generous; live is set per partner during production approval).
- Live calls hit real customer data — sandbox can be safely destroyed.
- Webhook deliveries go to your production URL.

Say *"Most of our partners run sandbox in their CI environment and production in production. That's how we'd recommend you set up."*

### 4.3 Support story (3 min)

Be honest, brief:
- **Slack channel** with Pierflow engineering once you're production-approved.
- **Sub-24hr response** on production incidents — usually faster.
- **Status page at `/status`**.
- **API changelog at `/docs/changelog`**.
- Same person who runs the demo (you) is who they'll talk to on day 1. Important for early-stage trust.

### 4.4 Commercial framing — what they pay for (2 min)

> *Pricing is a separate conversation. If they ask in the demo, deflect to "let me put a proposal together based on volume and customer count." Don't make up numbers on a demo.*

Say *"There are three commercial parameters: number of customer hospitals, monthly volume of records ingested, and the path — whether Pierflow operates capture or you do. We'll send you a proposal after this call based on what you described earlier."*

---

## Close (3 minutes)

Two questions in order:

1. **"What would you need to see in a paid pilot to feel comfortable going live with us?"** — This is the real question. The answer tells you whether they're a buyer or a tyre-kicker. Listen carefully and write the answer down.

2. **"Who else on your side should see this?"** — If they name a name, that's a strong signal. If they say "just me for now," that's a different signal.

**Then propose the next step**:

- If they're hot: *"Let's get you onboarded into your own sandbox today. I'll send the link in the next hour. You can play with your real customer data structure in a private environment."*
- If they're warm: *"Let's set up a deeper-dive call with your engineering team. I'll send three calendar options."*
- If they're cool: *"Happy to send the link to the partner portal so you can explore at your own pace. What questions are still open for you?"*

---

## What can go wrong, and what to do

| Problem | Fix |
|---|---|
| Cloudinary upload fails live | Skip the live upload, narrate it. *"In production this is direct from your server to Cloudinary's CDN."* Don't apologise — pivot. |
| Extraction takes too long | You staged warmed-up extracted records in step 0. Switch to them. *"While that one extracts, here's another we ran earlier."* |
| `webhook.site` page is empty | Re-check the endpoint URL on `/portal/webhooks`. Worst case, show a screenshot of webhooks you have in your phone. |
| FHIR Bundle looks empty (no records yet for this patient) | Pick one of the pre-warmed patients you staged. |
| You forgot which patient you used in act 2 | List patients in Postman. Pick the one with the most records. |
| Buyer interrupts with "what about security" | **Welcome the question.** Open the security questionnaire on `/portal/overview`. Show the controls *you* require of partners. Then mention: SOC 2 readiness, data residency in NG by default, click-to-sign DPA. |
| Buyer asks pricing | "Let me put a proposal together based on volume and customer count" — and **move on**. Don't get drawn. |
| Buyer asks for a feature you don't have | Note it on the call, say *"That's on our near-term roadmap. Let me confirm timing after the call."* Add to your roadmap tracker. |
| Demo internet dies | Mobile hotspot. Always have one ready. |

---

## What to update in this guide after each demo

Keep a running log at the bottom of this file. The point of versioning the guide is to *improve it from real experience*, not from imagined experience.

After each demo, jot down:

- What question caught you off-guard?
- Which slide / UI surface caused confusion?
- What did the buyer say "show me again"?
- Where in the demo did energy drop?

Edit the guide accordingly and commit.

### Demo log

| Date | Company | Time | Result | Notes |
|---|---|---|---|---|
| | | | | |

---

## Reference appendix

### URLs at a glance

| Surface | URL |
|---|---|
| Marketing site | `https://www.pierflow.com` |
| Investor deck | `https://www.pierflow.com/deck` |
| Get started (signup) | `https://www.pierflow.com/get-started` |
| Partner portal | `https://www.pierflow.com/portal` |
| Mobile capture | `https://www.pierflow.com/portal/capture` |
| Postman collection | `https://www.pierflow.com/api/pierflow.postman_collection.json` |
| Sample image | `https://www.pierflow.com/sample-outpatient-card.svg` |
| API docs | `https://www.pierflow.com/docs/api/endpoints` |
| Patient mapping concept | `https://www.pierflow.com/docs/patient-mapping` |

### Webhook receivers for live demos

- `https://webhook.site` — single-URL listener, no signup
- `https://requestbin.com` — same idea, slightly different UI

### The four-tab pre-flight checklist (printable)

Print this and stick it to your monitor:

```
□ Tab 1: Pierflow staff portal (pierflowllc@gmail.com)
□ Tab 2: Partner portal — HealthOS Demo signed in
□ Tab 3: Mobile capture — phone or DevTools mobile mode
□ Tab 4: Postman with api_key + organization_id set

□ webhook.site URL set on /portal/webhooks
□ 2–3 batches pre-warmed with completed charts
□ Phone hotspot ready
□ Notifications silenced
□ Water + breath
```
