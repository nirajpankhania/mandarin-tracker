# Mandarin lessons

A small web app for one student and one teacher: lesson notes, homework, vocabulary
pulled from the teacher's slides, example sentences from the call transcript, and
Anki deck export.

Built with Next.js, deployed on Vercel, data in Neon Postgres. Both free tiers are enough.

## What it does

- **Lessons**: date, title and notes. Upload the lesson's slides as `.pptx` or `.pdf`; the text is read
  in your browser (the file itself is never uploaded or stored) and Chinese words are
  listed with pinyin for you to tick. Words the slide already glosses
  (`苹果 píngguǒ apple`, or a table row) come with their meaning filled in.
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
4. Open the site Vercel gives you. The first visit shows a setup page that creates the
   database tables and the two logins. It only works once.
5. Send your teacher the address and their starter password. They can change it under
   "Change password" at the bottom of any page.

Every later push to GitHub redeploys automatically.

## Run it on your own computer

```
cp .env.example .env.local   # then fill in DATABASE_URL and AUTH_SECRET
npm install
npm run dev
```

## Good to know

- Slides can be `.pptx` or `.pdf`. PDF pages with no selectable text (scans, or slides saved
  as pictures) are read with OCR in the browser. That is slower, downloads a ~20 MB language
  file the first time, and can confuse similar-looking characters, so check the word list.
  In a `.pptx`, text inside pictures is not read.
- Transcript matching is only as good as the transcript. Set the call's transcription
  language to Chinese, or the Chinese comes out garbled.
- Dates use the `APP_TIMEZONE` setting (default `America/New_York`).
- There is no "forgot password" email. If one of you is locked out, the other can't reset
  it from the app; update the row in Neon or ask for help.
- The look follows imbue.com, with free stand-in fonts (Besley and DM Mono) because
  Imbue's own typefaces are licensed.
