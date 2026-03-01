# AI Modules — How Every AI Works in This Project

> Last updated: 1 March 2026  
> All AI modules use **Ollama** running locally on `http://localhost:11434` with the `llava:latest` model.  
> No external cloud AI API is used. Everything runs on-device/on-server.

---

## Infrastructure: Ollama

**Ollama** is a local LLM runner. This project points every AI call at:

```
POST http://localhost:11434/api/generate
```

**Model used everywhere:** `llava:latest`  
LLaVA (Large Language and Vision Assistant) is a multimodal model capable of processing both text and images.

**Request format (all modules):**
```json
{
  "model": "llava:latest",
  "system": "<system prompt>",
  "prompt": "<user prompt with injected data>",
  "stream": false
}
```

**Environment variable:** `OLLAMA_URL` overrides the default URL.

---

## Module 1 — AiChatModule (`src/ai-chat/`)

### Purpose
A conversational AI assistant for **patients**. Patients ask diabetes/nutrition questions and receive personalized answers grounded in their real data.

### Endpoint
```
POST /api/ai-chat
Auth: JWT (PATIENT or MEDECIN)
Body: { "message": "string (2–1000 chars)" }
```

### How it works (step by step)

```
Patient sends message
        │
        ▼
1. Validate input (2–1000 chars)
        │
        ▼
2. Fetch in parallel:
   ├── Last 20 glucose records  (GlucoseService.findMyRecords)
   └── Last 10 meals            (NutritionService.findAllMeals)
        │
        ▼
3. Compute local statistics (pure TypeScript, no AI yet):
   ├── GlucoseStats: avg, min, max, hypo/hyper count, trend, last value
   └── NutritionStats: avg daily calories/carbs/protein/fat, last meal
        │
        ▼
4. Inject stats into SYSTEM_PROMPT_TEMPLATE
   (4 placeholders: {GLUCOSE_RECORDS}, {GLUCOSE_STATS}, {RECENT_MEALS}, {NUTRITION_STATS})
        │
        ▼
5. POST to Ollama (timeout: 30 s)
        │
        ▼
6. Return { response, context: { glucoseStats, nutritionStats, recordsUsed } }
```

### System prompt rules
- MediBot identity — specialized ONLY in diabetes and nutrition
- Refuses off-topic questions with a fixed message
- Responds in the same language as the patient
- Never invents data — all answers grounded in injected patient records
- Warns to consult a doctor if glucose > 250 or < 60 detected

### Fallback behavior
| Error | Response |
|---|---|
| `ECONNREFUSED` | 503 — Ollama not running |
| `ECONNABORTED` (timeout) | 503 — Ollama too slow |
| Other error | 500 |

No local fallback — the endpoint fails if Ollama is unreachable.

### Collections used
None — stateless (no data persisted for this module).

---

## Module 2 — AiFoodAnalyzerModule (`src/ai-food-analyzer/`)

### Purpose
Analyzes a **food image URL**, identifies the meal, estimates its nutritional values, saves the meal to the database, and generates personalized dietary advice based on the patient's glucose history.

### Endpoint
```
POST /api/ai-food-analyzer
Auth: JWT (PATIENT)
Body: { "imageUrl": "string", "patientId": "string" }
```

### How it works (step by step)

```
Patient sends food image URL
        │
        ▼
1. callImageAnalyzer(imageUrl)
   └── POST Ollama with image URL as base64/URL + text prompt
       "Analyze this food image. Return JSON: { name, calories, carbs, protein, fat, items[] }"
       (LLaVA is multimodal — it sees the image)
        │
        ▼
2. Save meal to DB (NutritionService.createMeal)
   └── source = 'ai', confidence = score from analysis
        │
        ▼
3. Fetch in parallel:
   ├── Last 50 glucose records   (GlucoseService.findMyRecords)
   └── Patient profile           (PatientsService — for diabetes type, HbA1c, etc.)
        │
        ▼
4. generateDetailedAdvice(meal, glucoseRecords, patientContext)
   └── POST Ollama with full context:
       - Meal nutritional breakdown
       - Patient's last 50 glucose values + stats
       - Patient's diabetes type, HbA1c, uses insulin, etc.
       Returns JSON with 10 DetailedAdvice fields:
         summary, immediateRisk, glucoseImpact, recommendedAction,
         mealScore (0–10), carbWarning, insulinNote,
         alternativeSuggestion, positivePoints, nextMealAdvice
        │
        ▼
5. Save AiFoodAnalysis document to collection ai_food_analyses
        │
        ▼
6. Fire-and-forget: AiPredictionService.predictTrend(patientId, mealId)
   (triggers a glucose trend prediction for the next 2–4h)
        │
        ▼
7. Return { meal, image_analysis, ai_advice (= advice.summary), detailedAdvice }
```

