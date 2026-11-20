/** Seed: the six service pages (brief §11.5). */

export type SeedService = {
  title: string;
  slug: string;
  icon: string;
  serviceType: string;
  projectCategories: string[];
  summary: string;
  body: string;
  deliverables: string[];
  process: Array<{ title: string; description: string }>;
  faqs: Array<[string, string]>;
  cta: string;
};

export const services: SeedService[] = [
  {
    title: "Software Engineering",
    slug: "software-engineering",
    icon: "code-2",
    serviceType: "web-app",
    projectCategories: ["web-apps", "mobile-apps", "websites", "plugins"],
    summary:
      "Web and mobile products built to ship and built to last — from first architecture sketch to a production system your team can confidently maintain.",
    body: `<p>Most software problems are not technology problems; they are clarity problems. I start by pinning down who the product serves, what "done" looks like and which constraints are real — budget, hosting, integrations, compliance — before writing a line of code.</p>
<p>From there I build with a deliberately boring, well-supported stack: Laravel or Node.js on the server, React or React Native on the client, PostgreSQL or MySQL underneath, deployed to AWS or managed hosting depending on what your team can operate. Releases are small and frequent, every important path is tested, and the codebase comes with documentation written for the next engineer, not for me.</p>
<h2>Typical engagements</h2>
<ul><li>New web applications and customer portals</li><li>Cross-platform mobile apps with React Native</li><li>E-commerce and marketplace builds</li><li>WordPress plugins and themes for specific business workflows</li><li>Rescue and modernisation of existing codebases</li></ul>`,
    deliverables: [
      "Discovery notes, scope and technical architecture",
      "Production-ready web or mobile application",
      "Automated tests on critical paths",
      "Deployment pipeline and hosting setup",
      "Admin documentation and developer handover",
      "30 days of post-launch support",
    ],
    process: [
      { title: "Discover", description: "Workshops to map users, goals, constraints and success metrics. Output: a written scope and architecture." },
      { title: "Design & plan", description: "Data model, key screens and a milestone plan with demo dates you can hold me to." },
      { title: "Build in increments", description: "Working software every one to two weeks on a staging URL, with tests and code review baked in." },
      { title: "Launch & hand over", description: "Production deployment, monitoring, documentation and a walkthrough for your team." },
    ],
    faqs: [
      ["What does a typical project cost?", "It depends on scope. After a discovery call I send a fixed-price proposal for a clearly defined first release, so you know the cost before work starts."],
      ["Which stack will you use?", "Usually Laravel or Node.js with React, on PostgreSQL or MySQL. If your team already runs a different stack, I work within it rather than adding something new to maintain."],
      ["Can you take over an existing codebase?", "Yes. I start with a short audit — code quality, security, deployment and data — and give you a prioritised plan before changing anything."],
    ],
    cta: "Discuss your product",
  },
  {
    title: "AI Agents & Automation",
    slug: "ai-agents-automation",
    icon: "bot",
    serviceType: "ai-automation",
    projectCategories: ["ai-automation"],
    summary:
      "Practical AI agents and LLM automations that remove repetitive work — with the evaluation, guardrails and cost controls production use demands.",
    body: `<p>AI is useful when it is pointed at a specific, measurable bottleneck: the support inbox that never empties, the content pipeline that depends on one overworked person, the documents someone re-types every week. I help teams find those bottlenecks and build agents and automations that handle them reliably.</p>
<p>Every build includes an evaluation set drawn from your real data, human review where the stakes are high, logging you can audit, and a clear monthly cost estimate. The goal is a system your operations team trusts — not a demo.</p>
<h2>Typical engagements</h2>
<ul><li>Customer-support and lead-qualification assistants</li><li>Content and social-media production pipelines</li><li>Document extraction and classification</li><li>Internal knowledge assistants over your own documents</li><li>AI video and ad-creative workflows</li></ul>`,
    deliverables: [
      "Opportunity assessment and ROI estimate",
      "Working agent or automation integrated with your tools",
      "Evaluation set and quality report",
      "Guardrails, logging and human-in-the-loop review",
      "Cost model and usage dashboard",
      "Runbook and team training session",
    ],
    process: [
      { title: "Find the bottleneck", description: "Map the workflow, measure the time it costs and agree what success looks like." },
      { title: "Prototype on real data", description: "A small, testable prototype evaluated against examples from your own operations." },
      { title: "Harden for production", description: "Guardrails, retries, monitoring, access control and cost limits." },
      { title: "Roll out & train", description: "Phased rollout, staff training and a review after the first month of use." },
    ],
    faqs: [
      ["Is our data safe?", "Data handling is agreed up front: which provider processes it, what is stored, for how long, and who can see logs. Sensitive fields can be redacted before anything leaves your systems."],
      ["What if the AI gets something wrong?", "Agents are scoped to tasks where errors are caught — by validation rules, confidence thresholds or human review. Evaluation sets measure accuracy before and after launch."],
      ["How much will it cost to run?", "You get a per-task and monthly cost estimate during the prototype phase, based on your actual volumes, before committing to production."],
    ],
    cta: "Explore an automation",
  },
  {
    title: "Corporate Technology Training",
    slug: "corporate-technology-training",
    icon: "graduation-cap",
    serviceType: "corporate-training",
    projectCategories: ["courseware"],
    summary:
      "Instructor-led programmes in cloud, virtualization, software development, data, AI and cybersecurity — built around hands-on labs and your team's real work.",
    body: `<p>Good training changes how a team works on Monday morning. My programmes are built around labs, realistic scenarios and capstone projects rather than slides, and every one starts with a needs assessment so the content matches your team's stack and level.</p>
<p>I have delivered programmes for corporate IT departments, banks, business schools and public institutions including the ECOWAS Community Court of Justice — on-site and virtually, from five-day bootcamps to multi-week cohorts.</p>
<h2>Popular tracks</h2>
<ul><li>AWS Certified Solutions Architect – Associate</li><li>VMware vSAN and VMware Cloud Foundation</li><li>Secure coding with ASP.NET Core, C# and .NET</li><li>React Native and full-stack web development</li><li>AI adoption, AI &amp; machine learning, AI video creation</li><li>dbt analytics engineering</li></ul>`,
    deliverables: [
      "Training needs assessment",
      "Customised curriculum and lab environment",
      "Participant manuals and practice question banks",
      "Instructor-led delivery (on-site or virtual)",
      "Capstone project and assessment",
      "Post-training report with recommendations",
    ],
    process: [
      { title: "Assess", description: "Short survey and call with team leads to establish current skills, goals and constraints." },
      { title: "Tailor", description: "Curriculum, labs and capstone adapted to your stack and industry; schedule agreed." },
      { title: "Deliver", description: "Hands-on, instructor-led sessions with daily labs and progress checks." },
      { title: "Reinforce", description: "Assessment, certificates of completion, a written report and follow-up resources." },
    ],
    faqs: [
      ["Do you prepare participants for certification exams?", "Yes. Certification tracks include exam-style question banks and practice sets aligned to the official objectives."],
      ["What is the ideal cohort size?", "Eight to twenty participants keeps labs hands-on. Larger groups are split into cohorts or supported with an assistant instructor."],
      ["Can training be delivered virtually?", "Yes. Virtual delivery uses live sessions, cloud lab environments and shared workspaces so participants still build things themselves."],
    ],
    cta: "Plan a training",
  },
  {
    title: "Oracle Database Training & Consulting",
    slug: "oracle-database-training-consulting",
    icon: "database",
    serviceType: "oracle-db",
    projectCategories: ["oracle-db"],
    summary:
      "Oracle Database 19c expertise — SQL, PL/SQL, administration and RAC — delivered as hands-on training or as consulting on your own environments.",
    body: `<p>Oracle Database still runs the core of many banks, telecoms and public institutions, and the skills to operate it well are scarce. I teach and consult across the full stack: SQL and PL/SQL for developers, administration for DBAs, and Real Application Clusters for teams running high-availability systems.</p>
<p>Training is lab-first. Participants build their own environments — including a two-node RAC cluster with DNS and shared storage on a laptop with VirtualBox — so they understand what the tooling is doing rather than memorising commands.</p>
<h2>Areas covered</h2>
<ul><li>Oracle Database 19c SQL and PL/SQL</li><li>Administration I–III (1Z0-082 aligned), including automation</li><li>RAC 19c installation, administration and troubleshooting</li><li>Backup and recovery, performance diagnostics</li><li>Environment reviews and upgrade planning</li></ul>`,
    deliverables: [
      "Lab environment build guides",
      "Instructor-led bootcamp or consulting engagement",
      "1Z0-082-aligned practice question bank",
      "Health-check report for existing databases",
      "Runbooks for routine DBA tasks",
    ],
    process: [
      { title: "Baseline", description: "Review current environments or participants' experience level." },
      { title: "Build", description: "Stand up lab or staging environments that mirror production." },
      { title: "Teach or fix", description: "Bootcamp delivery, or hands-on consulting on the agreed issues." },
      { title: "Document", description: "Runbooks, recommendations and a follow-up plan." },
    ],
    faqs: [
      ["Do participants need their own Oracle licences?", "No. Labs use Oracle's freely downloadable software for learning purposes in local VirtualBox environments or cloud labs."],
      ["Can you help with an Oracle upgrade?", "Yes — from assessment and test plans to rehearsal on a copy of production and the cut-over runbook."],
      ["Is the training aligned to Oracle certification?", "The DBA programme follows the 1Z0-082 objectives and includes a 150-question practice bank."],
    ],
    cta: "Talk Oracle",
  },
  {
    title: "Lean Six Sigma Training",
    slug: "lean-six-sigma-training",
    icon: "line-chart",
    serviceType: "lean-six-sigma",
    projectCategories: ["lean-six-sigma"],
    summary:
      "Lean Six Sigma programmes up to Master Black Belt curriculum, with statistical practice sets and real improvement projects.",
    body: `<p>Lean Six Sigma gives teams a shared language for improving processes with evidence instead of opinion. My programmes cover the DMAIC method end to end — from defining the problem and measuring the baseline to statistical analysis, improvement and control — with practice sets that make the statistics feel routine.</p>
<p>Participants work on improvement projects from their own organisation, so the training pays for itself in measurable process gains.</p>
<h2>Programme levels</h2>
<ul><li>Yellow and Green Belt foundations</li><li>Black Belt statistical toolkit</li><li>Master Black Belt curriculum: deployment, coaching and advanced statistics</li></ul>`,
    deliverables: [
      "Programme manual (up to 70+ pages at MBB level)",
      "Question banks and statistical practice sets",
      "Templates for charters, SIPOC, FMEA and control plans",
      "Coached improvement project",
      "Assessment and completion certificates",
    ],
    process: [
      { title: "Select projects", description: "Each participant or team brings a real process problem with a sponsor." },
      { title: "Learn DMAIC", description: "Phase-by-phase teaching with exercises and statistical practice." },
      { title: "Apply", description: "Coached work on the live projects between sessions." },
      { title: "Present results", description: "Tollgate reviews and a final presentation of measured improvements." },
    ],
    faqs: [
      ["Do we need statistical software?", "Exercises are designed to work in Excel; Minitab or Python are used where the team already has them."],
      ["How long does a programme take?", "From a few days for foundations to several weeks for Black Belt, with project work in between sessions."],
      ["Is this suitable for service organisations?", "Yes. Examples and projects come from banking, public service, logistics and other service operations, not only manufacturing."],
    ],
    cta: "Start an improvement programme",
  },
  {
    title: "Curriculum & Courseware Development",
    slug: "curriculum-courseware-development",
    icon: "book-open",
    serviceType: "consulting",
    projectCategories: ["courseware"],
    summary:
      "Complete course packages — manuals, labs, slide decks and certification-style question banks — produced with software-grade rigour.",
    body: `<p>Training organisations and internal academies need courseware that is accurate, consistent and easy to update. I produce full course packages using a programmatic, version-controlled workflow: content is written once and generated into manuals, handouts, slides and question banks, so updates propagate everywhere.</p>
<p>Recent work includes a 238-page React Native handout, a 223-page AI &amp; Machine Learning manual, a 76-page dbt manual, a 70-page Lean Six Sigma Master Black Belt manual and a 150-question Oracle DBA certification bank.</p>`,
    deliverables: [
      "Learning objectives and course outline",
      "Participant manual and instructor guide",
      "Hands-on labs with solutions",
      "Slide decks",
      "Certification-style question banks with explanations",
      "Source files in an editable, version-controlled format",
    ],
    process: [
      { title: "Define outcomes", description: "Audience, prerequisites and measurable learning objectives." },
      { title: "Outline & sample", description: "Full outline plus one finished sample module for approval." },
      { title: "Produce", description: "Remaining modules, labs and assessments, reviewed in batches." },
      { title: "Deliver sources", description: "Final files plus the editable sources so your team can maintain them." },
    ],
    faqs: [
      ["Who owns the courseware?", "You do, once paid for — including the editable sources."],
      ["Can you write to an existing syllabus or exam blueprint?", "Yes. Content and question banks can be mapped objective-by-objective to a certification blueprint."],
      ["How long does a full manual take?", "Typically two to six weeks depending on length, labs and review cycles."],
    ],
    cta: "Commission courseware",
  },
];
