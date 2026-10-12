# Team Maria Onboarding

Distributor onboarding for Team Maria: real accounts, Standard and Premium plans,
training progress, and Maria's leader dashboard.

## How it runs

- `server.js`: the web server (Node + Express). Handles sign-in, invite links,
  saving progress, and the dashboard data.
- `index.html`: the whole front end (one page).
- `content.js`: all training content (onboarding videos, advanced lessons, mindset videos).
- Data lives in a Postgres database.

## Settings (Railway variables)

| Variable       | What it's for |
| -------------- | ------------- |
| `DATABASE_URL` | Required. Reference the Postgres service: `${{Postgres.DATABASE_URL}}` |
| `ADMINS`       | Admin accounts, as `Name <email>`, separated by commas. Example: `Maria Lopez <maria@example.com>, Nicole <nicole@responsiv.agency>` |

When the server starts, any admin in `ADMINS` who hasn't set a password yet gets a
one-time setup link printed in the deploy logs (valid 14 days). After that, admins can
copy fresh invite or reset links for anyone from the dashboard.

## Who can do what

- **Admins (Maria):** see everyone, add team leaders and members, change plans,
  copy invite and reset links, remove people.
- **Team leaders:** see and manage only the members assigned to them.
- **Members:** go through onboarding, then mindset videos (and advanced training on Premium).

## Updating content

Edit `content.js`:

- Paste a YouTube or Vimeo link into a lesson's `videoUrl`. Unlisted YouTube videos work.
- Put each mindset video's link (Instagram, Facebook, YouTube) into its `url`.
- Adding lessons to the end of a list is safe. Reordering or removing lessons after
  people have started shifts their saved progress.

## Running it on your own computer

Needs Node 20+ and a Postgres database.

```
npm install
DATABASE_URL=postgres://user:pass@localhost/teammaria ADMINS="Your Name <you@example.com>" npm start
```