### What LLaVA sees
LLaVA is a **vision model** — it receives the image URL and a text instruction. It identifies food items visually and estimates portion sizes and nutritional content.

### Fallback behavior
If Ollama fails during `generateDetailedAdvice`:
- `isFallback = true` stored in DB
- Returns a minimal advice object with the raw Ollama text in `summary`
- The meal is still saved regardless

### Collections used
- `meals` (via NutritionModule) — saved meal
- `ai_food_analyses` — full analysis result + detailed advice

---

## Module 3 — AiPredictionModule (`src/ai-prediction/`)

### Purpose
Predicts the patient's **glucose trend for the next 2–4 hours** based on recent glucose records and optionally a recent meal. Triggered automatically after every food analysis, or manually by the patient.

### Endpoints
```
POST /api/ai-prediction              — Manual prediction (no meal context)
POST /api/ai-prediction/post-meal/:mealId — Post-meal prediction
GET  /api/ai-prediction/history      — Paginated history
GET  /api/ai-prediction/:id          — Single prediction detail
Auth: JWT (PATIENT)
```

### How it works (step by step)

```
Trigger: manual or post-meal (called by AiFoodAnalyzerModule)
        │
        ▼
1. Fetch in parallel:
   ├── Last 30 glucose records   (GlucoseService.findMyRecords)
   ├── Meal document if mealId   (NutritionService.findOneMeal)
   └── AiFoodAnalysis for meal   (if mealId — gets detailed advice)
        │
        ▼
2. buildGlucoseSnapshot(records)
   Computes: avg, min, max, hypo count, hyper count,
   trend (older half vs newer half → improving/stable/worsening)
        │
        ▼
3. Build mealSnapshot (if meal provided):
   { name, calories, carbs, protein, fat, aiScore, period }
        │
        ▼
4. Build Ollama prompt:
   - Glucose history (last 30 values with timestamps)
   - Glucose snapshot stats
   - Meal context (if applicable)
   - Question: "Predict glucose in 2–4 hours. Return JSON."
        │
        ▼
5. POST to Ollama (never throws — fallback on any error)
   Expected JSON response:
   {
     "predictedValue": number,       ← mg/dL in 2–4h
     "confidence": number,           ← 0–100
     "trend": "rising|stable|falling",
     "riskLevel": "low|moderate|high|critical",
     "summary": "string",
     "recommendations": ["string"]
   }
        │
        ▼
6. On failure → fallbackPrediction() (local calculation)
   ├── Uses glucose snapshot trend
   ├── Applies meal carb effect if meal provided
   └── confidence = 40 (always lower for fallback)
        │
        ▼
7. Save AiPrediction to collection ai_predictions
8. Return saved document
```

### Trigger sources
| Source | Description |
|---|---|
| `POST /api/ai-prediction` | Patient requests manually |
| `POST /api/ai-prediction/post-meal/:mealId` | Patient after logging a meal |
| Automatic | Triggered fire-and-forget by `AiFoodAnalyzerService` after every food analysis |

### Fallback behavior
**Never throws** — if Ollama fails for any reason (timeout, error, bad JSON), `fallbackPrediction()` runs locally using pure statistics. `isFallback: true` is stored in the DB.

### Collections used
- `ai_predictions` — each prediction result with snapshots

---

## Module 4 — AiDoctorModule (`src/ai-doctor/`)

### Purpose
A clinical AI assistant exclusively for **doctors**. It analyzes their patients' data and answers medical questions. Can operate on a single patient or all patients simultaneously.

### Endpoints
```
POST /api/ai-doctor/chat/:patientId  — Ask about one specific patient
POST /api/ai-doctor/chat             — Ask about all patients (population view)
GET  /api/ai-doctor/urgent           — Instant urgent-flag scan (no Ollama)
GET  /api/ai-doctor/history          — Chat history (filterable by patient)
Auth: JWT (MEDECIN only)
```

### How it works

#### `POST /api/ai-doctor/chat/:patientId`

