# Gemini ADK Material Worker

Deploy this directory as a **private Cloud Run service** and invoke `/process` through Cloud Tasks using OIDC. It implements the ADK workflow:

1. Curriculum planner (`LlmAgent`)
2. Content, visual and assessment specialists (`ParallelAgent`)
3. Grounding QA (`LlmAgent`)
4. Root sequencing (`SequentialAgent`)

The Next.js browser workflow mirrors this design for Gemini BYOK keys because those keys must remain on the student's device.
