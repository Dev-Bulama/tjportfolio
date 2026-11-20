/** Seed content: profile, settings, taxonomy, navigation (brief §11). Values in [[…]] are never rendered publicly. */

export const profile = {
  fullName: "Tijani Bulama",
  displayName: "TJ",
  headline: "Senior Full-Stack Engineer · AI Automation Specialist · Corporate Technology Trainer",
  positioning: "Software that ships. Oracle databases that stay up. Teams that can run both.",
  /** Hero typewriter: each line is typed, held, then replaced by the next. Editable in Settings → Profile. */
  rotatingLines: [
    "I build software that ships.",
    "I keep Oracle databases fast, secure and always on.",
    "I put AI agents to work on real problems.",
    "I train the teams who run it all.",
  ] as string[],
  shortBio:
    "Tijani Bulama is a senior full-stack software engineer with 8+ years of experience building web, mobile and AI-powered products with Laravel, React, Node.js, Python, PostgreSQL/MySQL and AWS. He is the Founder and CEO of Skillscore IT Solutions & Training, a Lagos-based technology training and software development company, and leads corporate training delivery through Mapelead Limited and Ha-shem Academy. His work spans production software, AI agents and automation, and instructor-led programmes in Oracle Database, cloud, virtualization and Lean Six Sigma for corporate and public-sector teams.",
  longBioHtml: `<p>Tijani Bulama — TJ to most people he works with — is a senior full-stack software engineer who has spent more than eight years turning business problems into software that people actually use. His day-to-day stack is Laravel, React, Node.js and Python on PostgreSQL or MySQL, deployed to AWS or pragmatic managed hosting, and he is as comfortable designing a database schema or a CI pipeline as he is refining an interface. He favours small, well-tested releases, plain documentation and systems that the client's own team can maintain long after the engagement ends.</p>
<p>That last point is the thread through everything he does. TJ founded <strong>Skillscore IT Solutions &amp; Training</strong> in Lagos to work on both sides of Africa's technology gap at once: building production software for organisations, and training the engineers, administrators and analysts who keep it running. Skillscore's mission is practical — fewer slide decks, more hands-on labs, and skills that show up in a team's work the following Monday.</p>
<p>Through Skillscore, Mapelead Limited and Ha-shem Academy, TJ designs and delivers instructor-led programmes in Oracle Database 19c (SQL, PL/SQL, administration and RAC), AWS, VMware vSAN and Cloud Foundation, secure software development, analytics engineering and Lean Six Sigma. He has delivered corporate training for organisations including the <strong>ECOWAS Community Court of Justice</strong> and the <strong>African American Business School (AABS)</strong>. He is also the author of large, programmatically produced course manuals and certification-style question banks — from a 238-page React Native handout to a 150-question Oracle DBA bank — built with the same version-controlled rigour he applies to software.</p>
<p>His current focus is AI agents and automation: applying agent frameworks and LLM workflows to real operational problems for African businesses — content pipelines, customer support, document processing and internal tooling — with the evaluation, guardrails and cost controls that production use demands. He writes about this work, and about the realities of building and teaching technology in Africa, on LinkedIn for a growing community of engineers and technology leaders.</p>
<p>TJ completed his National Youth Service (NYSC) at the Katsina State Directorate of Information and Communication Technology (KATDICT), where he developed a digital impact and legacy agenda for the directorate and a digital-literacy programme for schools. That experience — technology as public infrastructure, and education as the multiplier — still shapes how he chooses projects today.</p>`,
  location: "Lagos, Nigeria",
  reach: "Works with clients across Africa and remotely worldwide",
  email: "[[add email]]",
  phone: "[[add phone]]",
  whatsapp: "[[add WhatsApp number, e.g. 2348012345678]]",
  domain: "[[add domain]]",
  availability: "Available for select projects & corporate trainings",
  availabilityStatus: "available" as "available" | "booked",
  bookedUntil: "",
  portraitId: null as number | null,
  secondaryPhotoIds: [] as number[],
  officeCity: "Lagos, Nigeria",
};