```
Doctor asks about one patient
        │
        ▼
1. getDoctorRaw(doctorId)
   └── medecinModel.findById().populate('listePatients', 'nom prenom')
       → Returns { nom, prenom, specialite, listePatients[], patients[] }
        │
        ▼
2. Verify ownership: patientId must be in doctor's listePatients
        │
        ▼
3. Fetch in parallel:
   ├── Last 30 glucose records   (GlucoseService.findMyRecords)
   └── Last 10 meals             (NutritionService.findAllMeals)
        │
        ▼
4. buildPatientSummary(patientId, patientName)
   Computes locally:
   ├── avg/min/max glucose
   ├── HbA1c estimate: (avgGlucose + 46.7) / 28.7
   ├── Time in range (70–180 mg/dL)
   ├── Hypo/hyper counts
   ├── Trend (older half vs newer half)
   ├── Last AI prediction summary
   └── URGENT FLAGS if: avg > 200, HbA1c > 9%, hypos > 5, last > 250
        │
        ▼
5. Inject into SYSTEM_PROMPT_TEMPLATE:
   {DOCTOR_NAME}, {SPECIALTY}, {TOTAL_PATIENTS}, {PATIENT_DATA}
        │
        ▼
6. POST to Ollama (timeout: 240 s)
        │
        ▼
7. Save chat to ai_doctor_chats
8. Return { response, queryType: 'single_patient', patientId, context }
```

#### `POST /api/ai-doctor/chat` (all patients)

Same as above but builds summaries for **all patients** (up to 20) in parallel, then sends the full population context to Ollama.

#### `GET /api/ai-doctor/urgent` (no Ollama)

```
1. Get all doctor patients (getDoctorRaw)
2. buildPatientSummary() for each patient in parallel
3. Filter patients where summary contains "URGENT FLAGS:"
4. Return list with flags, last glucose, avg glucose
   — Instant response, no LLM call
```

### System prompt rules (MediAssist identity)
- ONLY answers diabetes management questions
- NEVER prescribes medications — suggests and alerts only
- Access strictly limited to the doctor's own patients
- Ends all critical alerts with: *"Decision belongs to the treating physician."*
- Responds in the same language as the doctor's question
- Flags patients with glucose > 250, HbA1c > 9%, or > 5 nocturnal hypos

### Fallback behavior
No local fallback — if Ollama is unreachable, throws `503`. The `/urgent` endpoint is the exception: it never calls Ollama and always works.

### Collections used
- `ai_doctor_chats` — full conversation history per doctor (with `contextSnapshot`)

---

## Module 5 — AiPatternModule (`src/ai-pattern/`)

### Purpose
Detects dangerous **30-day glucose patterns** for patients. Identifies 4 specific medical patterns, runs weekly automatically for all patients via a cron job, and can be triggered manually by any patient.

### Endpoints
```
POST /api/ai-pattern         — Manual analysis (patient)
GET  /api/ai-pattern/latest  — Last analysis result
GET  /api/ai-pattern/history — History (filterable: manual/cron, pagination)
GET  /api/ai-pattern/:id     — Single analysis detail
Auth: JWT (POST: PATIENT | GET: PATIENT or MEDECIN)
```

### The 4 patterns detected

| Pattern | What it detects |
|---|---|
| **Nocturnal Hypoglycemia** | Glucose < 70 mg/dL between 22:00–06:00 |
| **Post-Meal Spikes** | Glucose > 180 mg/dL in `after_meal` records |
| **Risk Time Windows** | Hours/days of the week with consistently dangerous glucose |
| **Glycemic Control Degradation** | Worsening trend week-over-week (weeks 1→4) |

### How it works (step by step)

