# AI Services Architecture: Detailed Technical Report

**Project**: NestJS Diabetes Management AI System  
**Date**: March 27, 2026  
**Scope**: 5 Core AI Services + Fallback Mechanisms

---

## Table of Contents

1. [System Overview](#system-overview)
2. [AI Engines & Models](#ai-engines--models)
3. [Service Architecture](#service-architecture)
4. [Data Flow & Processing](#data-flow--processing)
5. [Model Selection Strategy](#model-selection-strategy)
6. [Error Handling & Fallbacks](#error-handling--fallbacks)
7. [Integration Between Services](#integration-between-services)
8. [Performance & Optimization](#performance--optimization)

---

## System Overview

### Core Components

The system consists of **5 specialized AI services** that analyze diabetic patient data and provide clinical decision support:

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI SERVICES ECOSYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. AI-Prediction     → Glucose trend forecasting (2-4 hours)  │
│  2. AI-Food-Analyzer  → Meal image analysis + glycemic impact  │
│  3. AI-Pattern        → 30-day pattern detection & risks       │
│  4. AI-Doctor         → Clinical decision support for doctors  │
│  5. AI-Chat           → Patient-facing conversational AI       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture Pattern: Dual-Engine Strategy

All services implement a **tiered fallback architecture**:

```
┌──────────────────┐
│  Primary Engine  │  ← Gemini (when API key available)
│  (Gemini API)    │     - More accurate for reasoning tasks
└────────┬─────────┘     - Better JSON response handling
         │                - Error detection & recovery
         ↓
┌──────────────────┐
│ Secondary Engine │  ← Ollama with Model Queue
│  (Ollama Local)  │     - llava:latest (vision + chat)
└────────┬─────────┘     - llava:13b (fallback vision)
         │                - llama3.1/3.2 (text models)
         ↓
┌──────────────────┐
│  Fallback Logic  │  ← Local computation/static data
│  (Local only)    │     - Hardcoded formulas
└──────────────────┘     - Template responses
```

---

## AI Engines & Models

### 1. Google Gemini API

**Configuration:**
- **Models**: `gemini-1.5-pro`, `gemini-2.0-flash`
- **Response Format**: Enforced JSON via `responseMimeType: 'application/json'`
- **Authentication**: Requires `GEMINI_API_KEY` in environment
- **Timeout**: No explicit client-side timeout (relies on API timeout)

**Strengths:**
- Excellent at reasoning tasks and structured output
- Reliable JSON parsing and field extraction
- Better handling of edge cases and malformed data
- Supports system instructions for consistent formatting

**Limitations:**
- Requires external API key and internet connectivity
- Rate limiting considerations for high-volume deployments
- Cost per request

**Usage in Services:**
- **ai-prediction**: Primary engine for glucose trend forecasting
- **ai-food-analyzer**: Generates detailed nutritional reports from food data
- Used as fallback when Ollama fails

### 2. Ollama (Local LLM Server)

**Configuration:**
```
URL: http://localhost:11434/api/generate (configurable via OLLAMA_URL env)
Timeout: 240 seconds (240_000 ms)
Stream: Disabled (stream: false)
Connection: Local only
```

**Available Models (Ordered by Priority):**

| Service | Model 1 | Model 2 | Model 3 | Model 4-5 |
|---------|---------|---------|---------|-----------|
| ai-prediction | llava:latest | llava:13b | llama3.1:8b | llama3.2:3b, mistral:7b |
| ai-pattern | llava:latest | llava:13b | llava | llama3.1/3.2, mistral:7b, qwen2.5:7b |
| ai-doctor | llava:latest | llava:13b | llava | llama3.1/3.2 |
| ai-chat | llava:latest | llava:13b | llama3.1:8b | llama3.2:3b, mistral:7b |
| ai-food-analyzer | llava:13b | llava:latest | bakllava | (vision only) |

**Model Characteristics:**

- **llava:latest** (Recommended primary)
  - Multi-modal (image + text)
  - Best for vision tasks (food image analysis)
  - Good for general conversations
  
- **llava:13b** (Fallback vision)
  - Stable, well-tested vision model
  - Suitable for image analysis when latest unavailable
  
- **llama3.1/3.2** (Text reasoning)
  - Pure text models
  - Better for pattern analysis without images
  
- **mistral:7b, qwen2.5:7b** (Alternative text)
  - Fast text processing
  - Good for backup when llama unavailable

### 3. Response Format Requirements

**Gemini Responses:**
```json
{
  "trend": "increase|decrease|stable",
  "confidence": 85,
  "estimatedValue2h": 140,
  ...
  "recommendations": ["action 1", "action 2", "action 3"]
}
```
- **Enforced by**: `responseMimeType: 'application/json'`
- **Validation**: Strict type checking before storing

**Ollama Responses:**
```json
Raw response wrapped in: { "response": "<raw_ollama_output>" }
```
- **Processing**: JSON parsing with markdown stripping
- **Cleaning**: Comment removal, trailing comma fixes
- **Repair**: Field name normalization for schema mismatches

---

## Service Architecture

### 1. AI-Prediction Service

**Purpose**: Forecast glucose levels 2-4 hours ahead based on history and meal context

**Input Data:**
- Patient glucose history (last 30 records)
- Current glucose statistics (average, trend, hypo/hyper counts)
- Optional meal context (carbs, calories, glycemic index)

**Processing Pipeline:**

```
Step 1: Data Gathering (Parallel)
├─ Fetch glucose records (30 max)
├─ Fetch meal details (if mealId provided)
└─ Fetch AI food analysis (if meal provided)
          ↓
Step 2: Build Context Objects
├─ glucoseSnapshot: {average, lastValue, trend, hypoglycemiaCount, ...}
├─ mealSnapshot: {carbs, calories, glycemicIndex, ...}
└─ userPrompt: Combined analysis request
          ↓
Step 3: Template Placeholder Detection
├─ Check if Ollama echoed prompt templates back
├─ Detect keywords: "action 1/2/3", "alert if critical"
└─ Reject low-confidence responses
          ↓
Step 4: Try Gemini (if API key available)
├─ Iterate through model candidates
├─ Parse JSON response with validation
├─ Detect template placeholders
└─ Return on success → EARLY EXIT
          ↓
Step 5: Fallback to Ollama
├─ Iterate through model chain
├─ Handle 404 model-not-found gracefully
├─ Parse and validate JSON output
└─ Return on success → EARLY EXIT
          ↓
Step 6: Fallback to Local Computation
├─ Calculate based on recent trend
├─ Estimate blood sugar rise/fall
└─ Return hardcoded low-confidence result
          ↓
Step 7: Store & Return
└─ Save prediction to MongoDB
   Include: glucoseSnapshot, mealSnapshot, prediction, isFallback flag
```

**Output Schema:**
```typescript
{
  trend: 'increase' | 'decrease' | 'stable',
  confidence: number (0-100),
  estimatedValue2h: number (mg/dL),
  estimatedValue4h: number (mg/dL),
  riskLevel: 'low' | 'moderate' | 'high' | 'critical',
  riskType: 'hypoglycemia_risk' | 'hyperglycemia_risk' | 'none',
  alerts: string[],
  recommendations: string[],
  timeToAction: 'immediate' | 'within_1h' | 'monitor',
  explanation: string,
  summary: string
}
```

**Critical Features:**
- **Template Placeholder Detection**: Prevents bad Ollama outputs from being stored
- **Model Iteration**: Tries each model until one succeeds
- **Safe Number Coercion**: `toNum()` helper prevents NaN propagation
- **Context-Aware**: Meal data significantly changes prediction

**Example Flow:**
```
Patient with 150 mg/dL + trending down + just ate 45g carbs
→ Gemini: "stable trend, slight rise in 2h to 165, moderate risk if carbs high"
  (if Gemini available)
→ OR Ollama/llava: Similar analysis
→ OR Local fallback: "Last 3 readings: 160→155→150. Estimate stable 150-155"
```

---

### 2. AI-Food-Analyzer Service

**Purpose**: Analyze meal images and generate nutritional reports with diabetic risk assessment

**Two-Phase Processing:**

#### Phase 1: Vision Detection (Ollama)
```
Input: Meal image file
        ↓
Call Ollama Vision Model (llava:13b primary)
        ↓
Output: Detected items with estimated quantities
{
  "detected_items": [
    {
      "name": "rice",
      "estimated_quantity": "150g",
      "preparation": "boiled",
      "confidence": "high"
    },
    ...
  ],
  "meal_context": "lunch|dinner|snack|breakfast",
  "image_quality": "good|acceptable|poor"
}
```

#### Phase 2: Nutritional Report (Gemini)
```
Input: Detected items + Patient context
        ↓
Call Gemini for detailed nutritional analysis
        ↓
Process Response: Normalize field names + validate completeness
        ↓
Output: Detailed report with glycemic impact
{
  "meal_name": "string",
  "meal_summary": {
    "total_calories_kcal": number,
    "total_carbs_g": number,
    "total_protein_g": number,
    "total_fat_g": number,
    "glycemic_index": number,
    "glycemic_load": number
  },
  "foods_detail": [...],
  "diabetic_assessment": {
    "overall_risk": "low|moderate|high",
    "blood_sugar_impact": string,
    "expected_glucose_rise": string,
    "insulin_consideration": string
  }
}
```

**Schema Normalization (Critical Innovation):**

Gemini can return different field names depending on model version. The service normalizes:

| Alternative Field Names | Normalized To |
|-------------------------|---------------|
| `patient_insights` | `diabetic_assessment` |
| `meal_glycemic_index` | `glycemic_index` |
| `estimated_quantity` | `quantity` |
| `carbs_g`, `carbs` | `total_carbs_g` |

**Response Validation:**
```
Before storing, checks:
✓ All required text fields present (not empty strings)
✓ Nutritional values are positive numbers
✓ Recommendations list not empty
✓ Risk assessment is one of: low|moderate|high
✓ Meal context properly categorized

If any check fails: Reject and retry with different model
```

**Integration with AI-Prediction:**
- When prediction called with `mealId`, it fetches this analysis
- Uses `glycemicIndex` and `expectedGlucoseRise` in prediction prompt
- Improves prediction accuracy with food-specific data

**Example Complete Flow:**
```
User uploads meal image
  ↓
Ollama vision: "Detected: White rice (150g, boiled), grilled chicken (100g), salad"
  ↓
Gemini analysis: "465 kcal, 72g carbs, 25g protein, GI=68"
  ↓
Risk assessment: "Moderate risk - high carbs, monitor glucose in 2h"
  ↓
AI-Prediction uses this: "With 72g carbs, expect +45mg/dL rise"
```

---

### 3. AI-Pattern Service

**Purpose**: Analyze 30-day glucose patterns to identify dangerous trends

**Data Collection:**
```
Fetch from last 30 days:
├─ Glucose records (up to 500)
└─ Meal records (up to 200)
        ↓
Classification into 4 Risk Categories:
        ↓
1. NOCTURNAL HYPOGLYCEMIA
   ├─ Records between 22:00 and 06:00
   ├─ Values < 70 mg/dL
   ├─ Frequency triggers risk level: 5+ = HIGH, 2-4 = MODERATE, 0-1 = LOW
   └─ Average time of occurrence calculated

2. POST-MEAL SPIKES
   ├─ Glucose rise > 30 mg/dL within 90 mins of meal
   ├─ Most affected meal times identified
   ├─ Avg spike value determines risk: >220 = HIGH, >190 = MODERATE
   └─ Correlated with carbohydrate intake

3. RISK TIME WINDOWS
   ├─ Hours when hypo/hyper most common
   ├─ Days with consistent high/low patterns
   └─ Recommendations tied to specific times

4. GLYCEMIC CONTROL DEGRADATION
   ├─ Trend: improving | stable | worsening | critical
   ├─ Weekly averages tracked (4 weeks)
   ├─ HbA1c degradation: >8% = HIGH, >7% = MODERATE
   └─ Time-in-range deterioration detected

        ↓
Send Statistics to Ollama for Deep Analysis
{
  "nocturnalHypos": 7,
  "postMealSpikes": 12,
  "avgSpikeValue": 215,
  "overallTrend": "worsening",
  "hba1cEstimate": 8.2,
  "timeInRange": 52,
  ...
}
        ↓
Ollama Response: Comprehensive pattern report
{
  "nocturnalHypoglycemia": {
    "detected": true,
    "frequency": 7,
    "riskLevel": "high",
    "recommendation": "Consult doctor - adjust bedtime insulin"
  },
  "postMealSpikes": { ... },
  "riskTimeWindows": { ... },
  "glycemicControlDegradation": { ... },
  "overallAssessment": {
    "controlLevel": "poor",
    "urgencyLevel": "urgent",
    "doctorConsultationNeeded": true,
    "topPriorities": [...]
  }
}
```

**Model Fallback Strategy:**
```
Try llava:latest → llava:13b → llava → llama3.1/3.2
└─ On 404 error, continue to next model
└─ On other error, throw (Ollama unreachable)

If all Ollama fails:
└─ Use fallbackPatternAnalysis()
   └─ All risk levels set to LOW
   └─ Generic recommendations provided
   └─ isFallback: true flag set
```

**JSON Parsing Robustness:**
```
Input: Raw Ollama output (may include comments, markdown, extra text)
        ↓
1. Strip markdown: ```json ``` → ""
2. Remove comments: // and /* */ style
3. Extract JSON object: Find { ... }
4. Fix trailing commas: , } → }
5. Fix bare numbers with units: "value": 205 mg/dL → "value": 205
6. Parse and validate
        ↓
Output: Clean, validated JSON object
```

**Example Output:**
```json
{
  "nocturnalHypoglycemia": {
    "detected": true,
    "frequency": 7,
    "avgTimeOfOccurrence": "02:45 AM",
    "riskLevel": "high",
    "affectedDays": ["Monday", "Wednesday", "Friday"],
    "recommendation": "Your nocturnal glucose is critically low. Consult your doctor about bedtime insulin adjustment."
  },
  "postMealSpikes": {
    "detected": true,
    "frequency": 12,
    "avgSpikeValue": 215,
    "mostAffectedPeriod": "after_dinner",
    "riskLevel": "high",
    "recommendation": "Significantly reduce carbohydrate intake and contact your diabetes team."
  },
  "overallAssessment": {
    "controlLevel": "poor",
    "criticalPatternsCount": 3,
    "doctorConsultationNeeded": true,
    "urgencyLevel": "urgent",
    "topPriorities": [
      "Address nocturnal hypoglycemia immediately",
      "Reduce post-meal carbohydrate intake",
      "Review insulin dosing with your doctor"
    ],
    "summary": "Your 30-day glucose control is poor (52% time in range, HbA1c ~8.2%) with significant nocturnal risk and post-meal spikes. Urgent doctor consultation recommended."
  }
}
```

---

### 4. AI-Doctor Service

**Purpose**: Clinical decision support for diabetologist doctors reviewing patient cohorts

**Architecture:**
```
Doctor authenticates
        ↓
Load doctor's patient list
        ↓
For each patient, aggregate:
├─ Last 30 glucose records + statistics
├─ Last 10 meals
└─ Recent predictions + alerts
        ↓
Build Patient Context: JSON array of up to 20 patients
        ↓
Create System Prompt with injected doctor + patient data
        ↓
Doctor submits question: "Analyze patient cohort for nocturnal risks"
        ↓
Call Ollama with llava:latest/13b
```

**System Prompt Template:**
```markdown
You are MediAssist, AI clinical decision support for diabetologists.

RULES:
- ONLY answer questions about diabetes management
- NEVER prescribe medications (suggest only)
- ONLY access doctor's own patients
- End critical alerts with "Decision belongs to treating physician"
- Flag: glucose > 250, HbA1c > 9%, nocturnal hypos > 5
- Respond in doctor's language

--- DOCTOR CONTEXT ---
Doctor: {NAME}
Specialty: {SPECIALTY}
Total Patients: {COUNT}
--- PATIENT DATA ---
[
  {
    "patientId": "xxx",
    "name": "Patient Name",
    "age": 45,
    "glucoseStats": { average: 155, lastValue: 142, trend: "decreasing" },
    "predictions": { recent: [...], alerts: [...] }
  },
  ...
]
--- END ---
```

**Access Control:**
- Doctor can ONLY analyze their own patients
- Validate `patientId` against `doctor.listePatients`
- Throw `ForbiddenException` if access denied

**Response Categories:**
```
1. Cohort Analysis
   "Analyze 20 patients for common patterns"
   → Groups patients, identifies trends, flags high-risk groups

2. Individual Patient Deep Dive
   "How should I adjust insulin for patient X?"
   → Analyzes that patient's data, suggests adjustments

3. Clinical Protocol Questions
   "What's the standard for managing nocturnal hypos?"
   → General medical knowledge + patient-specific insights

4. Risk Stratification
   "Which patients need urgent intervention?"
   → Ranks patients by clinical urgency
```

**Model Fallback:**
```
Try llava:latest (best for complex reasoning)
  ↓ 404 or other model error
Try llava:13b (proven fallback)
  ↓ repeated failures
Try llama3.1/3.2 (pure text fallback)
  ↓ all fail
Throw HttpException("Ollama service unavailable")
```

---

### 5. AI-Chat Service

**Purpose**: Patient-facing conversational diabetes assistant

**Architecture:**
```
Patient sends message: "What should I eat for dinner?"
        ↓
Validate message length (2-1000 chars)
        ↓
Fetch in parallel:
├─ Last 20 glucose records + calculate stats
└─ Last 10 meals + calculate nutrition stats
        ↓
Build Patient Context
{
  "recentGlucose": "150→155→142 mg/dL",
  "avgGlucose": "147 mg/dL",
  "hypCount": 2,
  "hyperCount": 1,
  "trend": "decreasing",
  "lastMeal": "lunch - 45g carbs",
  "avgDailyCalories": 2100
}
        ↓
Inject into system prompt
        ↓
Try Ollama model chain:
llava:latest → llava:13b → llama3.1:8b → llama3.2:3b → mistral:7b
        ↓
Return response to patient
```

**System Prompt (Personalized):**
```markdown
Tu es MediBot, assistant médical chaleureux pour patients diabétiques.

Ton rôle:
- Répondre à TOUTES les questions sur le diabète, glycémie, insuline, nutrition
- Utiliser données réelles du patient pour personnaliser réponses
- Répondre dans la MÊME langue de la question
- Être encourageant et pratique
- Recommander médecin si glucose > 250 ou < 60 mg/dL

REFUSED: Non-health questions → "Je suis spécialisé dans le diabète"

--- DONNÉES DU PATIENT ---
GLYCÉMIE RÉCENTE: 150 → 155 → 142 mg/dL
STATS: Moyenne 147, Min 112, Max 189, Hypos: 2, Hypers: 1
REPAS: dernier: "riz + poulet", 45g carbs, 400kcal
NUTRITION: Moy 2100kcal/jour, 245g carbs, 85g protéine
--- FIN ---
```

**Language Detection:**
- Responds in same language as question (fr, ar, en, es, etc.)
- System prompt adjusts: French template shown above, but multilingual capable

**Example Interaction:**
```
Patient: "Je viens de manger, ma glycémie est à 155. Que dois-je faire?"
         [I just ate, my glucose is 155. What should I do?]

Context: Last meals averaged 45g carbs, recent trend is decreasing
        
MediBot: "Votre glycémie de 155 est correcte pour après le repas. 
         Vous avez une tendance décroissante positive. Restez hydraté 
         et surveillez votre glycémie dans 2 heures. Si elle remonte 
         au-delà de 200, contactez votre médecin."
         
         [Your glucose of 155 is fine after meal. Positive decreasing 
         trend. Stay hydrated, check in 2h. If goes over 200, contact doctor.]
```

**Error Handling:**
```
Message validation fails
  → BadRequestException

Glucose fetch fails
  → Continues with empty/default stats

Ollama unreachable (all models)
  → HttpException: "Service temporarily unavailable"

Model returns empty response
  → HttpException: "Could not generate response"
```

---

## Data Flow & Processing

### Complete User Journey: Post-Meal Prediction

```
1. USER: Uploads meal image + meal logged in nutrition app
                ↓
2. FOOD-ANALYZER SERVICE:
   ├─ Receives: image + mealId + patientId
   ├─ Step 1: Ollama vision detects items
   ├─ Step 2: Gemini generates nutritional report
   ├─ Step 3: Validates report completeness
   └─ Step 4: Stores analysis in DB
                ↓
3. PREDICTION SERVICE (auto-triggered on meal creation):
   ├─ Receives: mealId + patientId
   ├─ Fetches: 30 glucose records + food analysis
   ├─ Step 1: Build glucose snapshot
   ├─ Step 2: Build meal snapshot (uses food analysis)
   ├─ Step 3: Try Gemini prediction
   │   │      [or fallback to Ollama]
   │   └─ Gets: trend, confidence, 2h/4h estimates, recommendations
   ├─ Step 4: Store prediction
   └─ Step 5: Return to frontend
                ↓
4. SYSTEM (Background):
   ├─ Pattern service: Accumulates patterns from predictions
   ├─ Cron job: Generates 30-day pattern once daily
   ├─ Alert service: Flags critical predictions
   └─ Notification: Sends alert if risk critical
                ↓
5. DOCTOR REVIEW (Later):
   ├─ Doctor views patient dashboard
   ├─ Sees: All predictions, patterns, trends
   ├─ Asks AI-Doctor: "Analyze nocturnal hypos"
   ├─ Gets: Cohort analysis + specific interventions
   └─ Makes clinical decision
                ↓
6. PATIENT CHAT:
   ├─ Patient asks: "Why are my nights so low?"
   ├─ AI-Chat responds with personalized advice
   └─ Based on their accumulated pattern data
```

### Data Persistence

**Collections Structure:**

```
db.aiPredictions
├─ patientId: ObjectId
├─ mealId: ObjectId (optional)
├─ glucoseSnapshot: {average, lastValue, trend, ...}
├─ mealSnapshot: {carbs, calories, glycemicIndex, ...}
├─ prediction: {trend, confidence, estimatedValue2h, ...}
├─ isFallback: boolean
├─ triggerType: "manual" | "post_meal"
└─ createdAt: timestamp

db.aiPatterns
├─ patientId: ObjectId
├─ triggerType: "manual" | "daily"
├─ analysisPeriod: {startDate, endDate}
├─ nocturnalHypoglycemia: {detected, frequency, riskLevel, ...}
├─ postMealSpikes: {detected, frequency, riskLevel, ...}
├─ riskTimeWindows: {detected, highRiskHours, ...}
├─ glycemicControlDegradation: {detected, trend, ...}
└─ createdAt: timestamp

db.aiFoodAnalyses
├─ mealId: ObjectId
├─ patientId: ObjectId
├─ imageQuality: "good" | "acceptable" | "poor"
├─ detectedItems: [{name, quantity, preparation, confidence}]
├─ analysisResult: {calories, carbs, protein, fat, glycemicIndex, ...}
├─ detailedAdvice: {riskLevel, expectedGlucoseRise, ...}
└─ createdAt: timestamp

db.aiDoctorChats
├─ doctorId: ObjectId
├─ message: string
├─ response: string
├─ context: {patientsAnalyzed, dataUsed, ...}
└─ createdAt: timestamp

db.conversations (ai-chat)
├─ patientId: ObjectId
├─ messages: [{role: "user" | "assistant", content, timestamp}]
├─ context: {glucoseUsed, mealsUsed, ...}
└─ createdAt: timestamp
```

---

## Model Selection Strategy

### Priority Chain Logic

Each service maintains an ordered list of models to try sequentially:

```typescript
// ai-prediction
getGeminiModelCandidates(): string[] {
  return ['gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash'];
}

getPredictionModelCandidates(): string[] {
  return ['llava:latest', 'llava:13b', 'llama3.1:8b', 'llama3.2:3b', 'mistral:7b'];
}

// ai-food-analyzer
getOllamaVisionModelCandidates(): string[] {
  return ['llava:13b', 'llava:latest', 'bakllava'];
}

getGeminiModelCandidates(): string[] {
  return ['gemini-1.5-pro', 'gemini-2.0-flash'];
}

// All services follow pattern:
for (const modelName of modelCandidates) {
  try {
    // Call model
    if (success) return result;
  } catch (err) {
    if (err.status === 404 && isModelNotFoundError) {
      logger.warn(`Model not found: ${modelName}. Trying next.`);
      continue;  // ← Skip to next model
    }
    throw err;  // ← Other errors = stop trying
  }
}
throw new Error('No models available');
```

### Failure Scenarios

| Scenario | Handling | Result |
|----------|----------|--------|
| Model not installed (404) | Skip to next in chain | Continue iteration |
| Model timeout (240s) | Throw error | Try fallback engine |
| Connection refused | Throw error | Try fallback engine |
| Malformed JSON | Reject response | Try next model or fallback |
| Template placeholders detected | Reject response | Try next model |
| All models exhausted | Use local fallback | Low-confidence response |
| No API key (Gemini) | Skip Gemini, go to Ollama | All features still work |

---

## Error Handling & Fallbacks

### Validation Layers

```
User Input
    ↓
[Validation Layer 1: Format Check]
    ├─ Image size, format
    ├─ Message length
    ├─ PatientId existence
    └─ → Throw HttpException if invalid
    ↓
[Validation Layer 2: Authorization Check]
    ├─ Patient owns data
    ├─ Doctor owns patient
    ├─ Access token valid
    └─ → Throw ForbiddenException if denied
    ↓
[Validation Layer 3: AI Response Validation]
    ├─ JSON parseable
    ├─ All required fields present
    ├─ Field types correct
    ├─ No template placeholders
    └─ → Reject response, try next model
    ↓
Storage Success
```

### Template Placeholder Detection

**Why**: Ollama vision models sometimes echo prompt templates instead of analyzing

**Detection**:
```typescript
const isTemplatePlaceholder = (val: unknown): boolean => {
  const str = String(val ?? '').toLowerCase().trim();
  return [
    'action 1', 'action 2', 'action 3',
    'alert if critical',
    'simple explanation for the patient',
    'one sentence summary'
  ].includes(str);
};

// Used in response validation:
const hasTemplatePlaceholders =
  (Array.isArray(p.recommendations) && p.recommendations.some(isTemplatePlaceholder)) ||
  (Array.isArray(p.alerts) && p.alerts.some(isTemplatePlaceholder));

if (hasTemplatePlaceholders) {
  logger.warn(`Response contains templates, rejecting...`);
  continue;  // Try next model
}
```

### JSON Repair Mechanisms

**Ollama responses often include noise**:

```
Raw Ollama: 
```
// This is a pattern analysis
{
  "nocturnalHypos": 7,  // very concerning
  "postMealSpikes": 12 spikes detected,  // <-- invalid!
  "avgSpikeValue": 215 mg/dL,  // <-- invalid!
}
```

**Repair pipeline**:
```
1. Strip markdown: ```json → ""
2. Remove comments: // and /* */
3. Extract JSON: Find { ... } boundaries
4. Fix trailing commas: , } → }
5. Fix numeric units: "value": 205 mg/dL → "value": 205
6. Parse final JSON
```

**Result after repair**:
```json
{
  "nocturnalHypos": 7,
  "postMealSpikes": 12,
  "avgSpikeValue": 215
}
```

---

## Integration Between Services

### Service Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                  AI SERVICES DEPENDENCY GRAPH                │
└─────────────────────────────────────────────────────────────┘

    ai-chat
      ├─ Depends on: GlucoseService, NutritionService
      ├─ Used by: Patients (directly)
      └─ Independent from other AI services

    ai-food-analyzer
      ├─ Depends on: GlucoseService, NutritionService, PatientsService
      ├─ Used by: ai-prediction (for mealSnapshot)
      └─ Triggers: prediction service indirectly

    ai-prediction
      ├─ Depends on: GlucoseService, NutritionService, ai-food-analyzer
      ├─ Used by: ai-pattern, Dashboards, Alerts
      └─ Triggered by: Post-meal events

    ai-pattern
      ├─ Depends on: GlucoseService, NutritionService, multiple predictions
      ├─ Used by: Dashboards, ai-doctor
      └─ Triggered by: Daily cron or manual request

    ai-doctor
      ├─ Depends on: GlucoseService, NutritionService, MedecinsService, ai-prediction
      ├─ Used by: Doctors (authenticated)
      └─ Returns: Cohort + individual analysis
```

### Data Flow Between Services

**Scenario 1: Post-Meal Workflow**
```
1. Meal created → NutritionService
2. Image analyzed → AiFoodAnalyzer
   └─ Stores: detailedAdvice, expectedGlucoseRise
3. Meal logged → NutritionService.createMeal()
4. AiPredictionService triggered
   └─ Gets: mealId
   └─ Fetches: AiFoodAnalysis + glucose
   └─ Uses: expectedGlucoseRise in prompt
   └─ Stores: prediction with mealSnapshot
5. Pattern Service accumulates prediction
6. Alerts service checks if critical
```

**Scenario 2: Daily Pattern Analysis**
```
1. Cron job runs daily (e.g., 23:00)
2. AiPatternService.analyzeDaily(patientId)
3. Fetches: Last 30 days of predictions
4. Calculates: Nocturnal hypos, post-meal spikes, trends
5. Calls: Ollama with aggregated statistics
6. Stores: Complete 30-day pattern analysis
7. Frontend can query: Latest pattern for patient
```

**Scenario 3: Doctor Consultation**
```
1. Doctor opens dashboard
2. Frontend requests: getPatientCohort(doctorId)
3. AiDoctorService.getDoctorRaw()
   └─ Loads: Doctor's patient list
   └─ For each patient, aggregates:
      ├─ Last 30 glucose records
      ├─ Last 10 meals
      ├─ Recent 5 predictions
      └─ Latest pattern analysis
4. Doctor asks question in chat
5. AiDoctorService.chat(doctorId, question)
   └─ Injects: All patient data into prompt
   └─ Calls: Ollama with system prompt + patient context
   └─ Returns: Analysis + recommendations
```

---

## Performance & Optimization

### Caching Strategy

```
Query Results Cached (In-Memory):
├─ Doctor's patient list: 5-minute TTL
├─ Patient glucose stats: 10-minute TTL
├─ Recent predictions: 5-minute TTL
└─ Meal data: 10-minute TTL

Database Queries Optimized:
├─ Indexed fields:
│  ├─ aiPredictions: patientId, createdAt (DESC)
│  ├─ aiPatterns: patientId, createdAt (DESC)
│  ├─ glucoseRecords: patientId, measuredAt (DESC)
│  └─ meals: patientId, createdAt (DESC)
├─ Projection (fetch only needed fields)
├─ Lean queries (return plain objects, not full models)
└─ Limit enforcement (e.g., 30 glucose records max)
```

### Timeout Configuration

```
Service                  | Timeout | Rationale
-------------------------|---------|------------------------------------------
Ollama API Call          | 240s    | Complex vision models (llava) are slow
Gemini API Call          | Default | Gemini has its own server-side timeout
Database Query           | 30s     | Should be fast with proper indexes
HTTP Request (general)   | 60s     | File upload, external APIs
AI-Chat Response         | 240s    | Load patient data + call Ollama
AI-Food Analyzer Phase 1 | 240s    | Vision detection is slowest
AI-Food Analyzer Phase 2 | 60s     | Gemini usually fast for text
```

### Parallel Processing

**Used in all services to speed initialization**:

```typescript
// Instead of sequential:
const glucose = await glucoseService.find();
const meals = await nutritionService.find();
const predictions = await predictionModel.find();

// Use parallel:
const [glucose, meals, predictions] = await Promise.all([
  glucoseService.find(),
  nutritionService.find(),
  predictionModel.find()
]);
```

**Benefit**: 30s → 10s for concurrent operations (3x faster)

### Response Size Optimization

```
AI-Chat Service:
└─ Only fetch 20 glucose records (not full history)
└─ Only fetch 10 meals (not full history)
└─ Calculate stats, don't return raw data
└─ Response: ~2KB

AI-Food-Analyzer:
└─ Image analyzed by Ollama locally (not uploaded)
└─ Store efficient JSON (not full image)
└─ Response: ~5KB

AI-Prediction:
└─ Return prediction object only (~2KB)
└─ Don't repeat input glucose/meal data
└─ Response: ~2KB

AI-Pattern:
└─ Aggregated statistics (~10KB)
└─ Response: ~10KB

AI-Doctor:
└─ Patient cohort summaries only
└─ Response: ~20KB per doctor query
```

---

## Configuration & Environment Variables

```bash
# Required
GEMINI_API_KEY=xxx              # Google Gemini API key (optional, services work without)
OLLAMA_URL=http://localhost:11434/api/generate  # Ollama server URL

# Optional Overrides
NODE_ENV=production|development
MONGODB_URI=mongodb://...       # Database connection
LOG_LEVEL=debug|info|warn|error # Logger verbosity

# Model Selection (env-based fallback, default in code is standard chain)
# Format: "model1,model2,model3"
# No env var needed - code maintains best chain
```

---

## Summary: How It All Works Together

### Typical Day in Patient's Life

```
08:00 - Patient wakes up
  └─ Checks glucose: 145 mg/dL
  └─ Logs in app
  └─ AiChatService responds: "Good morning! Your glucose is normal..."

08:30 - Patient eats breakfast (bagel + juice)
  └─ Takes photo with app
  └─ AiFoodAnalyzer: Detects item via Ollama vision
  └─ AiFoodAnalyzer: Gemini generates report (~45g carbs estimated)
  └─ Stores analysis in DB

08:35 - AiPredictionService auto-triggers
  └─ Fetches: Last 30 glucose readings, breakfast analysis
  └─ Calls: Gemini prediction
  └─ Result: "Expect 165 mg/dL in 2h, moderate risk (high carbs)"
  └─ Stores prediction, checks if critical
  └─ Sends push notification if needed

12:00 - Patient checks dashboard
  └─ Sees: Breakfast prediction was accurate (165 at 10:35)
  └─ Logs lunch (similar to breakfast)
  └─ Prediction generated again

18:00 - Evening, prediction continues through day

23:00 - Midnight: Daily Cron Job
  └─ AiPatternService.analyzeDaily() runs
  └─ Processes: Last 30 days of all glucose + predictions
  └─ Identifies: 5 nocturnal hypos (ALERT), post-meal spikes, trends
  └─ Stores: Complete pattern analysis for doctor review

Next morning:
09:00 - Doctor logs in
  └─ Sees patient in cohort: "Nocturnal hypoglycemia detected"
  └─ Uses AI-DoctorService to ask: "What adjustment for patient X?"
  └─ AI reviews: Pattern data + current drugs + glucose history
  └─ Suggests: "Reduce bedtime NPH insulin by 10%"
  └─ Doctor approves and adjusts prescription
```

### Key Architectural Principles

1. **Graceful Degradation**: Service works even if Gemini key missing or Ollama down
2. **Data-Driven**: All recommendations based on patient's actual data, not templates
3. **Safety-First**: Template detection, validation layers, fallback logic
4. **Responsive**: Parallel data loading, smart timeouts (240s for vision, 60s for text)
5. **Privacy**: Doctor-only access to patient lists, authorization checks everywhere
6. **Scalable**: Indexed DB queries, lean mongoose objects, efficient caching
7. **Transparent**: Log every model tried, every fallback used, `isFallback` flag in responses

---

## Conclusion

This AI system provides **multi-layered clinical decision support** for diabetic patient management:

- **For Patients**: Real-time glucose predictions, meal analysis, personalized chat
- **For Doctors**: Cohort analysis, pattern detection, patient stratification
- **For System**: Resilient architecture with fallbacks at every level

The dual-engine approach (Gemini + Ollama + Local fallback) ensures service continuity while maintaining response quality through validation, normalization, and robust error handling.