export const branding = {
  logoLightId: null as number | null,
  logoDarkId: null as number | null,
  faviconId: null as number | null,
  accentOverride: "",
  fontPreset: "editorial" as "editorial" | "classic" | "modern",
  duotonePortrait: false,
};

export const seoDefaults = {
  siteName: "Tijani Bulama",
  titleTemplate: "%s · Tijani Bulama",
  defaultTitle: "Tijani Bulama — Senior Full-Stack Engineer, AI Automation Specialist & Technology Trainer",
  defaultDescription:
    "Tijani “TJ” Bulama builds production software and AI automation, and trains the teams who run it — Oracle Database, AWS, VMware, Lean Six Sigma and modern software engineering. Lagos, Nigeria.",
  ogImageId: null as number | null,
  gscVerification: "",
  ga4Id: "",
  twitterHandle: "",
};

export const integrations = { calendlyUrl: "", whatsappMessage: "Hello TJ, I found you through your website." };

export const siteSettings = {
  maintenanceMode: false,
  maintenanceMessage: "We're making a few improvements. Please check back shortly.",
  footerBlurb: "Software that ships. Teams that can run it.",
  imageMaxMb: 8,
  pdfMaxMb: 15,
  analyticsRetentionDays: 90,
  trashRetentionDays: 30,
  newsletterEnabled: true,
};

export const socials = [
  { platform: "linkedin", label: "LinkedIn", url: "[[linkedin.com/in/…]]", icon: "linkedin" },
  { platform: "x", label: "X (Twitter)", url: "[[x.com/…]]", icon: "x" },
  { platform: "github", label: "GitHub", url: "[[github.com/…]]", icon: "github" },
  { platform: "youtube", label: "YouTube", url: "[[youtube.com/@…]]", icon: "youtube" },
  { platform: "instagram", label: "Instagram", url: "[[instagram.com/…]]", icon: "instagram" },
  { platform: "facebook", label: "Facebook", url: "[[facebook.com/…]]", icon: "facebook" },
  { platform: "tiktok", label: "TikTok", url: "[[tiktok.com/@…]]", icon: "tiktok" },
  { platform: "whatsapp", label: "WhatsApp", url: "[[wa.me/234…]]", icon: "whatsapp" },
  { platform: "calendly", label: "Book a call", url: "[[cal.com/… or calendly.com/…]]", icon: "calendly" },
];

/** Value 0 hides a stat publicly until TJ fills it in. */
export const stats = [
  { label: "Years building software", value: 8, suffix: "+", icon: "code-2" },
  { label: "Projects delivered", value: 25, suffix: "+", icon: "rocket" },
  { label: "Professionals trained", value: 0, suffix: "+", icon: "users" },
  { label: "Training programmes authored", value: 15, suffix: "", icon: "book-open" },
];

export const homepageSections = [
  { key: "hero", title: "Hero", kicker: "" },
  { key: "stats", title: "At a glance", kicker: "By the numbers" },
  { key: "services", title: "What I do", kicker: "Services" },
  { key: "skills", title: "Core expertise", kicker: "Skills" },
  { key: "projects", title: "Selected work", kicker: "Portfolio" },
  { key: "trainings", title: "Trainings delivered", kicker: "Training" },
  { key: "clients", title: "Trusted by teams at", kicker: "Clients & partners" },
  { key: "testimonials", title: "What clients say", kicker: "Testimonials" },
  { key: "certifications", title: "Certifications", kicker: "Credentials" },
  { key: "insights", title: "Latest insights", kicker: "Writing" },
  { key: "cta", title: "Have a project or a team to train?", kicker: "Work together" },
];