```
Trigger: manual (patient) or cron (every Monday 08:00)
        │
        ▼
1. Fetch last 30 days of data in parallel:
   ├── Up to 500 glucose records  (GlucoseService.findByDateRange)
   └── Up to 200 meals            (NutritionService.findAllMeals)
        │
        ▼
2. Minimum check: < 10 records → BadRequestException
        │
        ▼
3. Pure TypeScript statistics (Step 2 — before any AI call):
   ├── Group records by hour of day → hourlyAverages[]
   ├── Group records by day of week → recordsByDay{}
   ├── Split into 4 weekly buckets → week1/2/3/4 averages
   ├── Nocturnal records (22h–06h) → nocturnalHypos[]
   ├── Post-meal records → postMealSpikes[]
   ├── Global stats: avg, min, max, HbA1c, timeInRange, hypo/hyperCount
   ├── Overall trend: stable / worsening / improving
   └── High-risk hours and days
        │
        ▼
4. Build detailed statistical prompt (no images — text only)
   Sends all computed stats as structured text to Ollama
        │
        ▼
5. POST to Ollama (timeout: 60 s)
   Expected JSON with all 4 pattern objects + overallAssessment:
   {
     nocturnalHypoglycemia: { detected, frequency, avgTimeOfOccurrence,
                              riskLevel, affectedDays, recommendation },
     postMealSpikes:         { detected, frequency, avgSpikeValue,
                              mostAffectedPeriod, avgCarbsOnSpikedMeals,
                              riskLevel, recommendation },
     riskTimeWindows:        { detected, highRiskHours[], highRiskDays[],
                              lowRiskHours[], pattern, recommendation },
     glycemicControlDegradation: { detected, trend, week1-4Avg,
                              hba1cEstimate, timeInRange,
                              riskLevel, recommendation },
     overallAssessment:      { controlLevel, criticalPatternsCount,
                              doctorConsultationNeeded, urgencyLevel,
                              topPriorities[], summary }
   }
        │
        ▼
6. On failure → fallbackPatternAnalysis() — NEVER throws
   Uses only the Step 3 local statistics to fill all 4 patterns.
   isFallback = true stored in DB.
        │
        ▼
7. Save complete AiPattern document to ai_patterns
8. Return saved document
```

### Weekly cron job (CronService)

```
Every Monday at 08:00 (cron: '0 8 * * 1')
        │
        ▼
1. Query all users with role=PATIENT and statutCompte=ACTIF
        │
        ▼
2. For each patient (sequential, NOT parallel):
   └── analyzePatterns(patientId, 'cron')
        │
        ├── Success → log ✅
        └── Error   → log ⚠️ and continue (never stops the loop)
        │
        ▼
3. 3-second delay between each patient
   (prevents Ollama from being overwhelmed)
```

### Fallback behavior
`fallbackPatternAnalysis()` is **mandatory and must never throw**. It uses only the pre-computed TypeScript statistics to populate all pattern fields with locally-derived risk levels and generic recommendations. The document is always saved, marked `isFallback: true`.

### Collections used
- `ai_patterns` — one document per analysis run per patient

---

## Summary Table

| Module | Endpoint(s) | Trigger | Ollama use | Fallback | Persists |
|---|---|---|---|---|---|
| **AiChat** | `POST /ai-chat` | Patient message | Text conversation | ❌ (503 if down) | No |
| **AiFoodAnalyzer** | `POST /ai-food-analyzer` | Patient uploads image | Image + text analysis | ✅ minimal advice | `ai_food_analyses` + `meals` |
| **AiPrediction** | `POST /ai-prediction` | Manual / auto after meal | Text prediction | ✅ local calculation | `ai_predictions` |
| **AiDoctor** | `POST /ai-doctor/chat` | Doctor question | Text analysis | ❌ (503); `/urgent` never calls Ollama | `ai_doctor_chats` |
| **AiPattern** | `POST /ai-pattern` + weekly cron | Manual / every Monday | Text pattern analysis | ✅ full local fallback | `ai_patterns` |

---

## Data Flow Between AI Modules

```
Patient uploads food photo
        │
        ▼
AiFoodAnalyzerModule
  └── Calls Ollama (image analysis)
  └── Saves meal
  └── Calls Ollama (personalized advice)
  └── Fire-and-forgets ──────────────────▶ AiPredictionModule
                                              └── Calls Ollama (2–4h trend)
                                              └── Saves prediction

AiDoctorModule
  └── Reads ai_predictions (last prediction per patient)
  └── Calls Ollama (clinical analysis)

AiPatternModule (independent)
  └── Does NOT read from other AI collections
  └── Works only from raw glucose + meal records
```

---

## Adding a New AI Module — Conventions

1. **Model**: always `llava:latest` via `OLLAMA_URL`
2. **Timeout**: use ≥ 60 s for complex prompts, 240 s for multi-patient contexts
3. **Fallback**: every AI method that persists data **must** implement a local fallback that never throws
4. **Schema**: create a dedicated collection (e.g. `ai_xxx`) — never mix with non-AI collections
5. **No circular imports**: AI modules may import `GlucoseModule` / `NutritionModule` but never each other in a cycle
6. **Guards**: all AI endpoints require `JwtAuthGuard + RolesGuard` with explicit `@Roles()`
7. **Logger**: use NestJS `Logger` — never `console.log`
