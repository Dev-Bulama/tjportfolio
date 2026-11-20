/** Seed: three original draft articles (brief §11.11) and legal pages. */

export const posts = [
  {
    title: "Shipping AI Agents in Production: Lessons from African Businesses",
    slug: "shipping-ai-agents-in-production",
    category: "ai-automation",
    excerpt:
      "Demos are easy. Agents that run every day for a bank, a school or a retailer are not. Here is what changes when an AI agent has to survive real operations, real costs and real customers.",
    body: `<p>Almost every AI conversation I have with a business owner starts with a demo they have seen: an assistant that answers questions, writes posts or reads invoices. The demo is real. The problem is everything the demo leaves out — and in African markets, where budgets are tighter, connectivity is uneven and customers switch between English, Pidgin and local languages in the same sentence, what gets left out is usually what decides whether the project succeeds.</p>
<p>Here are the lessons I keep relearning when taking agents from prototype to production.</p>
<h2>1. Start with a bottleneck, not a model</h2>
<p>The most successful projects I have worked on began with a measurable pain: a support inbox that took two days to clear, a content calendar that depended on one person, a back office re-typing the same documents every week. When the starting point is "we should use AI", the project drifts. When the starting point is "this queue costs us forty staff-hours a week", every decision has a yardstick.</p>
<p>Before writing any code, I ask three questions. How many times a day does this task happen? What does a wrong answer cost? Who checks the work today? The answers tell you whether you need an agent, a simple automation, or a better form.</p>
<h2>2. Build the evaluation set before the agent</h2>
<p>An agent without an evaluation set is a liability with a nice interface. Collect fifty to two hundred real examples — actual customer messages, actual documents, actual edge cases — and write down what a good output looks like for each. This becomes your test suite. Every prompt change, model upgrade or new tool is run against it before it reaches a customer.</p>
<p>In practice, the evaluation set is where you discover the hard cases early: the customer who writes half the message in Hausa, the invoice photographed at an angle under fluorescent light, the question that sounds simple but needs a policy decision nobody has made yet.</p>
<h2>3. Give the agent less freedom than you think</h2>
<p>The agents that run reliably are narrow. They have a small set of tools, explicit rules about when to escalate, and structured outputs that downstream systems can validate. "Answer customer questions" is a project that never ends; "classify incoming messages into six categories, draft replies for three of them, and route the rest to a human" ships in weeks and can be measured from day one.</p>
<p>Narrow scope also makes guardrails practical. If an agent can only issue refunds below a threshold, look up orders by the customer's own phone number, and draft — not send — replies above a certain value, the worst case is bounded.</p>
<h2>4. Design for cost from the first prototype</h2>
<p>Token prices look tiny until you multiply them by real volumes, retries and long conversation histories. For many African businesses the monthly AI bill is paid in foreign currency, which makes cost predictability even more important. I model cost per task during the prototype, set hard monthly limits, cache what can be cached, and use smaller models for classification and routing so the expensive models are reserved for the steps that need them.</p>
<h2>5. Plan for bad connectivity and slow systems</h2>
<p>Production agents call other systems: a core banking API, a school's student database, a WhatsApp gateway. Those systems time out. Networks drop. Queues and idempotent retries matter more than clever prompts. Every agent action should be safe to repeat, logged with enough context to replay, and visible to the operations team in plain language.</p>
<h2>6. Keep humans in the loop where trust is earned</h2>
<p>The fastest way to kill an AI project is one embarrassing message to an important customer. Start with the agent drafting and a human approving. Track the approval rate. When the team is approving ninety-five percent of drafts unchanged for a category, automate that category — and keep sampling outputs for review afterwards.</p>
<h2>7. Train the team, not just the model</h2>
<p>An agent changes someone's job. The support officer becomes a reviewer; the content manager becomes an editor of machine drafts. The rollouts that stuck were the ones where we spent as much time training staff — how the agent works, how to correct it, when to override it — as we spent on prompts.</p>
<h2>The pattern that works</h2>
<p>Pick a bottleneck. Build the evaluation set. Ship a narrow agent with a human approving its work. Measure accuracy, time saved and cost every week. Widen the scope only when the numbers say so. It is less exciting than the demos — and it is how AI ends up doing real work in real businesses.</p>`,
  },
  {
    title: "Why Oracle RAC Still Matters in 2026 — and How to Learn It on a Laptop",
    slug: "why-oracle-rac-still-matters",
    category: "databases",
    excerpt:
      "Cloud-native databases get the headlines, but Oracle RAC still runs the systems that cannot go down. Here is why the skill is worth having, and how to build a two-node lab on your own machine.",
    body: `<p>Every year someone declares that Oracle Database is legacy technology. Every year, the core banking platforms, telecom billing systems, government registries and ERP back ends that keep economies running are still on Oracle — and a meaningful share of the most critical ones run on Real Application Clusters (RAC). In Nigeria and across West Africa, banks and public institutions continue to hire for exactly this skill, and there are far fewer people who can operate a RAC cluster confidently than there are clusters.</p>
<h2>What RAC actually gives you</h2>
<p>RAC lets several servers open the same database at the same time. Each node runs its own instance, all instances share the same storage, and Oracle Clusterware coordinates them. If a node fails, sessions move to the survivors; when you need maintenance, you patch one node at a time while the database stays open. For workloads where an hour of downtime is a headline, that matters more than almost any other feature.</p>
<p>It also means a RAC administrator has to understand more than a single-instance DBA: cluster networking with public, private and virtual IPs; the SCAN listener; shared storage with ASM; voting disks and the OCR; services for load balancing and failover; and how to read the clusterware logs when a node gets evicted at 2 a.m.</p>
<h2>Why people struggle to learn it</h2>
<p>The usual obstacle is access. You cannot practise RAC on a production cluster, and most people do not have a spare pair of servers with shared storage. So they read about it, pass an exam, and meet their first real cluster on the job.</p>
<p>The good news is that a modern laptop is enough to build a working two-node cluster for learning, and building it yourself teaches more than any slide deck.</p>
<h2>The laptop lab, step by step</h2>
<p>This is the lab I use in my RAC administration training. You need a machine with 32 GB of RAM (16 GB works with patience), around 150 GB of free disk space, VirtualBox and Oracle Linux.</p>
<ol>
<li><strong>Plan your addresses.</strong> Each node needs a public IP, a private interconnect IP and a virtual IP, plus three SCAN addresses for the cluster. Write them down before you touch anything.</li>
<li><strong>Build a small DNS server.</strong> A lightweight VM running a DNS service resolves the node names and the SCAN name. Getting DNS right first prevents most installation failures later.</li>
<li><strong>Create the first node.</strong> Install Oracle Linux, configure two network adapters (public and private), install the pre-install package, and set kernel parameters, users and groups.</li>
<li><strong>Add shared disks.</strong> Create fixed-size virtual disks in VirtualBox and mark them shareable, then attach them to the node. These become your ASM disk groups for the OCR, voting files and data.</li>
<li><strong>Clone the second node.</strong> Clone the first VM, change its hostname and IP addresses, and attach the same shared disks.</li>
<li><strong>Verify, then install Grid Infrastructure.</strong> Run the cluster verification utility, fix every failed check, and install Grid Infrastructure. When <code>crsctl check cluster -all</code> reports both nodes online, you have a cluster.</li>
<li><strong>Install the database and create a RAC database</strong> with DBCA, then create a service that prefers one node and fails over to the other.</li>
</ol>
<h2>What to practise once it works</h2>
<p>The lab becomes valuable when you start breaking it. Stop an instance and watch sessions fail over. Pull the private interconnect and observe node eviction. Relocate services, add a disk to a disk group, patch one node while the other serves connections, and read the logs each time. Those exercises build the instincts that interviews — and real incidents — test.</p>
<h2>Is it still worth it?</h2>
<p>If you want to work on the systems that banks, telecoms and governments depend on, yes. Cloud skills and Oracle skills are not rivals; the most valuable engineers I train understand both, because the critical databases are moving to the cloud with RAC, Exadata and Autonomous services underneath. Knowing how the cluster actually works is what lets you run it well wherever it lives.</p>`,
  },
  {
    title: "From Training Room to Production: Designing Bootcamps That Actually Change How Teams Work",
    slug: "from-training-room-to-production",
    category: "training-learning",
    excerpt:
      "Most corporate training is forgotten within a month. The programmes that stick are designed backwards from the work people will do on Monday. Here is the framework I use.",
    body: `<p>Organisations spend serious money sending staff on technical training, and the honest result is often disappointing. Participants enjoy the week, collect a certificate, and return to a backlog that looks exactly like it did before. Within a month, most of what they learned has faded because nothing in their job required them to use it.</p>
<p>After years of designing and delivering programmes — Oracle Database bootcamps, AWS and VMware tracks, secure-coding courses, AI adoption sessions for public institutions — I have come to believe that the training room is the easy part. The difficult part is designing a programme that changes how a team works after everyone goes home.</p>
<h2>Design backwards from Monday morning</h2>
<p>Every programme I design starts with one question for the team lead: <em>what should your people be doing differently on the first Monday after training?</em> "Understand AWS" is not an answer. "Deploy our staging environment with infrastructure as code" is. "Restore last night's backup to a test server without calling the vendor" is.</p>
<p>Those Monday-morning outcomes become the spine of the curriculum. Each module exists because it moves participants closer to one of them; anything that does not is cut, however interesting it may be.</p>
<h2>Labs over slides, and the right kind of lab</h2>
<p>People learn infrastructure by building infrastructure. In the Oracle RAC course, participants build their own two-node cluster on their laptops. In the VMware Cloud Foundation programme, the capstone is designing a compliant private cloud for a fictional bank. In dbt training, everyone models the orders and payments of NaijaCart, an e-commerce business with the kind of messy data real Nigerian businesses have.</p>
<p>A good lab has three properties: it resembles the participant's real environment, it can fail in instructive ways, and it leaves something behind — scripts, notes, a working environment — that the participant can reuse at work.</p>
<h2>Write the manual like software</h2>
<p>Course materials go out of date quickly, and inconsistent materials undermine trust. I produce manuals, handouts and question banks programmatically from version-controlled sources. That is how a 238-page React Native handout or a 150-question Oracle DBA bank stays consistent and correctable: a fix in one place updates every format. It also means the client can receive editable sources and maintain the material themselves.</p>
<h2>Assess the skill, not the memory</h2>
<p>Certification-style questions have their place, especially when a team is preparing for an exam. But the most useful assessment is practical: restore this database, secure this endpoint, explain this architecture to a non-technical stakeholder. Practical assessments show the team lead exactly who is ready to take on what.</p>
<h2>Build the bridge back to work</h2>
<p>The last day of a programme should be about the return to work. Participants leave with a short personal plan: one task they will do in the next two weeks using what they learned, and who will review it. The team lead receives a written report on strengths, gaps and recommended next steps. Where possible, I schedule a short follow-up session a few weeks later to unblock whatever got stuck.</p>
<h2>What this looks like in practice</h2>
<ul>
<li>A needs assessment before the curriculum is written.</li>
<li>Clear, observable outcomes agreed with the team lead.</li>
<li>Labs that mirror the client's environment and leave reusable artefacts behind.</li>
<li>Materials maintained like code.</li>
<li>Practical assessment and a written report.</li>
<li>A plan, and a follow-up, for applying the skills at work.</li>
</ul>
<p>None of this is complicated. It simply takes the view that training is an investment in how work gets done — and judges it by what happens after the certificates are handed out.</p>`,
  },
];