export const categories = {
  project: [
    ["Web Apps", "web-apps"],
    ["Mobile Apps", "mobile-apps"],
    ["Websites", "websites"],
    ["AI & Automation", "ai-automation"],
    ["Plugins", "plugins"],
    ["Oracle DB", "oracle-db"],
    ["Data/Analytics", "data-analytics"],
    ["Lean Six Sigma", "lean-six-sigma"],
    ["Courseware", "courseware"],
    ["Other", "other"],
  ],
  training: [
    ["Oracle", "oracle"],
    ["Cloud/AWS", "cloud-aws"],
    ["VMware", "vmware"],
    ["Lean Six Sigma", "lean-six-sigma"],
    ["Software Dev", "software-dev"],
    ["AI/ML", "ai-ml"],
    ["Data", "data"],
    ["Cybersecurity", "cybersecurity"],
    ["Digital Skills", "digital-skills"],
  ],
  certification: [
    ["Oracle Database", "oracle-database"],
    ["AWS", "aws"],
    ["VMware", "vmware"],
    ["Lean Six Sigma", "lean-six-sigma"],
    ["Scrum/Agile", "scrum-agile"],
    ["Cybersecurity", "cybersecurity"],
  ],
  service_type: [
    ["Web App", "web-app"],
    ["Mobile App", "mobile-app"],
    ["Website", "website"],
    ["Oracle DB", "oracle-db"],
    ["Lean Six Sigma", "lean-six-sigma"],
    ["Corporate Training", "corporate-training"],
    ["AI/Automation", "ai-automation"],
    ["Consulting", "consulting"],
  ],
  post: [
    ["AI & Automation", "ai-automation"],
    ["Databases", "databases"],
    ["Training & Learning", "training-learning"],
    ["Engineering", "engineering"],
  ],
  album: [
    ["Training sessions", "training"],
    ["Events & speaking", "events"],
    ["Team", "team"],
    ["Project launches", "launches"],
  ],
  faq: [
    ["General", "general"],
    ["Training", "training"],
    ["Projects", "projects"],
  ],
} as const;

export const menus = {
  header: [
    ["About", "/about"],
    ["Work", "/work"],
    ["Training", "/training"],
    ["Certifications", "/certifications"],
    ["Insights", "/insights"],
    ["Contact", "/contact"],
  ],
  footer: [
    ["Services", "/services"],
    ["Courses", "/courses"],
    ["Gallery", "/gallery"],
    ["Testimonials", "/testimonials"],
    ["Resume", "/resume"],
    ["Request maintenance", "/maintenance-request"],
  ],
  legal: [
    ["Privacy", "/privacy"],
    ["Terms", "/terms"],
  ],
} as const;

export const experiences = [
  {
    organization: "Skillscore IT Solutions & Training",
    role: "Founder & CEO",
    location: "Lagos, Nigeria",
    isCurrent: true,
    isLeadership: true,
    description:
      "Founded and leads a technology training and software development company closing Africa's tech-skills gap — delivering production software for clients and hands-on corporate programmes in Oracle, cloud, virtualization, software engineering, AI and Lean Six Sigma.",
  },
  {
    organization: "Mapelead Limited",
    role: "Lead Trainer & Consultant",
    location: "Lagos, Nigeria",
    isCurrent: true,
    isLeadership: true,
    description:
      "Leads training and consulting delivery under the Mapelead brand, including AI & Machine Learning, Lean Six Sigma and software development programmes for corporate clients.",
  },
  {
    organization: "Ha-shem Academy",
    role: "Lead Instructor",
    location: "Lagos, Nigeria",
    isCurrent: true,
    isLeadership: true,
    description:
      "Lead instructor for corporate IT programmes, including the five-day Oracle Database 19c bootcamp (SQL, PL/SQL, DBA I–III) and Oracle RAC administration labs.",
  },
  {
    organization: "Freelance & contract",
    role: "Senior Full-Stack Software Engineer",
    location: "Remote",
    isCurrent: true,
    isLeadership: false,
    description:
      "8+ years designing, building and maintaining web, mobile and AI-powered products with Laravel, React, Node.js, Python, PostgreSQL/MySQL and AWS — from e-commerce and school management systems to WordPress plugins and automation pipelines.",
  },
  {
    organization: "Covalence",
    role: "Corporate Trainer",
    location: "Nigeria",
    isCurrent: false,
    isLeadership: false,
    description: "Delivered corporate technology training programmes under the Covalence brand.",
  },
  {
    organization: "Katsina State Directorate of ICT (KATDICT)",
    role: "NYSC Corps Member",
    location: "Katsina, Nigeria",
    isCurrent: false,
    isLeadership: false,
    description:
      "Developed a digital impact and legacy agenda for the directorate and designed a digital-literacy programme for schools during the National Youth Service year.",
  },
];

