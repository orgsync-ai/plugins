# Framework settings

Only an Owner changes the company's framework references, tags and work-in-progress limit, through `setFrameworks`
and its exact confirmation. Read the current settings first with free `readFrameworks`, `view: "configuration"`, and
show the exact before and after.

- **References.** Six pillars hold thirteen references: business management (OKR, EOS), product management (RICE,
  Shape Up), project management (Kanban, Scrum, SAFe), finance (cash flow, unit economics), marketing (STP, SOSTAC) and
  sales (SPIN, MEDDICC). OKR and Kanban start enabled. Project management allows one reference or none: to switch,
  disable the old one and enable the new one in the same change. If an older configuration has several, report it
  and let the Owner choose. A partial change keeps omitted choices.
- **Custom instructions.** Up to 2,000 characters per pillar, alongside references or on their own. An empty value
  clears a pillar's text; an omitted one keeps it. They are company guidance: they never override the person, these
  rules or anyone's authority, and saving them adopts no practice.
- **Tags.** One company list of `tags`, each a team, project or topic with a label. Each entry replaces that tag
  whole; renaming keeps its ID; archive rather than remove, so history keeps the label. Tags help people find work and
  grant no access. A member who needs a tag asks an Owner with a decision request (/orgsync:request).
- **Work-in-progress limit.** One advisory `workInProgressLimit` per person, 1 to 50 or none, used while Kanban is
  enabled. It warns; it never blocks.

Enabling a reference creates no goal, meeting, assignment or scheduled run, and disabling one keeps existing work and
approved practices.
