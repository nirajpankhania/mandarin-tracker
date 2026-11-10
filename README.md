# Mandarin lessons

A small web app for one student and one teacher: lesson notes, homework, vocabulary
pulled from the teacher's slides, example sentences from the call transcript, and
Anki deck export.

Built with Next.js, deployed on Vercel, data in Neon Postgres. Both free tiers are enough.

## What it does

- **Lessons**: date, title and notes. Upload the lesson's slides as `.pptx` or `.pdf`. The text is
  read in your browser (the file itself is never stored), then sent to an AI model (Claude on
  Microsoft Foundry, with Gemini as the fallback), which returns the lesson's phrases, sentences and key words with pinyin and English, plus a
  suggested title and summary. You tick what to keep and correct anything before saving.
- **Homework**: either of you adds tasks with a due date. The student ticks them off and
  leaves a note; the teacher leaves feedback.
- **Call transcript**: upload or paste a `.vtt`, `.srt` or `.txt` transcript. Sentences that
  use a lesson word become that word's example sentence. Edit a word to choose another.
- **Anki**: download a `.apkg` per lesson or for everything. Each word makes two cards
  (read the characters, recall from the meaning). Re-importing a newer export updates
  the same cards instead of duplicating them. Words without a meaning are left out.

## Deploy (about 15 minutes, once)

1. **GitHub**: create a new private repository and push this folder to it
   (GitHub Desktop: File > Add local repository > Publish).
2. **Neon**: sign up at neon.tech, create a project, and copy the *pooled* connection string.
3. **Vercel**: sign in with GitHub, click Add New > Project, and import the repository.
   Before deploying, add two environment variables:
   - `DATABASE_URL`: the Neon connection string
   - `AUTH_SECRET`: a long random string (`openssl rand -base64 32`)
   - For reading slides, one or both of:
     - `ANTHROPIC_FOUNDRY_API_KEY` and `ANTHROPIC_FOUNDRY_RESOURCE` (your Microsoft Foundry
       resource name): Claude on Foundry, tried first. Optional `FOUNDRY_MODEL` is the
       deployment name (default `claude-fable-5-2`).
     - `GEMINI_API_KEY`: a free key from https://aistudio.google.com/apikey, used when Foundry
       isn't set up or fails (expired key, quota, outage).
4. Open the site Vercel gives you. The first visit shows a setup page that creates the
   database tables and the two logins. It only works once.
5. Send your teacher the address and their starter password. They can change it under
   "Change password" at the bottom of any page.

Every later push to GitHub redeploys automatically.

## Run it on your own computer

```
# create .env.local containing DATABASE_URL, AUTH_SECRET and the parser keys above
npm install
npm run dev
```

## Good to know

- Slides are read by Claude on Microsoft Foundry when that is configured, and by Gemini
  otherwise or when Foundry fails. The upload says which one answered. Foundry usage is billed
  to the Azure subscription that owns the key. On Gemini's free tier, Google may use what is
  sent (the slide text, and pictures of pages that have no selectable text) to improve its
  products. If neither works, the upload says why and you can still save the lesson and add
  words by hand.
- Gemini tries `gemini-3.8-flash`, then `gemini-3.5-flash-lite`, then `gemini-3.6-flash`. Set
  `GEMINI_MODEL` to try a different model first.
- Pinyin and meanings from the parser are AI-written; check them before saving.
- Transcript matching is only as good as the transcript. Set the call's transcription
  language to Chinese, or the Chinese comes out garbled.
- Dates use the `APP_TIMEZONE` setting (default `America/New_York`).
- There is no "forgot password" email. If one of you is locked out, the other can't reset
  it from the app; update the row in Neon or ask for help.
- The look follows imbue.com, with free stand-in fonts (Besley and DM Mono) because
  Imbue's own typefaces are licensed.