export const privacyHtml = `<p>This notice explains how personal data is handled on this website. It is written to meet the Nigeria Data Protection Act 2023 (NDPA) and, for visitors in the EU/UK, the GDPR.</p>
<h2>Who is responsible</h2>
<p>The data controller is Tijani Bulama, Lagos, Nigeria. You can contact the controller using the details on the <a href="/contact">contact page</a>.</p>
<h2>What we collect and why</h2>
<ul>
<li><strong>Contact and enquiry forms</strong> — name, email, phone (optional), company, enquiry details and any file you attach. Used to respond to your enquiry and, where you engage us, to deliver the service. Legal basis: your request and our legitimate interest in responding.</li>
<li><strong>Maintenance requests</strong> — your contact details, the affected system, a description of the issue and any screenshots. Used to resolve the issue and keep you updated. Legal basis: performance of a contract.</li>
<li><strong>Course registrations and training requests</strong> — contact and organisation details. Used to arrange the training. Legal basis: steps prior to entering a contract.</li>
<li><strong>Reviews</strong> — the review you submit, your name, role and company, and your consent choice. Reviews are published only if you give consent, and only after moderation.</li>
<li><strong>Newsletter</strong> — your email address, confirmed by double opt-in. You can unsubscribe at any time using the link in every email.</li>
<li><strong>Privacy-friendly analytics</strong> — pages visited, referring website, campaign tags, device type, browser, operating system and country. No cookies are used for analytics and no IP address is stored; visitors are counted with a one-way hash that changes every day, so you cannot be recognised across days.</li>
</ul>
<h2>Cookies</h2>
<p>The public website sets only strictly necessary cookies: a security token that protects forms from cross-site request forgery, and your theme preference. The admin area uses a session cookie for signed-in staff. No advertising or tracking cookies are used.</p>
<h2>Spam protection</h2>
<p>Forms may use Cloudflare Turnstile to distinguish people from bots. Turnstile processes limited technical information under Cloudflare's privacy policy.</p>
<h2>Retention</h2>
<p>Enquiries and tickets are kept for as long as needed to handle them and for up to three years afterwards for record-keeping, unless you ask us to delete them sooner. Raw analytics records are deleted after 90 days; only aggregated daily counts are kept.</p>
<h2>Sharing</h2>
<p>We do not sell personal data. Data is shared only with service providers needed to run this website — hosting, email delivery and, where enabled, file storage — under appropriate agreements.</p>
<h2>Your rights</h2>
<p>You can ask to access, correct, delete or export your personal data, object to or restrict its processing, and withdraw consent at any time. To exercise these rights, use the contact page. You may also complain to the Nigeria Data Protection Commission (NDPC) or your local data-protection authority.</p>
<h2>Changes</h2>
<p>This notice may be updated from time to time. The latest version is always published on this page.</p>`;

export const termsHtml = `<p>These terms govern your use of this website. By using it you agree to them.</p>
<h2>Content</h2>
<p>All content on this website — text, case studies, articles, images and course descriptions — is provided for general information. Project details are shared with client permission or anonymised where work is confidential. Nothing on this website is a binding offer; services are provided under separate written agreements.</p>
<h2>Intellectual property</h2>
<p>Unless stated otherwise, content is © Tijani Bulama. You may share links and short quotations with attribution. Client names and logos belong to their respective owners and are shown with permission.</p>
<h2>Submissions</h2>
<p>When you submit a form, review or file, you confirm that the information is accurate and that you have the right to share it. Do not upload confidential information you are not authorised to disclose. Reviews are published only with your consent and may be edited for length or clarity without changing their meaning.</p>
<h2>Acceptable use</h2>
<p>Do not attempt to disrupt the website, access areas you are not authorised to use, send automated or bulk submissions, or upload malicious files.</p>
<h2>Liability</h2>
<p>The website is provided "as is". To the extent permitted by law, we are not liable for losses arising from use of the website or reliance on its general information.</p>
<h2>Governing law</h2>
<p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>`;