export const skills: Array<[string, string, number]> = [
  // [name, category, proficiency 1–5]
  ["TypeScript", "languages", 5],
  ["JavaScript", "languages", 5],
  ["PHP", "languages", 5],
  ["Python", "languages", 4],
  ["SQL", "languages", 5],
  ["PL/SQL", "languages", 4],
  ["C#", "languages", 4],
  ["Laravel", "frameworks", 5],
  ["React", "frameworks", 5],
  ["Next.js", "frameworks", 4],
  ["Node.js / Express", "frameworks", 5],
  ["React Native", "frameworks", 4],
  ["SvelteKit", "frameworks", 3],
  ["ASP.NET Core", "frameworks", 4],
  ["WordPress (plugins & themes)", "frameworks", 5],
  ["PostgreSQL", "databases", 5],
  ["MySQL", "databases", 5],
  ["Oracle Database 19c (SQL, PL/SQL, DBA, RAC)", "databases", 5],
  ["Prisma / Drizzle", "databases", 4],
  ["AWS (Solutions Architect scope)", "cloud", 4],
  ["VMware vSAN / Cloud Foundation", "cloud", 4],
  ["Linux", "cloud", 4],
  ["Hostinger / hPanel", "cloud", 5],
  ["CI/CD", "cloud", 4],
  ["AI agent frameworks", "ai_data", 4],
  ["LLM automation", "ai_data", 4],
  ["Chatbots", "ai_data", 4],
  ["AI video production workflows", "ai_data", 4],
  ["dbt analytics engineering", "ai_data", 4],
  ["Machine learning fundamentals", "ai_data", 3],
  ["Lean Six Sigma (Master Black Belt curriculum)", "methodologies", 5],
  ["Agile delivery", "methodologies", 4],
  ["Secure coding", "methodologies", 4],
  ["Curriculum design", "training", 5],
  ["Instructor-led bootcamps", "training", 5],
  ["Certification-style question banks", "training", 5],
  ["Technical writing", "training", 5],
];

export const clients = [
  "ECOWAS Community Court of Justice",
  "African American Business School (AABS)",
  "Lagos State Employment Trust Fund (LSETF)",
  "Timeless Group of Companies",
  "ANWBN Marketplace",
  "PEAJEG Consults",
  "T-CENTER Cleaning",
  "KATDICT",
];

export const albums = [
  ["Oracle 19c Bootcamp", "training", "Hands-on sessions from the five-day Oracle Database 19c bootcamp."],
  ["Oracle RAC Lab", "training", "Building a two-node Oracle RAC 19c cluster on laptops — DNS, shared storage and Grid Infrastructure."],
  ["Corporate Trainings", "training", "Instructor-led programmes delivered for corporate and public-sector teams."],
  ["Speaking & Events", "events", "Talks, panels and community events."],
  ["NYSC / KATDICT", "team", "National Youth Service at the Katsina State Directorate of ICT."],
  ["Project Launches", "launches", "Go-lives, demos and handovers."],
] as const;

export const faqs = [
  {
    q: "Do you work with clients outside Nigeria?",
    a: "Yes. TJ is based in Lagos and works with clients across Africa and remotely worldwide. Trainings can be delivered on-site in Nigeria and the region, or virtually for distributed teams.",
    cat: "general",
  },
  {
    q: "Can a training be customised for our team?",
    a: "Every corporate programme starts with a short needs assessment. Modules, labs and capstone scenarios are adapted to your team's stack, level and industry — for example a banking capstone for VMware Cloud Foundation.",
    cat: "training",
  },
  {
    q: "Who owns the code when a project is finished?",
    a: "You do. Source code, documentation and infrastructure access are handed over at the end of the engagement, and your team is walked through the codebase.",
    cat: "projects",
  },
  {
    q: "Do you offer support after launch?",
    a: "Yes — through maintenance and support arrangements. Existing clients can raise issues at any time via the maintenance request form and track progress with their ticket number.",
    cat: "projects",
  },
];
