"""AI Guru Gemini ADK material team.

Planner -> parallel content/visual/assessment -> strict QA -> final repair/merge.
The final agent must always return the complete final material JSON, repairing it
when the QA score is below 85 or the report is malformed.
"""
import os
from google.adk.agents import LlmAgent, ParallelAgent, SequentialAgent

MODEL = os.getenv("GEMINI_ADK_MODEL", "gemini-2.5-flash")
VISUAL_TYPES = "graph, bar-chart, geometry, fraction, number-line, mermaid, solid-3d, geogebra, molecule, circuit, biology-diagram"

planner = LlmAgent(
    name="curriculum_planner",
    model=MODEL,
    instruction=(
        "Plan objectives, topic coverage, source IDs, difficulty, section order, "
        "visual needs and assessment goals from the supplied textbook packet. "
        "Use only supplied sources and output strict JSON."
    ),
    output_key="plan",
)
content = LlmAgent(
    name="material_specialist",
    model=MODEL,
    instruction=(
        "Using {plan}, produce the requested material as strict JSON with title, engine, overview, "
        "and sections. Every section must include heading, content and sourceIds. Use only source IDs."
    ),
    output_key="content",
)
visual = LlmAgent(
    name="visual_specialist",
    model=MODEL,
    instruction=(
        f"Using {{plan}}, produce strict JSON with one real renderable Visual object per section. "
        f"Allowed types: {VISUAL_TYPES}. Never return a descriptive visual suggestion."
    ),
    output_key="visuals",
)
assessment = LlmAgent(
    name="assessment_specialist",
    model=MODEL,
    instruction=(
        "Using {plan}, produce strict JSON assessments with question, answer, explanation and sourceIds. "
        "For quiz material include strong MCQs and mixed questions; for lessons include checkpoints."
    ),
    output_key="assessments",
)
parallel = ParallelAgent(name="parallel_material_team", sub_agents=[content, visual, assessment])
qa = LlmAgent(
    name="qa_grounding",
    model=MODEL,
    instruction=(
        "Audit {content}, {visuals}, and {assessments} against the original source packet and {plan}. "
        "Return strict JSON exactly with pass:boolean, score:number 0-100, issues:array, missingTopics:array. "
        "A malformed or unsupported output must fail. Reject unsupported claims, wrong answers, missing citations, "
        "weak coverage and non-renderable visuals."
    ),
    output_key="qa",
)
finalizer = LlmAgent(
    name="qa_repair_and_merge",
    model=MODEL,
    instruction=(
        "Merge {content}, {visuals}, and {assessments} into one final raw JSON object. Inspect {qa}. "
        "If pass is not exactly true, score is below 85, required fields are missing, or issues contain errors, "
        "repair only failed parts using the original source packet. Return JSON exactly: "
        "{\"material\":{\"title\":\"\",\"engine\":\"OpenMAIC|DeepTutor\",\"overview\":\"\","
        "\"sections\":[{\"heading\":\"\",\"content\":\"\",\"activity\":\"\",\"answer\":\"\","
        "\"sourceIds\":[\"S1\"],\"visual\":{}}],\"sources\":[],\"qaReport\":{}},"
        "\"agentRun\":{\"mode\":\"google-adk-cloud-run\",\"parallelAgents\":[\"material_specialist\","
        "\"visual_specialist\",\"assessment_specialist\"]}}. Return no markdown."
    ),
    output_key="final_material",
)
root_agent = SequentialAgent(
    name="ai_guru_material_pipeline",
    sub_agents=[planner, parallel, qa, finalizer],
)
