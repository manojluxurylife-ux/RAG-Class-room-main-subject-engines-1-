# AI Guru Brain2 — Study Material Studio

This edition adds a unified textbook-grounded generator that assigns presentation-oriented materials to an OpenMAIC-style workflow and knowledge/personalization materials to a DeepTutor-style workflow.

## Material routing

OpenMAIC-style: classroom teaching, PPT outlines, interactive web lessons, simulations, whiteboard lessons and AI classroom discussions.

DeepTutor-style: interactive books, flashcards, revision notes, knowledge bases, research briefs, personalized study plans, quiz banks and learner-memory records.

## Run

1. Copy `.env.example` to `.env.local` and add `GEMINI_API_KEY`.
2. Run `npm install` then `npm run dev`, or `docker compose up --build`.
3. Open `/rag-classroom` and index a text-based PDF.
4. Open `/material-studio`, select the textbook, topic and material type.

Generated materials can be downloaded as Markdown or JSON. PDF OCR, production vector search, tenant isolation and formal learner-consent controls should be added before public multi-user deployment.
